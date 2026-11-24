// Checks of custom mode and packs (pack.js): node tools/check_pack.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.join(__dirname, '..');

// A fresh copy of the site's scripts, as a page would load them, with custom mode on or off and a pack saved or not
function load(custom, pack, keepOwnData) {
    const store = {};
    if (custom) store.hvMode = 'custom';
    if (pack) store.hvPack = typeof pack === 'string' ? pack : JSON.stringify(pack);
    const ctx = {
        console,
        atob: text => { if (!/^[A-Za-z0-9+\/]*={0,2}$/.test(text)) throw new Error('bad base64'); return Buffer.from(text, 'base64').toString('binary'); },
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }
    };
    if (keepOwnData) ctx.HV_NO_PACK = true;
    vm.createContext(ctx);
    ['data.js', 'pack.js', 'scoring.js'].forEach(file => {
        const code = fs.readFileSync(path.join(root, file), 'utf8').replace(/^const (HV|HVPack|resultsMapping|categories|categoryTitles|descriptions|ideologyScores|labelColors|ideologyGroups|labelMapping|iconSources) =/gm, 'var $1 =');
        vm.runInContext(code, ctx, { filename: file });
    });
    ctx.store = store;
    return ctx;
}
const run = (ctx, code) => vm.runInContext(code, ctx);

// The same, but with a storage you give it, so that two loads share what the first one saved (as two pages of a browser do)
function loadWithStore(store) {
    const ctx = {
        console,
        atob: text => Buffer.from(text, 'base64').toString('binary'),
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }
    };
    vm.createContext(ctx);
    ['data.js', 'pack.js', 'scoring.js'].forEach(file => {
        const code = fs.readFileSync(path.join(root, file), 'utf8').replace(/^const (HV|HVPack|resultsMapping|categories|categoryTitles|descriptions|ideologyScores|labelColors|ideologyGroups|labelMapping|iconSources) =/gm, 'var $1 =');
        vm.runInContext(code, ctx, { filename: file });
    });
    return ctx;
}

let failed = 0;
function check(name, ok, detail) {
    console.log((ok ? 'ok    ' : 'FAIL  ') + name + (detail ? ': ' + detail : ''));
    if (!ok) failed++;
}
const example = JSON.parse(fs.readFileSync(path.join(__dirname, 'example_pack.json'), 'utf8'));

// 1. Without custom mode a saved pack changes nothing, and normal answers keep their own keys
{
    const plain = load(false, null), withPack = load(false, example);
    const answers = { economics: [{ value: 'laissez_faire', agree: 1 }] };
    const a = plain.HV.rankIdeologies(answers).slice(0, 5).map(r => r.label + r.rankScore).join();
    const b = withPack.HV.rankIdeologies(answers).slice(0, 5).map(r => r.label + r.rankScore).join();
    check('normal mode ignores a saved pack', a === b && run(withPack, "typeof resultsMapping.economics.mutual_credit") === 'undefined');
    withPack.HV.saveAnswers(answers);
    check('normal mode keeps the normal answer keys', 'quizAnswers' in withPack.store && !('quizAnswersCustom' in withPack.store));
}

// 2. The example pack, applied
const c = load(true, example);
check('the example pack is valid and applied', c.HVPack.active() && c.HVPack.report.errors.length === 0 && c.HVPack.report.skipped.length === 0,
    JSON.stringify(c.HVPack.report));
check('added value exists', run(c, "resultsMapping.economics.mutual_credit") === 'Mutual Credit' && run(c, "HV.categoryOf.mutual_credit") === 'economics');
check('edited value name', run(c, "HV.nameOf('economics', 'social_market')") === 'Social Market (example)');
check('added ideology is in the model, its group and has a color', run(c, "HV.rankIdeologies({}).some(r => r.label === 'Mutualist Commons')") &&
    run(c, "ideologyGroups.Custom.includes('Mutualist Commons')") && run(c, "labelColors['Mutualist Commons']") === '#2a9d8f');
{
    const ranked = c.HV.rankIdeologies({ economics: [{ value: 'mutual_credit', agree: 1 }, { value: 'laissez_faire', agree: -0.6 }, { value: 'state_socialism', agree: -0.8 }] });
    check('a person with the added ideology\'s stances gets it first', ranked[0].label === 'Mutualist Commons', ranked[0].label);
}
check('edited stances of an official ideology', /mutual_credit:-0\.5/.test(run(c, "ideologyScores['National Syndicalism']")) && run(c, "labelColors['National Syndicalism']") === '#aa3333');
check('a value a pack added has a data-URI icon with no raw markup', (u => u.startsWith('data:image/svg+xml') && !u.includes('<'))(c.HVPack.iconUrl('economics', 'mutual_credit')) &&
    c.HVPack.iconUrl('economics', 'laissez_faire') === 'icons/economics/laissez_faire.svg');
{
    c.HV.saveAnswers({ economics: [{ value: 'mutual_credit', agree: 1 }] });
    check('custom mode keeps its own answer keys', 'quizAnswersCustom' in c.store && !('quizAnswers' in c.store));
}

// 3. Removing values and ideologies
{
    const pack = JSON.parse(JSON.stringify(example));
    pack.values.remove = ['laissez_faire'];
    pack.ideologies.remove = ['Italian Fascism'];
    const r = load(true, pack);
    check('removed value is gone everywhere', run(r, "!('laissez_faire' in HV.categoryOf) && !('laissez_faire' in resultsMapping.economics) && Object.keys(ideologyScores).every(k => !/(^|\\|)laissez_faire:/.test(ideologyScores[k]))"));
    check('removed ideology is gone everywhere', run(r, "!HV.rankIdeologies({}).some(x => x.label === 'Italian Fascism') && !(\"Italian Fascism\" in descriptions) && Object.keys(ideologyGroups).every(g => !ideologyGroups[g].includes('Italian Fascism'))"));
    r.HV.saveAnswers({ economics: [{ value: 'laissez_faire', agree: 1 }, { value: 'state_socialism', agree: 1 }] });
    const loaded = r.HV.loadAnswers();
    check('answers for a removed value are dropped in custom mode', loaded.economics.length === 1 && loaded.economics[0].value === 'state_socialism');
}

