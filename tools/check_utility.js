// U of every ideology: how much its definition helps the model when it lists only 3 values.   node tools/check_utility.js [--defs file.json] [--only "Label|Label2"]
// For each ideology j with at least 2 stances: the model knows only 3 of its stances (chosen with a seeded random), the other
// stances must be guessed from the ideologies whose name and definition are most similar. 12 times, 3 answers are drawn from the
// real stances of j (stance + normal noise 0.15). U = mean ln P(j | answers) with the definition of j in the model minus without
// it (its text is then only its name). The same answers are used in both runs. Prints JSON {label: U}, in nats.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const defsFile = argv.indexOf('--defs') >= 0 ? argv[argv.indexOf('--defs') + 1] : null;
const only = argv.indexOf('--only') >= 0 ? argv[argv.indexOf('--only') + 1] : null;
const overrides = defsFile ? JSON.parse(fs.readFileSync(defsFile, 'utf8')) : {};
const dataSrc = fs.readFileSync(path.join(root, 'data.js'), 'utf8').replace(/^const /gm, 'var ');
const scoringSrc = fs.readFileSync(path.join(root, 'scoring.js'), 'utf8').replace(/^const /gm, 'var ');

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function normal(r) { return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }
function hash(text) { let h = 7; for (const c of text) h = Math.imul(h, 31) + c.charCodeAt(0) | 0; return h; }

function build(label, stanceText, withText) {
    const ctx = { localStorage: { getItem() { return null; }, setItem() {} }, console, atob: t => Buffer.from(t, 'base64').toString('binary') };
    vm.createContext(ctx);
    vm.runInContext(dataSrc, ctx);
    Object.keys(overrides).forEach(k => { ctx.descriptions[k] = overrides[k]; });
    ctx.ideologyScores[label] = stanceText;
    if (!withText) ctx.descriptions[label] = '';
    vm.runInContext(scoringSrc, ctx);
    return ctx;
}

const base = { localStorage: { getItem() { return null; }, setItem() {} }, console, atob: t => Buffer.from(t, 'base64').toString('binary') };
vm.createContext(base);
vm.runInContext(dataSrc, base);
const onlyList = only ? only.split('|') : null;
const labels = Object.keys(base.ideologyScores).filter(l => !onlyList || onlyList.includes(l));
const out = {};
labels.forEach(label => {
    const parts = base.ideologyScores[label].split('|').filter(p => p.includes(':'));
    if (parts.length < 2) return;
    const r = rng(hash(label));
    const pool = parts.slice();
    const keep = [];
    while (keep.length < Math.min(3, parts.length)) keep.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    const stanceText = keep.join('|');
    const withCtx = build(label, stanceText, true);
    const withoutCtx = build(label, stanceText, false);
    const cat = withCtx.HV.categoryOf;
    let diff = 0;
    for (let trial = 0; trial < 12; trial++) {
        const answers = {};
        const drawn = [];
        const rest = parts.slice();
        while (drawn.length < Math.min(3, parts.length)) drawn.push(rest.splice(Math.floor(r() * rest.length), 1)[0]);
        drawn.forEach(p => {
            const at = p.lastIndexOf(':');
            const value = p.slice(0, at);
            const agree = Math.max(-1, Math.min(1, Number(p.slice(at + 1)) + 0.15 * normal(r)));
            (answers[cat[value]] = answers[cat[value]] || []).push({ value, agree });
        });
        const logp = ctx => Math.log(Math.max(1e-300, ctx.HV.rankIdeologies(answers).find(x => x.label === label).probability));
        diff += logp(withCtx) - logp(withoutCtx);
    }
    out[label] = diff / 12;
});
process.stdout.write(JSON.stringify(out));
