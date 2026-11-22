#!/usr/bin/env python3
"""Quality of the ideology definitions (descriptions in data.js):  python3 tools/check_definitions.py [--defs file.json] [--utility] [--label NAME] [--list]

Definitions are prose; every sentence or phrase that says an ideology supports or opposes the idea of a value gives its
reason and ends with the value's name in parentheses: (Corporatism), (against Representative Democracy), or two names
separated by ";" when one sentence explains two values. Names must be the names in resultsMapping (case does not matter).

Measures (all computed from the text and from simulation, none from real answers):
  R  richness of the prose          R = 1 - exp(-b / b0), b = sum of log2(N / df) over the distinct content words of p,
                                    b0 = median of b over the reference set (the 3.13.1 definitions, frozen below)
  D  difference from other texts    D = 1 - max cosine of TF-IDF (words and word pairs, sublinear tf, L2) of name + p
  A  agreement with own values      A = max(0, 2 AUC - 1); AUC: cosine(name + p, text of a value the ideology lists) beats
                                    the cosine with a value it does not list (value text = name + definition + quiz text)
  H  stands on its own              H = 1 / (1 + m), m = names of other ideologies that appear in p
  Q_int = (R D A H)^(1/4), each at least 0.05
  F  stances and parentheses agree  |Correct| / |strong stances (|s| >= 0.5) U mentioned|
  RS share of reasoned pairs        (a) at least 6 content words and a reasoning word in the clause, (b) the value is among the
                                    3 values of its category closest to the clause, (c) at least 30% of the clause's content
                                    words are not in the value's own text. For a parenthesis with two names, (b) holds for both
                                    if it holds for either; (a) and (c) are checked for each name.
  P  neighbours agree               (descriptive) average precision of the values the 15 most similar ideologies hold
  U  use for the model              (--utility, needs node) mean log P(j | 3 noisy answers) with the definition minus without it
p is the definition without the parentheses and what is in them.
"""
import json, math, re, subprocess, sys, os, statistics
from collections import defaultdict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
B0 = None  # filled from tools/definitions_reference.json (frozen median of b of the 3.13.1 definitions)
REASON = ['because', 'since', 'so that', 'in order to', 'by', 'through', 'whereby', 'thereby', 'which', 'therefore', 'rather than', 'instead of']
PASS = dict(R=0.63, D=0.60, A=0.15, H=1.0, Q=0.60, F=0.90, RS=0.70)

def load(args):
    return json.loads(subprocess.check_output(['node', os.path.join(ROOT, 'tools', 'export_data.js')]))

def strip_parens(text):
    return re.sub(r'\s*\([^)]*\)', '', text)

class Ctx:
    def __init__(self, data, defs=None):
        self.stop = set(data['stop'])
        self.labels = data['labels']
        self.rm = data['resultsMapping']
        self.cat = data['categoryOf']
        self.defs = {l: (defs or {}).get(l, data['descriptions'].get(l, '')) for l in self.labels}
        self.valdef = data['descriptions']
        self.quiz = data['quiz']
        self.stances = {}
        for l in self.labels:
            s = {}
            for part in data['ideologyScores'][l].split('|'):
                if ':' in part:
                    k, v = part.rsplit(':', 1)
                    s[k] = float(v)
            self.stances[l] = s
        self.name_of = {k: n for c in self.rm.values() for k, n in c.items()}
        self.key_of = {n.lower(): k for k, n in self.name_of.items()}
        self.values = list(self.name_of)
        self.prose = {l: strip_parens(self.defs[l]) for l in self.labels}

    def words(self, text):
        return [w for w in re.findall(r'\w{2,}', text.lower()) if w not in self.stop]

    def terms(self, text):
        w = self.words(text)
        return w + [w[i] + ' ' + w[i + 1] for i in range(len(w) - 1)]

def tfidf_space(docs_terms):
    n = len(docs_terms)
    df = defaultdict(int)
    for t in docs_terms:
        for x in set(t):
            df[x] += 1
    return n, df