// 4. An ideology whose stances are all taken away does not get its old value sets back
{
    const plain = load(false, null);
    const ids = run(plain, "ideologyScores['Italian Fascism']").split('|').map(part => part.slice(0, part.lastIndexOf(':')));
    const pack = { format: 'hypervalues-pack', version: 1, ideologies: { edit: { 'Italian Fascism': { stances: Object.fromEntries(ids.map(id => [id, null])) } } } };
    const r = load(true, pack);
    check('all stances removed: the ideology stays, with no stances', r.HV.rankIdeologies({}).some(x => x.label === 'Italian Fascism') &&
        run(r, "ideologyScores['Italian Fascism']") === '' &&
        run(r, "Object.keys(labelMapping).filter(k => labelMapping[k] === 'Italian Fascism').every(k => k.startsWith('custom:'))"));
    check('the number of ideologies does not change', run(r, "HV.rankIdeologies({}).length") === run(plain, "HV.rankIdeologies({}).length"));
}

// 5. Things from a file are never trusted
{
    const bad = (name, patch) => {
        const pack = JSON.parse(JSON.stringify(example));
        patch(pack);
        const result = c.HVPack.validate(pack);
        check('rejected: ' + name, result.pack === null && result.errors.length > 0);
    };
    bad('a value id that is on every object', p => { p.values.add.economics.constructor = { name: 'x' }; });
    bad('the __proto__ id', p => { p.values.add.economics = JSON.parse('{"__proto__": {"name": "x"}}'); });
    bad('an id that starts with a digit or has a space', p => { p.values.add.economics['1bad id'] = { name: 'x' }; });
    bad('a stance above 1', p => { p.ideologies.add['Mutualist Commons'].stances.laissez_faire = 5; });
    bad('a stance that is a string', p => { p.ideologies.add['Mutualist Commons'].stances.laissez_faire = '1'; });
    bad('null in an added ideology', p => { p.ideologies.add['Mutualist Commons'].stances.laissez_faire = null; });
    bad('a color that is not #rrggbb', p => { p.ideologies.add['Mutualist Commons'].color = 'red; background:url(x)'; });
    bad('a label with a bar', p => { p.ideologies.add['A|B'] = {}; });
    bad('a label that is on every object', p => { p.ideologies.add.toString = {}; });
    bad('a name that is not text', p => { p.values.add.economics.mutual_credit.name = { a: 1 }; });
    bad('a wrong version', p => { p.version = 2; });
    bad('a wrong format', p => { p.format = 'something'; });
    check('rejected: text that is not JSON', c.HVPack.parseText('{oops').pack === null);
    check('rejected: an array', c.HVPack.validate([]).pack === null);
    // the checked copy holds only known fields
    const dirty = JSON.parse(JSON.stringify(example));
    dirty.evil = '<script>'; dirty.values.add.economics.mutual_credit.html = '<img onerror=x>';
    const clean = c.HVPack.validate(dirty).pack;
    check('unknown fields are dropped', clean && !('evil' in clean) && !('html' in clean.values.add.economics.mutual_credit));
    // a pack in the browser that is damaged is ignored, not applied
    const broken = load(true, '{"format":"hypervalues-pack","version":1,"values":{"add":{"economics":{"constructor":{}}}}}');
    check('a damaged saved pack is reported and not applied', broken.HVPack.active() === null && broken.HVPack.report.errors.length > 0 &&
        run(broken, "typeof resultsMapping.economics.constructor") === 'function');
}

// 6. Changes that do not fit are skipped, not applied
{
    const pack = { format: 'hypervalues-pack', version: 1, name: 'Old',
        values: { remove: ['no_such_value'], edit: { no_such_value: { name: 'x' } }, add: { economics: { laissez_faire: { name: 'again' } }, no_category: { x: { name: 'x' } } } },
        ideologies: { add: { 'Italian Fascism': {} }, edit: { 'No Such Ideology': { color: '#112233' }, 'National Syndicalism': { stances: { no_such_value: 1 } } }, remove: ['No Such Ideology'] } };
    const r = load(true, pack);
    check('changes that do not fit are skipped and listed (what names a removed thing is not)', r.HVPack.report.skipped.length === 5, String(r.HVPack.report.skipped.length));
    check('a stance on a value that does not exist and is not removed is reported', load(true, { format: 'hypervalues-pack', version: 1, ideologies: { edit: { 'National Syndicalism': { stances: { no_such_value: 1 } } } } }).HVPack.report.skipped.length === 1);
    check('an existing value is not replaced by an added one', run(r, "resultsMapping.economics.laissez_faire") === 'Laissez-Faire');
}

// 6b. The editor asks for the site's own data (HV_NO_PACK): a saved pack is then not applied
{
    const own = load(true, example, true);
    check('HV_NO_PACK: the pack is saved but not applied', own.HVPack.active() === null && run(own, "typeof resultsMapping.economics.mutual_credit") === 'undefined' && own.HVPack.storedPack() !== null);
}