def vec(terms, n, df):
    c = defaultdict(int)
    for t in terms:
        c[t] += 1
    v = {}
    for t, k in c.items():
        if t in df:
            v[t] = (1 + math.log(k)) * (math.log((1 + n) / (1 + df[t])) + 1)
    norm = math.sqrt(sum(x * x for x in v.values())) or 1
    return {t: x / norm for t, x in v.items()}

def cos(a, b):
    if len(a) > len(b):
        a, b = b, a
    return sum(x * b.get(t, 0) for t, x in a.items())

def parse_mentions(text, ctx):
    """[(start_of_clause, key or None, sign, name_text, paren_index, group)] for every name in parentheses"""
    out = []
    prev_end = 0
    for gi, m in enumerate(re.finditer(r'\(([^)]*)\)', text)):
        # clause: from the end of the previous parenthesis or the start of the sentence, whichever is later
        before = text[:m.start()]
        sent = max(before.rfind('. '), before.rfind('! '), before.rfind('? '))
        sent = sent + 2 if sent >= 0 else 0
        start = max(prev_end, sent)
        clause = strip_parens(text[start:m.start()]).strip()
        group = []
        for part in m.group(1).split(';'):
            part = part.strip()
            sign = 1
            if part.lower().startswith('against '):
                sign, part = -1, part[8:].strip()
            group.append((ctx.key_of.get(part.lower()), sign, part))
        out.append((clause, group, gi))
        prev_end = m.end()
    return out

def evaluate(ctx, only=None):
    labels = ctx.labels
    N = len(labels)
    # ---- reference b0
    refp = os.path.join(ROOT, 'tools', 'definitions_reference.json')
    ref = json.load(open(refp)) if os.path.exists(refp) else None
    wsets = {l: set(ctx.words(ctx.prose[l])) for l in labels}
    dfw = defaultdict(int)
    for l in labels:
        for w in wsets[l]:
            dfw[w] += 1
    b = {l: sum(math.log2(N / dfw[w]) for w in wsets[l]) for l in labels}
    b0 = ref['b0'] if ref else statistics.median(b.values())
    R = {l: 1 - math.exp(-b[l] / b0) for l in labels}
    # ---- D (ideology texts only)
    xt = {l: ctx.terms(l.replace('-', ' ') + ' . ' + ctx.prose[l]) for l in labels}
    n1, df1 = tfidf_space([xt[l] for l in labels])
    x1 = {l: vec(xt[l], n1, df1) for l in labels}
    D, nearest = {}, {}
    for l in labels:
        best, who = 0, None
        for o in labels:
            if o != l:
                c = cos(x1[l], x1[o])
                if c > best:
                    best, who = c, o
        D[l], nearest[l] = 1 - best, who
    # ---- joint space for A and RS (ideologies + values)
    vt = {}
    for v in ctx.values:
        vt[v] = ctx.terms(ctx.name_of[v] + ' . ' + ctx.valdef.get(v, '') + ' . ' + ' . '.join(ctx.quiz.get(v, [])))
    vwords = {v: set(ctx.words(ctx.name_of[v] + ' . ' + ctx.valdef.get(v, '') + ' . ' + ' . '.join(ctx.quiz.get(v, [])))) for v in ctx.values}
    n2, df2 = tfidf_space([xt[l] for l in labels] + [vt[v] for v in ctx.values])
    x2 = {l: vec(xt[l], n2, df2) for l in labels}
    v2 = {v: vec(vt[v], n2, df2) for v in ctx.values}
    A = {}
    for l in labels:
        pos = [cos(x2[l], v2[v]) for v in ctx.values if v in ctx.stances[l]]
        neg = [cos(x2[l], v2[v]) for v in ctx.values if v not in ctx.stances[l]]
        if not pos or not neg:
            A[l] = 0.0
            continue
        wins = sum((p > q) + 0.5 * (p == q) for p in pos for q in neg)
        A[l] = max(0.0, 2 * wins / (len(pos) * len(neg)) - 1)
    # ---- H
    names = {o: re.compile(r'(?<![\w-])' + re.escape(o.lower()) + r'(?![\w-])') for o in labels}
    H, hits = {}, {}
    for l in labels:
        low = ctx.prose[l].lower()
        found = [o for o in labels if o != l and names[o].search(low)]
        hits[l] = found
        H[l] = 1 / (1 + len(found))
    Q = {l: (max(.05, R[l]) * max(.05, D[l]) * max(.05, A[l]) * max(.05, H[l])) ** .25 for l in labels}
    # ---- F, RS and flags
    F, RS, flags, bad = {}, {}, {}, {}
    for l in labels:
        st = ctx.stances[l]
        strong = {v for v, s in st.items() if abs(s) >= .5}
        ments = parse_mentions(ctx.defs[l], ctx)
        mentioned, correct, unknown, wrongsign, nostance = set(), set(), [], [], []
        pairs = []  # (value, clause, group_values)
        thin = False
        for clause, group, gi in ments:
            gvals = [k for k, sg, nm in group if k]
            for k, sg, nm in group:
                if k is None:
                    unknown.append(nm)
                    continue
                mentioned.add(k)
                s = st.get(k)
                if s is None:
                    nostance.append(nm)
                elif (s > 0) == (sg > 0):
                    correct.add(k)
                    pairs.append((k, clause, gvals))
                else:
                    wrongsign.append(nm)
        den = len(strong | mentioned) + len(unknown)
        F[l] = len(correct) / den if den else 0.0
        missing = sorted(strong - mentioned)
        passed = 0
        failed = []
        for k, clause, gvals in pairs:
            cw = set(ctx.words(clause))
            low = ' ' + clause.lower() + ' '
            ok_a = len(cw) >= 6 and any(re.search(r'(?<!\w)' + re.escape(r) + r'(?!\w)', low) for r in REASON)
            cv = vec(ctx.terms(clause), n2, df2)
            def top3(v):
                same = [u for u in ctx.values if ctx.cat[u] == ctx.cat[v]]
                rank = sorted(same, key=lambda u: -cos(cv, v2[u]))
                return v in rank[:3]
            ok_b = any(top3(g) for g in gvals)
            ok_c = len(cw - vwords[k]) >= .3 * len(cw) if cw else False
            if ok_a and ok_b and ok_c:
                passed += 1
            else:
                failed.append((ctx.name_of[k], ('a' if not ok_a else '') + ('b' if not ok_b else '') + ('c' if not ok_c else ''), clause))
        RS[l] = passed / len(correct) if correct else 0.0
        short = len(ctx.words(ctx.prose[l]) and re.findall(r'\w+', ctx.prose[l])) < 30
        thin = any(len(set(ctx.words(c))) < 6 for c, g, i in ments)
        flags[l] = [f for f, on in [('short_def', short), ('missing_stance', bool(missing)), ('wrong_link', bool(unknown or nostance or wrongsign)),
                                    ('thin_clause', thin), ('no_reason', RS[l] < .70), ('definition_misses_stances', A[l] < .15)] if on]
        bad[l] = dict(missing=missing, unknown=unknown, nostance=nostance, wrongsign=wrongsign, failed=failed, names=hits[l], nearest=nearest[l])
    # ---- P (descriptive)
    P = {}
    V = len(ctx.values)
    for l in labels:
        st = ctx.stances[l]
        if not st:
            continue
        sims = sorted(((cos(x1[l], x1[o]), o) for o in labels if o != l), reverse=True)[:15]
        score = defaultdict(float)
        for c, o in sims:
            for v, s in ctx.stances[o].items():
                score[v] += c * abs(s)
        order = sorted(ctx.values, key=lambda v: -score[v])
        hit, ap = 0, 0.0
        for i, v in enumerate(order, 1):
            if v in st:
                hit += 1
                ap += hit / i
        ap /= len(st)
        base = len(st) / V
        P[l] = (ap - base) / (1 - base)
    return dict(R=R, D=D, A=A, H=H, Q=Q, F=F, RS=RS, P=P, flags=flags, bad=bad, b0=b0, b=b)