// 6c. Rename an ideology, move a value, give a value an icon, remove a category
{
    const base = { format: 'hypervalues-pack', version: 1 };
    // rename
    const pack = { ...base, ideologies: { edit: { 'Italian Fascism': { rename: 'Roman Corporatism' } } } };
    const r = load(true, pack);
    const plain = load(false, null);
    const order = ctx => run(ctx, "Array.from(new Set(Object.keys(labelMapping).map(k => labelMapping[k])))");
    const before = order(plain), after = order(r);
    check('rename: same place in the list, new name everywhere', after.indexOf('Roman Corporatism') === before.indexOf('Italian Fascism') && !after.includes('Italian Fascism') && after.length === before.length &&
        run(r, "'Roman Corporatism' in ideologyScores && 'Roman Corporatism' in descriptions && 'Roman Corporatism' in labelColors && !('Italian Fascism' in ideologyScores) && Object.keys(ideologyGroups).some(g => ideologyGroups[g].includes('Roman Corporatism')) && Object.keys(ideologyGroups).every(g => !ideologyGroups[g].includes('Italian Fascism'))"));
    const ids = run(plain, "ideologyScores['Italian Fascism']").split('|').map(p => [p.slice(0, p.lastIndexOf(':')), Number(p.slice(p.lastIndexOf(':') + 1))]);
    const answers = {};
    ids.forEach(([id, st]) => { const cat = run(plain, `HV.categoryOf['${id}']`); (answers[cat] = answers[cat] || []).push({ value: id, agree: st }); });
    check('rename: the stances still make it the best match', r.HV.rankIdeologies(answers)[0].label === 'Roman Corporatism', r.HV.rankIdeologies(answers)[0].label);
    // collisions
    const clash = load(true, { ...base, ideologies: { edit: { 'Italian Fascism': { rename: 'Peronism' } } } });
    check('rename to a name that exists is skipped', clash.HVPack.report.skipped.length === 1 && run(clash, "'Italian Fascism' in ideologyScores"));
    const reuse = load(true, { ...base, ideologies: { edit: { 'Italian Fascism': { rename: 'Roman Corporatism', stances: Object.fromEntries(ids.map(([id]) => [id, null])) } }, add: {} } });
    const reuse2 = load(true, { ...base, ideologies: { remove: [], edit: { 'Italian Fascism': { rename: 'Roman Corporatism', stances: Object.fromEntries(ids.map(([id]) => [id, null])) } }, add: { 'Italian Fascism': { stances: { laissez_faire: -1 } } } } });
    check('rename then add the old name: both exist, no key is overwritten', run(reuse2, "Array.from(new Set(Object.keys(labelMapping).map(k => labelMapping[k]))).filter(l => l === 'Roman Corporatism' || l === 'Italian Fascism').length") === 2 &&
        run(reuse2, "Object.keys(labelMapping).filter(k => labelMapping[k] === 'Italian Fascism').length") === 1, JSON.stringify(reuse2.HVPack.report));
    void reuse;

    // move
    const moved = load(true, { ...base, values: { edit: { laissez_faire: { category: 'technology' } } } });
    check('move: the value is in the other category, its icon file is where it was', run(moved, "HV.categoryOf.laissez_faire") === 'technology' && run(moved, "!('laissez_faire' in resultsMapping.economics) && 'laissez_faire' in resultsMapping.technology") &&
        moved.HVPack.iconUrl('technology', 'laissez_faire') === 'icons/economics/laissez_faire.svg');
    moved.HV.saveAnswers({ economics: [{ value: 'laissez_faire', agree: 0.5 }, { value: 'state_socialism', agree: 1 }] });
    const homed = moved.HV.loadAnswers();
    check('move: the answer goes with its value', homed.technology && homed.technology[0].value === 'laissez_faire' && homed.economics.length === 1);
    check('move to a category that does not exist is skipped', load(true, { ...base, values: { edit: { laissez_faire: { category: 'nowhere' } } } }).HVPack.report.skipped.length === 1);

    // icons: SVG only, rebuilt from safe parts
    const SQUARE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#2a9d8f"/></svg>';
    const withIcon = load(true, { ...base, values: { add: { economics: { pic: { name: 'Pic', icon: SQUARE } } }, edit: { laissez_faire: { icon: SQUARE } } } });
    check('icons: an SVG is accepted and used as a data URI', withIcon.HVPack.report.errors.length === 0 && withIcon.HVPack.hasCustomIcon('pic') && withIcon.HVPack.hasCustomIcon('laissez_faire') &&
        withIcon.HVPack.iconUrl('economics', 'pic').startsWith('data:image/svg+xml') && !withIcon.HVPack.iconUrl('economics', 'pic').includes('<'));
    const clean = text => load(true, null).HVPack.cleanSvg(text);
    const unsafe = [
        ['an onload handler', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><circle cx="5" cy="5" r="4" onclick="x()"/></svg>'],
        ['a script', '<svg viewBox="0 0 10 10"><script>alert(1)</script><circle cx="5" cy="5" r="4"/></svg>'],
        ['a script in a dropped subtree', '<svg viewBox="0 0 10 10"><foreignObject><div><script>alert(1)</script></div></foreignObject><circle cx="5" cy="5" r="4"/></svg>'],
        ['an image with a link', '<svg viewBox="0 0 10 10"><image href="https://evil.example/x.png" width="10" height="10"/><circle cx="5" cy="5" r="4"/></svg>'],
        ['a use element', '<svg viewBox="0 0 10 10"><use href="https://evil.example/x.svg#a"/><circle cx="5" cy="5" r="4"/></svg>'],
        ['a link', '<svg viewBox="0 0 10 10"><a href="javascript:alert(1)"><path d="M0 0"/></a><circle cx="5" cy="5" r="4"/></svg>'],
        ['a style sheet', '<svg viewBox="0 0 10 10"><style>@import url(https://evil.example/a.css);</style><circle cx="5" cy="5" r="4"/></svg>'],
        ['an animation', '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"><animate attributeName="r" to="9"/><set attributeName="onclick" to="x"/></circle></svg>'],
        ['a style with a link', '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" style="fill:url(https://evil.example/x);filter:url(https://evil.example/f)"/></svg>'],
        ['a fill with a script url', '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="url(javascript:alert(1))"/></svg>'],
        ['an entity in a value', '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="&#106;avascript:alert(1)"/></svg>'],
        ['a prefixed or upper case element', '<svg viewBox="0 0 10 10"><svg:script>alert(1)</svg:script><SCRIPT>alert(2)</SCRIPT><circle cx="5" cy="5" r="4"/></svg>'],
        ['an href on a shape', '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" href="https://evil.example"/></svg>'],
        ['an event on a gradient stop', '<svg viewBox="0 0 10 10"><linearGradient id="g"><stop offset="0" onload="x()" stop-color="red"/></linearGradient><circle cx="5" cy="5" r="4" fill="url(#g)"/></svg>']
    ];
    unsafe.forEach(([name, text]) => {
        const r = clean(text);
        const noXmlns = r.svg ? r.svg.replace('xmlns="http://www.w3.org/2000/svg"', '') : '';
        check('svg: ' + name + ' is removed', !!r.svg && !/script|on[a-z]+=|javascript|http|evil|<a |<image|<use|<style|animate|foreignObject|&/i.test(noXmlns) && r.svg.includes('<circle'), r.svg || r.error);
    });
    check('svg: the local gradient link and filter still work', (r => r.svg && r.svg.includes('fill="url(#g)"') && r.svg.includes('<stop offset="0"'))(clean('<svg viewBox="0 0 10 10"><linearGradient id="g"><stop offset="0" stop-color="red"/></linearGradient><circle cx="5" cy="5" r="4" fill="url(#g)"/></svg>')));
    const rejectedSvg = (name, text) => check('svg rejected: ' + name, clean(text).svg === null);
    rejectedSvg('an entity declaration', '<!DOCTYPE svg [<!ENTITY a "b">]><svg viewBox="0 0 1 1"><g/></svg>');
    rejectedSvg('CDATA', '<svg viewBox="0 0 1 1"><![CDATA[x]]></svg>');
    rejectedSvg('not an svg root', '<html><body><circle/></body></html>');
    rejectedSvg('plain text', 'hello');
    rejectedSvg('mismatched tags', '<svg viewBox="0 0 1 1"><g></svg></g>');
    rejectedSvg('no size at all', '<svg><circle cx="1" cy="1" r="1"/></svg>');
    rejectedSvg('two roots', '<svg viewBox="0 0 1 1"/><svg viewBox="0 0 1 1"/>');
    rejectedSvg('not text', 12345);
    // blur, shadow and glow are not possible: those primitives are not kept, and a filter that lost one is dropped whole
    const shadow = '<svg viewBox="0 0 10 10"><defs><filter id="shadow" x="-0.2" y="-0.2" width="1.4" height="1.4"><feFlood flood-color="#000" flood-opacity="0.5" result="f"/><feComposite in="f" in2="SourceGraphic" operator="in" result="c"/><feGaussianBlur in="c" stdDeviation="2" result="b"/><feOffset in="b" dx="1" dy="1" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><circle cx="5" cy="5" r="4" fill="#2a9d8f" filter="url(#shadow)" style="fill:#2a9d8f;filter:url(#shadow);stroke:none"/></svg>';
    const shadowed = clean(shadow);
    check('svg: a drop shadow (flood, blur, offset, merge) is removed whole and the shape stays', !!shadowed.svg && !/<filter|feGaussianBlur|feOffset|feFlood|feMerge|stdDeviation|flood-|filter=|filter:/.test(shadowed.svg) && shadowed.svg.includes('<circle') && shadowed.svg.includes('style="fill:#2a9d8f;stroke:none"'), shadowed.svg);
    check('svg: cleaning a document that had a removed filter changes nothing the second time', clean(shadowed.svg).svg === shadowed.svg);
    check('svg: stdDeviation, dx and dy are never kept', (r => r && !/stdDeviation|dx=|dy=/.test(r))(clean('<svg viewBox="0 0 10 10"><g dx="1" dy="2" stdDeviation="3"><circle r="1"/></g></svg>').svg));
    check('svg: a lone blur filter is removed and the shape that used it stays', (r => r && !/filter|Blur/.test(r) && r.includes('<circle'))(clean('<svg viewBox="0 0 10 10"><defs><filter id="f"><feGaussianBlur stdDeviation="3"/></filter></defs><circle cx="5" cy="5" r="4" filter="url(#f)"/></svg>').svg));
    check('svg: an empty filter is removed and the shape that used it stays', ['<filter id="f"/>', '<filter id="f"></filter>'].every(f => (r => r && !/filter/.test(r) && r.includes('<circle'))(clean('<svg viewBox="0 0 10 10"><circle r="4" filter="url(#f)"/><defs>' + f + '</defs></svg>').svg)));
    check('svg: a filter with an unsupported primitive (feDropShadow, feImage) is removed whole', ['<feDropShadow dx="1" dy="1" stdDeviation="1"/>', '<feImage href="https://evil.example/x.png"/>', '<feTurbulence baseFrequency="1"/>'].every(p => (r => r && !/filter|feColorMatrix|evil/.test(r) && r.includes('<circle'))(clean('<svg viewBox="0 0 10 10"><defs><filter id="f"><feColorMatrix type="saturate" values="0"/>' + p + '</filter></defs><circle r="4" filter="url(#f)"/></svg>').svg)));
    check('svg: a filter made only of kept primitives (feColorMatrix, feComposite, feBlend) stays with its references', (r => r && r.includes('<filter id="ok"') && r.includes('<feColorMatrix') && r.includes('<feComposite') && r.includes('<feBlend') && r.includes('filter="url(#ok)"') && r.includes('filter:url(#ok)'))(clean('<svg viewBox="0 0 10 10"><defs><filter id="ok"><feColorMatrix type="saturate" values="0" result="s"/><feComposite in="s" in2="SourceGraphic" operator="in" result="c"/><feBlend in="c" in2="SourceGraphic" mode="multiply"/></filter></defs><circle r="4" filter="url(#ok)" style="filter:url(#ok);fill:red"/></svg>').svg));
    check('svg: only the filter that lost a primitive is dropped, another one stays', (r => r && !r.includes('id="bad"') && r.includes('id="good"') && r.includes('filter="url(#good)"') && !r.includes('url(#bad)'))(clean('<svg viewBox="0 0 10 10"><defs><filter id="bad"><feOffset dx="1"/></filter><filter id="good"><feColorMatrix type="saturate" values="1"/></filter></defs><circle r="1" filter="url(#bad)"/><rect width="1" height="1" filter="url(#good)"/></svg>').svg));
    check('svg: a width and height make a viewBox', (r => r.svg && r.svg.includes('viewBox="0 0 20 10"'))(clean('<svg width="20" height="10"><rect width="20" height="10"/></svg>')));
    check('svg: cleaning twice changes nothing', (r => clean(r.svg).svg === r.svg)(clean('<?xml version="1.0"?><!-- c --><svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="x" inkscape:version="1" viewBox="0 0 10 10" width="100px"><sodipodi:namedview id="n"/><g style="fill:#f00;stroke-width:0.5;font-family:evil"><path d="M0 0L5 5z" id="p1" class="x"/></g></svg>')));
    // a pack with an icon that is not an SVG is rejected, and one with an unsafe SVG keeps only the safe parts
    check('icon rejected in a pack: a link', load(true, null).HVPack.validate({ ...base, values: { add: { economics: { pic: { name: 'Pic', icon: 'https://example.com/x.svg' } } } } }).pack === null);
    check('icon cleaned in a pack: a script is gone', (r => r.pack && !/script|onload/.test(r.pack.values.add.economics.pic.icon))(load(true, null).HVPack.validate({ ...base, values: { add: { economics: { pic: { name: 'Pic', icon: '<svg viewBox="0 0 1 1" onload="x()"><script>x()</script><g/></svg>' } } } } })));
    // every icon of the site passes through unchanged in what it draws
    {
        const dir = path.join(root, 'icons');
        const files = [];
        (function walk(d) { fs.readdirSync(d).forEach(f => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.svg')) files.push(p); }); })(dir);
        const count = (t, tag) => (t.match(new RegExp('<' + tag + '[\\s/>]', 'g')) || []).length;
        const tags = ['path', 'circle', 'g', 'rect', 'polygon', 'linearGradient', 'clipPath', 'filter', 'feColorMatrix', 'stop', 'defs'];
        let rejected = 0, lost = 0;
        files.forEach(f => {
            const text = fs.readFileSync(f, 'utf8');
            const r = clean(text);
            if (!r.svg) { rejected++; return; }
            if (tags.some(tag => count(text, tag) !== count(r.svg, tag))) lost++;
        });
        check('svg: all ' + files.length + ' icons of the site pass, with every shape kept', files.length > 100 && rejected === 0 && lost === 0, rejected + ' rejected, ' + lost + ' lost shapes');
    }

    // remove a category
    const gone = load(true, { ...base, categories: { remove: ['technology'] } });
    check('category removed with its values and their stances', run(gone, "!categories.includes('technology') && !('technology' in resultsMapping) && !('technology' in categoryTitles)") &&
        run(gone, "Object.values(HV.categoryOf).every(c => c !== 'technology')") &&
        run(gone, "Object.keys(ideologyScores).every(k => ideologyScores[k].split('|').every(p => !p || HV.categoryOf[p.slice(0, p.lastIndexOf(':'))]))") && gone.HV.rankIdeologies({}).length === 266);
    const all = load(true, { ...base, categories: { remove: run(plain, "categories.slice()") } });
    check('every category can be removed: no skipped change, no category and no value left', all.HVPack.report.skipped.length === 0 && all.HVPack.report.errors.length === 0 &&
        run(all, "categories.length") === 0 && run(all, "Object.keys(resultsMapping).length") === 0 && run(all, "Object.keys(HV.categoryOf).length") === 0);
    check('with no category the model still ranks all 266 ideologies and answers load empty', all.HV.rankIdeologies({}).length === 266 && JSON.stringify(all.HV.loadAnswers()) === '{}' &&
        all.HV.rankIdeologies({}).every(r => Number.isFinite(r.probability)));
    // the tree of a pack with no category is empty, and a category added afterwards works
    const emptyTree = JSON.parse(fs.readFileSync(path.join(root, 'questions_tree.json'), 'utf8'));
    all.HVPack.applyTree(emptyTree);
    check('with no category the question tree is empty', Object.keys(emptyTree).length === 0);
    const again = load(true, { ...base, categories: { remove: run(plain, "categories.slice()"), add: { fresh: 'Fresh' } }, values: { add: { fresh: { one: { name: 'One' } } } },
        ideologies: { add: { Solo: { stances: { one: 1 } } } } });
    check('all categories removed and a new one added: the new value and an ideology that holds it work', again.HVPack.report.skipped.length === 0 && run(again, "categories.join()") === 'fresh' &&
        again.HV.rankIdeologies({ fresh: [{ value: 'one', agree: 1 }] })[0].label === 'Solo');
    const movedOut = load(true, { ...base, values: { edit: { laissez_faire: { category: 'culture' } } }, categories: { remove: ['economics'] } });
    check('a value moved out of a removed category stays', run(movedOut, "HV.categoryOf.laissez_faire") === 'culture' && run(movedOut, "!('economics' in resultsMapping)"));
}
// 6d. The question tree
{
    const base = { format: 'hypervalues-pack', version: 1 };
    const tree0 = () => JSON.parse(fs.readFileSync(path.join(root, 'questions_tree.json'), 'utf8'));
    const plain = load(false, null);
    // no pack: the tree is not touched
    const untouched = tree0();
    check('tree: without a pack nothing changes', load(true, null).HVPack.applyTree(untouched).skipped.length === 0 && JSON.stringify(untouched) === JSON.stringify(tree0()));
    // a new question, reached from the first one, and a changed question
    const pack = { ...base,
        values: { add: { economics: { mutual_credit: { name: 'Mutual Credit' } } } },
        tree: { economics: { questions: {
            e_mutual: { text: 'How should credit work?', options: [{ text: 'People issue it to each other', next: 'mutual_credit' }, { text: 'Banks issue it', next: 'laissez_faire' }] },
            e1: { text: 'Who runs things?', options: [{ text: 'Mutual arrangements', next: 'e_mutual' }, { text: 'Private enterprise', next: 'e_market' }] }
        } } } };
    const r = load(true, pack);
    check('tree: the pack is valid', r.HVPack.report.errors.length === 0, JSON.stringify(r.HVPack.report));
    const tree = tree0();
    r.HVPack.applyTree(tree);
    const eco = tree.economics, byId = Object.fromEntries(eco.map(n => [n.id, n]));
    check('tree: a question is replaced and a new one added, the first stays first', eco[0].id === 'e1' && byId.e1.text === 'Who runs things?' && byId.e_mutual && byId.e1.options[0].next === 'e_mutual');
    check('tree: a value the pack added becomes a leaf the quiz can reach', byId.mutual_credit && !byId.mutual_credit.options && byId.laissez_faire && !byId.laissez_faire.options);
    const sameQuestions = (a, b) => JSON.stringify(a.filter(n => n.options)) === JSON.stringify(b.filter(n => n.options));
    const leafIds = list => list.filter(n => !n.options).map(n => n.id).sort().join();
    check('tree: the other categories have the same questions and the same values', Object.keys(tree0()).filter(c => c !== 'economics').every(c => sameQuestions(tree[c], tree0()[c]) && leafIds(tree[c]) === leafIds(tree0()[c])));
    // a removed value takes its option, and a question left with nothing goes too
    const gone = load(true, { ...base, values: { remove: ['laissez_faire'] } });
    const t2 = tree0();
    gone.HVPack.applyTree(t2);
    const ids2 = new Set(t2.economics.map(n => n.id));
    const dangling = t2.economics.filter(n => n.options).some(n => n.options.some(o => !ids2.has(o.next)));
    check('tree: a removed value leaves no option that goes nowhere', !ids2.has('laissez_faire') && !dangling);
    const allValues = tree0();
    const gone2 = load(true, { ...base, categories: { remove: ['technology'] } });
    gone2.HVPack.applyTree(allValues);
    check('tree: a removed category loses its questions', !('technology' in allValues) && 'economics' in allValues);
    // a question removed, and another one made the first
    const t3 = tree0();
    const rootChange = load(true, { ...base, tree: { economics: { remove: ['e_market'], root: 'e_floor' } } });
    rootChange.HVPack.applyTree(t3);
    const ids3 = new Set(t3.economics.map(n => n.id));
    check('tree: remove a question and choose the first one', !ids3.has('e_market') && t3.economics[0].id === 'e_floor' && t3.economics.filter(n => n.options).every(n => n.options.every(o => ids3.has(o.next))));
    // the questions of a removed category can be kept in another one (that is what the editor writes)
    {
        const techQuestions = Object.fromEntries(tree0().technology.filter(n => n.options).map(n => [n.id, { text: n.text, options: n.options.map(o => ({ text: o.text, next: o.next })) }]));
        const techValues = Object.keys(run(plain, 'resultsMapping.technology'));
        const moved = Object.fromEntries(techValues.map(id => [id, { category: 'economics' }]));
        const kept = load(true, { ...base, values: { edit: moved }, categories: { remove: ['technology'] }, tree: { economics: { questions: techQuestions } } });
        const t = tree0();
        kept.HVPack.applyTree(t);
        const before = tree0().economics.filter(n => n.options);
        const now = t.economics.filter(n => n.options);
        check('tree: the questions of a removed category are kept in another one and the other category is untouched', kept.HVPack.report.skipped.length === 0 && !('technology' in t) &&
            now.length === before.length + Object.keys(techQuestions).length && before.every(q => JSON.stringify(now.find(x => x.id === q.id)) === JSON.stringify(q)) && t.economics[0].id === before[0].id);
        const leafIds = new Set(t.economics.filter(n => !n.options).map(n => n.id));
        check('tree: the values the kept questions lead to are leaves of that category', techValues.every(v => leafIds.has(v)));
    }
    // a question with the id of a value is skipped
    const clash = load(true, { ...base, tree: { economics: { questions: { laissez_faire: { text: 'x', options: [{ text: 'y', next: 'state_socialism' }] } } } } });
    const t4 = tree0();
    check('tree: a question with the id of a value is skipped', clash.HVPack.applyTree(t4).skipped.length === 1 && t4.economics.some(n => n.id === 'laissez_faire' && !n.options));
    // a category the pack added gets its own questions
    const own = load(true, { ...base, categories: { add: { space: 'Space' } }, values: { add: { space: { rockets: { name: 'Rockets' } } } },
        tree: { space: { questions: { s1: { text: 'What for?', options: [{ text: 'Rockets', next: 'rockets' }] } } } } });
    const t5 = tree0();
    own.HVPack.applyTree(t5);
    check('tree: a category of the pack has its questions', t5.space && t5.space[0].id === 's1' && t5.space[1].id === 'rockets');
    // merge and normalize alone
    check('tree: mergeQuestions does not change the base', (() => { const b = tree0().economics; const before = JSON.stringify(b); plain.HVPack.mergeQuestions(b, { remove: ['e1'] }); return JSON.stringify(b) === before; })());
    // bad shapes
    const bad = (name, patch) => {
        const p = JSON.parse(JSON.stringify({ ...base, tree: { economics: { questions: { q1: { text: 'Q?', options: [{ text: 'A', next: 'e1' }] } } } } }));
        patch(p);
        check('tree rejected: ' + name, plain.HVPack.validate(p).pack === null);
    };
    bad('a question without options', p => { p.tree.economics.questions.q1.options = []; });
    bad('an option without a target', p => { delete p.tree.economics.questions.q1.options[0].next; });
    bad('a target that is on every object', p => { p.tree.economics.questions.q1.options[0].next = 'constructor'; });
    bad('a question id that is on every object', p => { p.tree.economics.questions.toString = p.tree.economics.questions.q1; });
    bad('an empty question text', p => { p.tree.economics.questions.q1.text = ''; });
    bad('a color that is not #rrggbb', p => { p.tree.economics.questions.q1.options[0].color = 'red'; });
    bad('a category that is on every object', p => { p.tree.constructor = { questions: {} }; });
    bad('a root that is not text', p => { p.tree.economics.root = 5; });
}

// 6e. No limits on size or count: big and many things are accepted (what is still checked is what a name or number may be)
{
    const base = { format: 'hypervalues-pack', version: 1 };
    const plain = load(false, null);
    const accepts = (name, pack) => { const r = plain.HVPack.validate(pack); check('no limit: ' + name, r.pack !== null && r.errors.length === 0, r.errors[0]); return r.pack; };
    const many = {};
    for (let i = 0; i < 3000; i++) many['v' + i] = { name: 'Value ' + 'x'.repeat(500) + i, definition: 'd'.repeat(20000) };
    accepts('3000 added values with long names and 20,000 character definitions', { ...base, values: { add: { economics: many } } });
    const labels = {};
    for (let i = 0; i < 3000; i++) labels['Ideology ' + i] = { definition: 'd'.repeat(5000), stances: { laissez_faire: 0.5 } };
    accepts('3000 added ideologies', { ...base, ideologies: { add: labels } });
    accepts('a very long name, group and value id', { ...base, values: { add: { economics: { ['a' + 'b'.repeat(500)]: { name: 'n'.repeat(5000) } } } }, ideologies: { add: { ['L'.repeat(1000)]: { group: 'g'.repeat(1000) } } } });
    const questions = {};
    for (let i = 0; i < 1000; i++) questions['q_' + i] = { text: 'Question '.repeat(500).trim(), options: Array.from({ length: 50 }, (_, k) => ({ text: 'Answer '.repeat(300) + k, next: 'laissez_faire' })) };
    accepts('1000 questions with 50 long answers each', { ...base, tree: { economics: { questions } } });
    const clean = text => plain.HVPack.cleanSvg(text);
    const deep = clean('<svg viewBox="0 0 1 1">' + '<g>'.repeat(3000) + '<circle r="1"/>' + '</g>'.repeat(3000) + '</svg>');
    check('no limit: an SVG nested 3000 deep', !!deep.svg && deep.svg.includes('<circle'));
    const wide = clean('<svg viewBox="0 0 1 1">' + '<path d="M0 0L1 1L2 2L3 3L4 4L5 5L6 6L7 7L8 8L9 9L10 10L11 11"/>'.repeat(20000) + '</svg>');
    check('no limit: an SVG with 20,000 shapes (1.3 MB)', !!wide.svg && wide.svg.length > 1000000);
    const longPath = clean('<svg viewBox="0 0 1 1"><path d="' + 'M0 0L1 1 '.repeat(100000) + '"/></svg>');
    check('no limit: a path of 1,000,000 characters', !!longPath.svg && longPath.svg.includes('<path d="M0 0L1 1'));
    const huge = '<svg viewBox="0 0 1 1"><!--' + 'x'.repeat(5000000) + '--><circle r="1"/></svg>';
    check('no limit: a 5 MB SVG file', !!clean(huge).svg);
}

// 6f. Deleting only removes the deleted thing: what still names it stays in the pack, is ignored without a warning, and comes back with it
{
    const base = { format: 'hypervalues-pack', version: 1 };
    const plain = load(false, null);
    const quiet = (name, ctx) => check('removal: ' + name, ctx.HVPack.report.errors.length === 0 && ctx.HVPack.report.skipped.length === 0, JSON.stringify(ctx.HVPack.report));
    const full = {
        ...base,
        categories: { add: { space: 'Space' } },
        values: { add: { economics: { mutual_credit: { name: 'Mutual Credit', definition: 'Credit between people.' } }, space: { rockets: { name: 'Rockets' } } },
                  edit: { mutual_credit: { name: 'Mutual Credit (edited)' }, laissez_faire: { name: 'Laissez-Faire (edited)' } } },
        ideologies: { add: { Mutualist: { stances: { mutual_credit: 1, rockets: 0.5, laissez_faire: -1 } } },
                      edit: { 'Italian Fascism': { stances: { mutual_credit: -1, laissez_faire: 0.5 }, color: '#112233' } } },
        tree: { economics: { questions: { e_credit: { text: 'Credit?', options: [{ text: 'Mutual', next: 'mutual_credit' }, { text: 'Banks', next: 'laissez_faire' }] } } } }
    };
    const without = (key, extra) => JSON.parse(JSON.stringify({ ...full, ...extra }));
    quiet('the full pack, nothing removed', load(true, full));
    const names = ctx => run(ctx, "Array.from(new Set(Object.keys(labelMapping).map(k => labelMapping[k])))");

    // a value the pack adds is removed: it is not there, nothing else is changed or reported, removing the removal brings it back
    const noCredit = without('', { values: { ...full.values, remove: ['mutual_credit'] } });
    const a = load(true, noCredit);
    quiet('a value the pack adds is removed, while its edit and a stance on it stay in the pack', a);
    check('removal: that value is gone from the data and from the stances', run(a, "!('mutual_credit' in HV.categoryOf) && !('mutual_credit' in resultsMapping.economics) && !/mutual_credit/.test(ideologyScores['Mutualist'] + ideologyScores['Italian Fascism'])"));
    check('removal: the pack still holds the value, its edit and the stances (nothing was deleted)', noCredit.values.add.economics.mutual_credit && noCredit.values.edit.mutual_credit && noCredit.ideologies.add.Mutualist.stances.mutual_credit === 1);
    const back = load(true, { ...noCredit, values: { ...noCredit.values, remove: [] } });
    check('removal: taking the removal away brings the value, its name and its stances back', run(back, "resultsMapping.economics.mutual_credit") === 'Mutual Credit (edited)' && /mutual_credit:1/.test(run(back, "ideologyScores['Mutualist']")) && /mutual_credit:-1/.test(run(back, "ideologyScores['Italian Fascism']")));

    // an official value is removed: edits and stances that name it stay and are ignored
    const noLaissez = load(true, without('', { values: { ...full.values, remove: ['laissez_faire'] } }));
    quiet('an official value is removed while edits and stances name it', noLaissez);
    check('removal: the ideologies that named it still rank, without that stance', noLaissez.HV.rankIdeologies({ economics: [{ value: 'state_socialism', agree: 1 }] }).length === 267 || noLaissez.HV.rankIdeologies({}).length === 267);

    // an ideology the pack adds is removed
    const noMutualist = load(true, without('', { ideologies: { ...full.ideologies, remove: ['Mutualist'] } }));
    quiet('an ideology the pack adds is removed', noMutualist);
    check('removal: it is not in the model, the others are', !names(noMutualist).includes('Mutualist') && names(noMutualist).includes('Italian Fascism') && !run(noMutualist, "Object.keys(ideologyGroups).some(g => ideologyGroups[g].includes('Mutualist'))"));
    // an official ideology is removed while the pack edits and renames it
    const noItalian = load(true, without('', { ideologies: { ...full.ideologies, edit: { 'Italian Fascism': { rename: 'Roman Corporatism', color: '#112233' } }, remove: ['Italian Fascism'] } }));
    quiet('an official ideology is removed while the pack edits and renames it', noItalian);
    check('removal: replacing an official ideology (remove and add the same label) still works', (c => names(c).includes('Italian Fascism') && /laissez_faire:-1/.test(run(c, "ideologyScores['Italian Fascism']")))(load(true, { ...base, ideologies: { remove: ['Italian Fascism'], add: { 'Italian Fascism': { stances: { laissez_faire: -1 } } } } })));

    // a category the pack adds is removed (its values and questions stay in the pack)
    const noSpace = load(true, without('', { categories: { ...full.categories, remove: ['space'] } }));
    quiet('a category the pack adds is removed', noSpace);
    check('removal: the category and its value are gone, the rest of the data is not changed', run(noSpace, "!categories.includes('space') && !('rockets' in HV.categoryOf) && !/rockets/.test(ideologyScores['Mutualist'])") && noSpace.HV.rankIdeologies({}).length === 267);

    // questions: a question the pack adds is removed (kept in the pack), an official one too
    const t = JSON.parse(fs.readFileSync(path.join(root, 'questions_tree.json'), 'utf8'));
    const withQ = load(true, full), tQ = JSON.parse(JSON.stringify(t));
    withQ.HVPack.applyTree(tQ);
    check('removal: the question the pack adds is in the tree', tQ.economics.some(n => n.id === 'e_credit'));
    const noQ = load(true, without('', { tree: { economics: { questions: full.tree.economics.questions, remove: ['e_credit', 'e_market'], root: 'e_credit' } } })), tNo = JSON.parse(JSON.stringify(t));
    noQ.HVPack.applyTree(tNo);
    check('removal: a question the pack adds can be removed, and so can an official one; a root that was removed is ignored', !tNo.economics.some(n => n.id === 'e_credit' || n.id === 'e_market') && tNo.economics[0].id === t.economics[0].id && noQ.HVPack.report.skipped.length === 0);
    const merged = plain.HVPack.mergeQuestions(t.economics, { questions: full.tree.economics.questions, remove: ['e_credit'] });
    check('removal: mergeQuestions removes after adding', !merged.some(q => q.id === 'e_credit') && merged.length === t.economics.filter(n => n.options).length);
}

// 6g. Answers to a value that a pack removed are kept and come back with the value
{
    const base = { format: 'hypervalues-pack', version: 1 };
    const store = { hvMode: 'custom', hvPack: JSON.stringify({ ...base, values: { remove: ['laissez_faire'] } }) };
    const first = loadWithStore(store);
    first.HV.saveAnswers({ economics: [{ value: 'laissez_faire', agree: 1 }, { value: 'state_socialism', agree: 0.5 }] });
    const seen = first.HV.loadAnswers();
    check('answers: the answer to a removed value is not shown or used', seen.economics.length === 1 && seen.economics[0].value === 'state_socialism');
    check('answers: it is kept apart, not thrown away', JSON.parse(store.quizAnswersCustomHidden).some(i => i.value === 'laissez_faire') && !/laissez_faire/.test(store.quizAnswersCustom));
    const again = loadWithStore(store);
    check('answers: loading again changes nothing', again.HV.loadAnswers().economics.length === 1 && /laissez_faire/.test(store.quizAnswersCustomHidden));
    store.hvPack = JSON.stringify({ ...base });       // the removal is taken away
    const restored = loadWithStore(store);
    const back = restored.HV.loadAnswers();
    check('answers: the value is back and so is its answer', back.economics.length === 2 && back.economics.some(i => i.value === 'laissez_faire' && i.agree === 1) && !('quizAnswersCustomHidden' in store) && /laissez_faire/.test(store.quizAnswersCustom));
    // the value is answered again while hidden answers exist: the newer answer wins and the old one is dropped
    store.hvPack = JSON.stringify({ ...base, values: { remove: ['laissez_faire'] } });
    loadWithStore(store).HV.loadAnswers();
    store.hvPack = JSON.stringify({ ...base });
    const b = loadWithStore(store);
    b.HV.saveAnswers({ economics: [{ value: 'laissez_faire', agree: -1 }] });
    const c = loadWithStore(store).HV.loadAnswers();
    check('answers: an answer given again beats the kept one', c.economics.filter(i => i.value === 'laissez_faire').length === 1 && c.economics[0].agree === -1 && !('quizAnswersCustomHidden' in store));
    // Clear all also clears what was kept
    store.hvPack = JSON.stringify({ ...base, values: { remove: ['state_socialism'] } });
    const d = loadWithStore(store);
    d.HV.saveAnswers({ economics: [{ value: 'state_socialism', agree: 1 }, { value: 'laissez_faire', agree: 1 }] });
    d.HV.loadAnswers();
    check('answers: something is kept before Clear all', 'quizAnswersCustomHidden' in store);
    d.HV.clearAnswers();
    check('answers: Clear all clears the visible and the kept answers', !('quizAnswersCustomHidden' in store) && store.quizAnswersCustom === '{}');
    // normal mode never writes the kept list
    const normal = { quizAnswers: JSON.stringify({ economics: [{ value: 'laissez_faire', agree: 1 }] }) };
    const n = loadWithStore(normal);
    n.HV.loadAnswers();
    check('answers: normal mode does not touch the kept list', !('quizAnswersCustomHidden' in normal) && !('quizAnswersCustom' in normal));
}

// 7. The site's own check data is untouched in normal mode (same ranking as before)
{
    const plain = load(false, null);
    check('normal mode: 266 ideologies as before', run(plain, "HV.rankIdeologies({}).length") === 266);
}

console.log(failed ? `\n${failed} checks failed` : '\nall pack checks passed');
process.exit(failed ? 1 : 0);