def per_label_pass(res, l, U=None):
    ok = res['R'][l] >= PASS['R'] and res['D'][l] >= PASS['D'] and res['A'][l] >= PASS['A'] and res['H'][l] >= .5 \
        and res['Q'][l] >= PASS['Q'] and res['F'][l] >= PASS['F'] and res['RS'][l] >= PASS['RS'] and not res['bad'][l]['unknown']
    if U is not None and l in U:
        ok = ok and U[l] >= 0
    return ok

def main():
    args = sys.argv[1:]
    data = load(args)
    defs = None
    if '--defs' in args:
        defs = json.load(open(args[args.index('--defs') + 1]))
    ctx = Ctx(data, defs)
    res = evaluate(ctx)
    if '--freeze' in args:
        json.dump({'b0': statistics.median(res['b'].values()), 'note': 'median of b over the 3.13.1 definitions'}, open(os.path.join(ROOT, 'tools', 'definitions_reference.json'), 'w'))
        print('frozen b0 =', statistics.median(res['b'].values()))
        return
    U = None
    up = os.path.join('/tmp', 'U.json')
    if '--utility' in args:
        sub = ['node', os.path.join(ROOT, 'tools', 'check_utility.js')] + (['--defs', args[args.index('--defs') + 1]] if defs else [])
        U = json.loads(subprocess.check_output(sub))
    labs = [l for l in ctx.labels if ctx.stances[l]]
    if '--label' in args:
        labs = [args[args.index('--label') + 1]]
    for l in labs if '--label' in args else []:
        print(l, {k: round(res[k][l], 3) for k in 'R D A H Q F RS'.split()}, res['flags'][l])
        print(json.dumps(res['bad'][l], indent=1))
    mean = lambda xs: sum(xs) / len(xs)
    scored = [l for l in ctx.labels if ctx.stances[l]]
    n_pass = sum(per_label_pass(res, l, U) for l in scored)
    print('ideologies scored: %d, pass each: %d' % (len(scored), n_pass))
    for k in 'R D A H Q F RS P'.split():
        xs = [res[k][l] for l in scored if l in res[k]]
        thr = PASS.get(k)
        print('  %-2s mean %.3f  min %.3f  %s' % (k, mean(xs), min(xs), ('below %.2f: %d' % (thr, sum(x < thr - 1e-9 for x in xs))) if thr else ''))
    print('  Q_int mean >= 0.70:', round(mean([res['Q'][l] for l in scored]), 3))
    cnt = defaultdict(int)
    for l in scored:
        for f in res['flags'][l]:
            cnt[f] += 1
    print('  flags:', dict(cnt))
    if U:
        us = [U[l] for l in scored if l in U]
        print('  U mean %.3f nats, U > 0: %.1f%%, U < 0: %d' % (mean(us), 100 * sum(u > 0 for u in us) / len(us), sum(u < 0 for u in us)))
    if '--list' in args:
        for l in scored:
            if not per_label_pass(res, l, U):
                print('%-32s R%.2f D%.2f A%.2f H%.2f Q%.2f F%.2f RS%.2f %s' % (l, res['R'][l], res['D'][l], res['A'][l], res['H'][l], res['Q'][l], res['F'][l], res['RS'][l], ','.join(res['flags'][l])))
    if '--json' in args:
        json.dump({k: res[k] for k in ['R', 'D', 'A', 'H', 'Q', 'F', 'RS', 'P', 'flags', 'bad']}, open('/tmp/report.json', 'w'))

if __name__ == '__main__':
    main()
