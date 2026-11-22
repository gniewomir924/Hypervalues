// Custom mode and packs. Load after data.js and before scoring.js.
//
// Custom mode: you pick values yourself (no question tree) and your answers are kept apart from the normal quiz.
// A pack is a small JSON file that changes the site's own data: it adds, changes or removes values and ideologies.
// It stores only the changes, not a copy of data.js, so it still works when the site's data grows. When custom mode
// is on and a pack is saved in the browser, the changes are applied to the tables of data.js here, before
// scoring.js builds the model from them. With custom mode off, nothing here touches the data.
//
// A pack file (version 1). Every part is optional:
// {
//   "format": "hypervalues-pack", "version": 1, "name": "My pack",
//   "categories": { "add": { "id": "Title" }, "rename": { "id": "New title" }, "remove": [ "id" ] },
//   "values": {
//     "add":    { "<category>": { "<id>": { "name": "...", "definition": "...", "icon": "<svg ...>...</svg>" } } },
//     "edit":   { "<id>": { "name": "...", "definition": "...", "icon": "<svg ...>...</svg>", "category": "<category>" } },
//     "remove": [ "<id>" ]
//   },
//   "ideologies": {
//     "add":    { "<Label>": { "group": "...", "color": "#rrggbb", "definition": "...", "stances": { "<id>": 0.8 } } },
//     "edit":   { "<Label>": { "rename": "New label", "group": "...", "color": "...", "definition": "...", "stances": { "<id>": -0.5, "<id>": null } } },
//     "remove": [ "<Label>" ]
//   },
//   "tree": {
//     "<category>": {
//       "questions": { "<id>": { "text": "...", "options": [ { "text": "...", "next": "<question id or value id>" } ] } },
//       "remove": [ "<question id>" ],
//       "root": "<question id>"
//     }
//   }
// }
// A stance goes from -1 (opposes) to +1 (matches); null (or 0) takes a stance away. A change that does not fit the
// current data (a value that does not exist, a label that is taken) is skipped and reported, not applied.
// A change to an ideology names it by its label in the site's data (before the pack's rename).
// Removing a category removes the values still in it. A value can move to another category ("category"); its answers
// move with it.
// The question tree: "questions" adds a question or replaces the one with that id (the whole question, text and
// options); "remove" takes questions away; "root" is the question a category starts with. An option goes to another
// question or to a value (which is what the person gets). An option that goes to nothing (a value or question that
// was removed) disappears, and a question left without options goes too.
// An icon is SVG markup. It is never used as it comes: cleanSvg below rebuilds it from a short list of safe
// elements and attributes (shapes, gradients, clip paths and filters of feColorMatrix, feComposite and feBlend; no blur,
// shadow or glow), and drops everything else (scripts,
// event handlers, links, images, fonts, styles sheets, animations, foreignObject, Inkscape's own data).
// A filter that had an unsupported part is dropped whole, and the elements that used it go on without it.
// A file from someone else is only data: it is read with JSON.parse, every field is checked, and its texts are
// shown with textContent, never as HTML.
const HVPack = (function () {
    const FORMAT = 'hypervalues-pack';
    const MODE_KEY = 'hvMode';
    const PACK_KEY = 'hvPack';
    // There are no limits on sizes or counts (text, names, definitions, files, pictures, questions, answers). What is still
    // checked is what a thing may be (an id, a color, a number from -1 to 1) and what only the browser can allow (its storage).
    const NEW_ID = /^[A-Za-z][A-Za-z0-9_]*$/;
    const COLOR = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
    const CONTROL = /[\u0000-\u001f\u007f]/;
    const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
    const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);

    function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    function write(key, value) {
        try {
            if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
            return true;
        } catch (e) { return false; }
    }
    function isCustom() { return read(MODE_KEY) === 'custom'; }
    function setCustom(on) { write(MODE_KEY, on ? 'custom' : null); }

    // ---------------------------------------------------------------------------------------------
    // Checking a pack (what comes from a file is never trusted)
    // ---------------------------------------------------------------------------------------------
    // A word that is on every object ("constructor", "toString", "__proto__") must never be an id or a label
    const reserved = text => text in Object.prototype;
    const isRef = id => typeof id === 'string' && id.length >= 1 && !reserved(id) && !CONTROL.test(id) && !/[|:]/.test(id);
    const isNewId = id => typeof id === 'string' && NEW_ID.test(id) && !reserved(id);
    const isLabel = text => typeof text === 'string' && text === text.trim() && text.length >= 1 &&
        !reserved(text) && !CONTROL.test(text) && !text.includes('|') && text !== 'No exact match';
    const isGroup = text => typeof text === 'string' && text === text.trim() && text.length >= 1 &&
        !reserved(text) && !CONTROL.test(text);
    const isTitle = text => typeof text === 'string' && text === text.trim() && text.length >= 1 && !CONTROL.test(text);
    const isDefinition = text => typeof text === 'string' && !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(text);
    // ---------------------------------------------------------------------------------------------
    // Icons: SVG markup, rebuilt from a list of safe parts (nothing in the result comes from the file except
    // names and values that passed a check for their kind)
    // ---------------------------------------------------------------------------------------------
    const SVG_ELEMENTS = new Set(['svg', 'g', 'defs', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
        'linearGradient', 'radialGradient', 'stop', 'clipPath', 'filter', 'feColorMatrix', 'feComposite', 'feBlend']);
    const NUM = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?(?:px|%)?$/;
    const NUMS = /^[-+0-9eE.,\s]*$/;
    const PATHDATA = /^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]*$/;
    const NAME = /^[A-Za-z_][\w.-]*$/;
    const URLREF = /^url\(#[A-Za-z_][\w.-]*\)$/;
    const PAINT = /^(?:none|currentColor|inherit|transparent|#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\([-0-9.,%\s]+\)|url\(#[A-Za-z_][\w.-]*\)(?: (?:none|#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,25}))?|[a-zA-Z]{3,25})$/;
    const TRANSFORM = /^(?:\s*(?:translate|scale|rotate|skewX|skewY|matrix)\s*\([-0-9eE+.,\s]*\)\s*,?)*$/;
    const oneOf = (...words) => value => words.includes(value);
    // numbers only (a value too big to be a number is refused), with no limit on their size
    // stdDeviation (the strength of a blur) is deliberately not here: a pack cannot set it, so the attribute is dropped
    // from every feGaussianBlur and the blur stays at its default of no effect
    const SVG_ATTRS = {
        d: value => PATHDATA.test(value), points: value => NUMS.test(value),
        viewBox: value => NUMS.test(value) && value.split(/[\s,]+/).filter(Boolean).length === 4,
        fill: value => PAINT.test(value), stroke: value => PAINT.test(value),
        'stop-color': value => PAINT.test(value),
        'fill-rule': oneOf('nonzero', 'evenodd'), 'clip-rule': oneOf('nonzero', 'evenodd'),
        'stroke-linecap': oneOf('butt', 'round', 'square'), 'stroke-linejoin': oneOf('miter', 'round', 'bevel'),
        'stroke-dasharray': value => value === 'none' || NUMS.test(value),
        transform: value => TRANSFORM.test(value), gradientTransform: value => TRANSFORM.test(value),
        'clip-path': value => value === 'none' || URLREF.test(value), filter: value => value === 'none' || URLREF.test(value),
        id: value => NAME.test(value), result: value => NAME.test(value), in: value => NAME.test(value), in2: value => NAME.test(value),
        gradientUnits: oneOf('userSpaceOnUse', 'objectBoundingBox'), clipPathUnits: oneOf('userSpaceOnUse', 'objectBoundingBox'),
        filterUnits: oneOf('userSpaceOnUse', 'objectBoundingBox'), primitiveUnits: oneOf('userSpaceOnUse', 'objectBoundingBox'),
        spreadMethod: oneOf('pad', 'reflect', 'repeat'),
        type: oneOf('matrix', 'saturate', 'hueRotate', 'luminanceToAlpha'), values: value => NUMS.test(value),
        operator: oneOf('over', 'in', 'out', 'atop', 'xor', 'arithmetic'),
        mode: oneOf('normal', 'multiply', 'screen', 'darken', 'lighten'),
        'color-interpolation-filters': oneOf('auto', 'sRGB', 'linearRGB'),
        preserveAspectRatio: value => /^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max))(?: (?:meet|slice))?$/.test(value),
        href: value => /^#[A-Za-z_][\w.-]*$/.test(value)
    };
    ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'width', 'height', 'offset', 'opacity',
        'fill-opacity', 'stroke-opacity', 'stop-opacity', 'stroke-width', 'stroke-miterlimit', 'stroke-dashoffset',
        'k1', 'k2', 'k3', 'k4'].forEach(name => { SVG_ATTRS[name] = value => NUM.test(value); });
    const STYLE_PROPERTIES = ['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
        'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'opacity', 'stop-color', 'stop-opacity',
        'clip-rule', 'clip-path', 'filter', 'color-interpolation-filters'];

    function cleanStyle(text) {
        const kept = [];
        text.split(';').forEach(part => {
            const at = part.indexOf(':');
            if (at < 1) return;
            const property = part.slice(0, at).trim().toLowerCase();
            const value = part.slice(at + 1).trim();
            if (STYLE_PROPERTIES.includes(property) && SVG_ATTRS[property](value)) kept.push(property + ':' + value);
        });
        return kept.join(';');
    }

    // Returns { svg, dropped } (svg is the clean markup) or { svg: null, error }
    function cleanSvg(text) {
        const fail = error => ({ svg: null, error });
        if (typeof text !== 'string') return fail('The icon is not text.');
        if (/<!ENTITY|<!\[CDATA\[/i.test(text)) return fail('This SVG uses entities or CDATA, which are not supported.');
        const tagName = /<([A-Za-z_][\w:.-]*)/y;
        const closeTag = /<\/([A-Za-z_][\w:.-]*)\s*>/y;
        const attribute = /\s*([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
        const out = [];
        const stack = [];
        const brokenFilters = new Set();     // ids of filters that are dropped whole (see below)
        let dropped = 0, droppedDepth = 0, rootDone = false, i = 0;

        while (i < text.length) {
            const lt = text.indexOf('<', i);
            if (lt < 0) break;
            i = lt;
            if (text.startsWith('<!--', i)) {
                const end = text.indexOf('-->', i + 4);
                if (end < 0) return fail('The SVG is not well formed.');
                i = end + 3; continue;
            }
            if (text.startsWith('<?', i)) {
                const end = text.indexOf('?>', i + 2);
                if (end < 0) return fail('The SVG is not well formed.');
                i = end + 2; continue;
            }
            if (text.startsWith('<!', i)) {
                const end = text.indexOf('>', i);
                if (end < 0 || text.slice(i, end).includes('[')) return fail('The SVG has a declaration that is not supported.');
                i = end + 1; continue;
            }
            if (text[i + 1] === '/') {
                closeTag.lastIndex = i;
                const m = closeTag.exec(text);
                if (!m) return fail('The SVG is not well formed.');
                const entry = stack.pop();
                if (!entry || entry.name !== m[1]) return fail('The SVG is not well formed.');
                if (!entry.kept) droppedDepth--;
                else if (entry.name === 'filter' && (entry.broken || entry.children === 0)) {
                    out.length = entry.outIndex;          // take the whole filter out again
                    dropped++;
                    if (entry.id) brokenFilters.add(entry.id);
                } else out.push('</' + entry.name + '>');
                i += m[0].length;
                continue;
            }
            tagName.lastIndex = i;
            const named = tagName.exec(text);
            if (!named) return fail('The SVG is not well formed.');
            const name = named[1];
            let j = i + named[0].length;
            const found = [];
            let selfClosing = false;
            for (;;) {
                while (j < text.length && /\s/.test(text[j])) j++;
                if (text[j] === '>') { j++; break; }
                if (text.startsWith('/>', j)) { selfClosing = true; j += 2; break; }
                attribute.lastIndex = j;
                const a = attribute.exec(text);
                if (!a) return fail('The SVG is not well formed.');
                found.push([a[1], a[2] !== undefined ? a[2] : a[3]]);
                j = attribute.lastIndex;
            }
            i = j;

            const isRoot = stack.length === 0;
            if (isRoot) {
                if (rootDone || name !== 'svg') return fail(rootDone ? 'The SVG has more than one root.' : 'This is not an SVG.');
                rootDone = true;
            }
            const keep = droppedDepth === 0 && SVG_ELEMENTS.has(name) && (name !== 'svg' || isRoot);
            const parent = stack[stack.length - 1];
            if (!keep) {
                dropped++;
                if (droppedDepth === 0 && parent && parent.kept && parent.name === 'filter') parent.broken = true;
                if (!selfClosing) { stack.push({ name, kept: false }); droppedDepth++; }
                continue;
            }

            const seen = new Set();
            const kept = [];
            let box = null, width = null, height = null;
            found.forEach(([original, raw]) => {
                if (original === 'xmlns' || original.startsWith('xmlns:')) return;
                let attr = original === 'xlink:href' ? 'href' : original;
                const value = raw.replace(/\s+/g, ' ').trim();
                if (seen.has(attr)) return;
                seen.add(attr);
                if (/[&<>"'\\\u0000-\u001f\u007f]/.test(value)) { dropped++; return; }
                if (attr === 'style') {
                    const style = cleanStyle(value);
                    if (style) kept.push('style="' + style + '"'); else dropped++;
                    return;
                }
                if (attr === 'href' && name !== 'linearGradient' && name !== 'radialGradient') { dropped++; return; }
                if (!has(SVG_ATTRS, attr) || !SVG_ATTRS[attr](value)) { dropped++; return; }
                if (isRoot && attr === 'viewBox') { box = value; return; }
                if (isRoot && (attr === 'width' || attr === 'height')) { if (attr === 'width') width = value; else height = value; return; }
                kept.push(attr + '="' + value + '"');
            });
            if (isRoot) {
                const pixels = v => (v !== null && /^[-+]?(?:\d+\.?\d*|\.\d+)(?:px)?$/.test(v) ? parseFloat(v) : null);
                if (box === null && pixels(width) > 0 && pixels(height) > 0) box = '0 0 ' + pixels(width) + ' ' + pixels(height);
                if (box === null) return fail('The SVG needs a viewBox (or a width and a height).');
                const sizes = [];
                if (pixels(width) > 0 && pixels(width) <= 10000) sizes.push('width="' + pixels(width) + '"');
                if (pixels(height) > 0 && pixels(height) <= 10000) sizes.push('height="' + pixels(height) + '"');
                kept.unshift('xmlns="http://www.w3.org/2000/svg"', 'viewBox="' + box + '"', ...sizes);
            }
            if (parent && parent.kept && parent.name === 'filter') parent.children++;
            const idAttribute = kept.find(a => a.startsWith('id="'));
            const filterId = idAttribute ? idAttribute.slice(4, -1) : null;
            if (name === 'filter' && selfClosing) {            // a filter with nothing in it
                dropped++;
                if (filterId) brokenFilters.add(filterId);
                continue;
            }
            const outIndex = out.length;
            out.push('<' + name + (kept.length ? ' ' + kept.join(' ') : '') + (selfClosing ? '/>' : '>'));
            if (!selfClosing) stack.push(name === 'filter' ? { name, kept: true, outIndex, id: filterId, children: 0, broken: false } : { name, kept: true });
        }
        if (stack.length || !rootDone) return fail(rootDone ? 'The SVG is not well formed.' : 'This is not an SVG.');
        let svg = out.join('');
        // The elements that used a filter that was dropped go on without it (they would otherwise be drawn as if the
        // filter had nothing to show, which can make them disappear)
        if (brokenFilters.size) {
            svg = svg.replace(/ filter="url\(#([^)"]*)\)"/g, (all, id) => (brokenFilters.has(id) ? '' : all));
            svg = svg.replace(/ style="([^"]*)"/g, (all, style) => {
                const left = style.split(';').filter(part => {
                    const m = /^filter:url\(#([^)]*)\)$/.exec(part);
                    return !(m && brokenFilters.has(m[1]));
                });
                return left.length ? ' style="' + left.join(';') + '"' : '';
            });
        }
        return { svg, dropped };
    }
    const svgUri = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

    const isStance = n => typeof n === 'number' && Number.isFinite(n) && n >= -1 && n <= 1;
    const round2 = n => Math.round(n * 100) / 100;

    function emptyPack(name) {
        return {
            format: FORMAT, version: 1, name: name || 'Custom pack',
            categories: { add: {}, rename: {}, remove: [] }, tree: {},
            values: { add: {}, edit: {}, remove: [] },
            ideologies: { add: {}, edit: {}, remove: [] }
        };
    }

    // Returns { pack, errors }: pack is a clean copy that holds only the known fields, or null if there are errors
    function validate(raw) {
        const errors = [];
        const fail = message => { errors.push(message); };
        if (!isObject(raw)) return { pack: null, errors: ['The file is not a pack.'] };
        if (raw.format !== FORMAT) return { pack: null, errors: ['The file is not a HyperValues pack (format).'] };
        if (raw.version !== 1) return { pack: null, errors: ['This pack has a version this site cannot read.'] };
        const pack = emptyPack();
        if (raw.name !== undefined) {
            if (isTitle(raw.name)) pack.name = raw.name; else fail('name: needs a text (not empty, no space at the start or end).');
        }

        const part = (object, key) => (isObject(object) && isObject(object[key])) ? object[key] : {};
        const list = (object, key) => (isObject(object) && Array.isArray(object[key])) ? object[key] : [];

        const catAdd = part(raw.categories, 'add');
        Object.keys(catAdd).forEach(id => {
            if (!isNewId(id)) return fail('categories.add: bad id "' + id.slice(0, 30) + '".');
            if (!isTitle(catAdd[id])) return fail('categories.add.' + id + ': the title needs a text (not empty, no space at the start or end).');
            pack.categories.add[id] = catAdd[id];
        });
        const catRename = part(raw.categories, 'rename');
        Object.keys(catRename).forEach(id => {
            if (!isRef(id)) return fail('categories.rename: bad id "' + id.slice(0, 30) + '".');
            if (!isTitle(catRename[id])) return fail('categories.rename.' + id + ': the title needs a text (not empty, no space at the start or end).');
            pack.categories.rename[id] = catRename[id];
        });

        list(raw.categories, 'remove').forEach(id => {
            if (!isRef(id)) return fail('categories.remove: bad id.');
            pack.categories.remove.push(id);
        });

        const valAdd = part(raw.values, 'add');
        Object.keys(valAdd).forEach(category => {
            if (!isRef(category)) return fail('values.add: bad category "' + category.slice(0, 30) + '".');
            if (!isObject(valAdd[category])) return fail('values.add.' + category + ' must be an object.');
            pack.values.add[category] = {};
            Object.keys(valAdd[category]).forEach(id => {
                const item = valAdd[category][id];
                if (!isNewId(id)) return fail('values.add.' + category + ': bad id "' + id.slice(0, 30) + '" (letters, digits and _, starting with a letter).');
                if (!isObject(item)) return fail('values.add.' + id + ' must be an object.');
                const name = item.name === undefined ? id.replace(/_/g, ' ') : item.name;
                if (!isTitle(name)) return fail('values.add.' + id + '.name: needs a text (not empty, no space at the start or end).');
                const definition = item.definition === undefined ? '' : item.definition;
                if (!isDefinition(definition)) return fail('values.add.' + id + '.definition: must be text.');
                const entry = { name, definition };
                if (item.icon !== undefined) {
                    const icon = cleanSvg(item.icon);
                    if (icon.svg) { entry.icon = icon.svg; } else fail('values.add.' + id + '.icon: ' + icon.error);
                }
                pack.values.add[category][id] = entry;
            });
        });
        const valEdit = part(raw.values, 'edit');
        Object.keys(valEdit).forEach(id => {
            const item = valEdit[id];
            if (!isRef(id)) return fail('values.edit: bad id "' + id.slice(0, 30) + '".');
            if (!isObject(item)) return fail('values.edit.' + id + ' must be an object.');
            const clean = {};
            if (item.name !== undefined) { if (isTitle(item.name)) clean.name = item.name; else fail('values.edit.' + id + '.name: needs a text (not empty, no space at the start or end).'); }
            if (item.definition !== undefined) { if (isDefinition(item.definition)) clean.definition = item.definition; else fail('values.edit.' + id + '.definition: must be text.'); }
            if (item.icon !== undefined) {
                const icon = cleanSvg(item.icon);
                if (icon.svg) { clean.icon = icon.svg; } else fail('values.edit.' + id + '.icon: ' + icon.error);
            }
            if (item.category !== undefined) { if (isRef(item.category)) clean.category = item.category; else fail('values.edit.' + id + '.category: bad category id.'); }
            pack.values.edit[id] = clean;
        });
        list(raw.values, 'remove').forEach(id => {
            if (!isRef(id)) return fail('values.remove: bad id.');
            pack.values.remove.push(id);
        });

        function ideologyFields(label, item, where, stanceMayBeNull) {
            const clean = {};
            if (!isObject(item)) { fail(where + '.' + label + ' must be an object.'); return null; }
            if (stanceMayBeNull && item.rename !== undefined) { if (isLabel(item.rename)) clean.rename = item.rename; else fail(where + '.' + label + '.rename: bad label.'); }
            if (item.group !== undefined) { if (isGroup(item.group)) clean.group = item.group; else fail(where + '.' + label + '.group: needs a text (not empty, no space at the start or end).'); }
            if (item.color !== undefined) { if (typeof item.color === 'string' && COLOR.test(item.color)) clean.color = item.color; else fail(where + '.' + label + '.color: use #rrggbb.'); }
            if (item.definition !== undefined) { if (isDefinition(item.definition)) clean.definition = item.definition; else fail(where + '.' + label + '.definition: must be text.'); }
            if (item.stances !== undefined) {
                if (!isObject(item.stances)) { fail(where + '.' + label + '.stances must be an object.'); return clean; }
                clean.stances = {};
                Object.keys(item.stances).forEach(id => {
                    const s = item.stances[id];
                    if (!isRef(id)) return fail(where + '.' + label + '.stances: bad value id.');
                    if (s === null && stanceMayBeNull) clean.stances[id] = null;
                    else if (isStance(s)) clean.stances[id] = round2(s);
                    else fail(where + '.' + label + '.stances.' + id + ': a number from -1 to 1' + (stanceMayBeNull ? ' or null.' : '.'));
                });
            }
            return clean;
        }
        const ideoAdd = part(raw.ideologies, 'add');
        Object.keys(ideoAdd).forEach(label => {
            if (!isLabel(label)) return fail('ideologies.add: bad label "' + label.slice(0, 30) + '".');
            const clean = ideologyFields(label, ideoAdd[label], 'ideologies.add', false);
            if (clean) pack.ideologies.add[label] = clean;
        });
        const ideoEdit = part(raw.ideologies, 'edit');
        Object.keys(ideoEdit).forEach(label => {
            if (!isLabel(label)) return fail('ideologies.edit: bad label "' + label.slice(0, 30) + '".');
            const clean = ideologyFields(label, ideoEdit[label], 'ideologies.edit', true);
            if (clean) pack.ideologies.edit[label] = clean;
        });
        list(raw.ideologies, 'remove').forEach(label => {
            if (!isLabel(label)) return fail('ideologies.remove: bad label.');
            pack.ideologies.remove.push(label);
        });

        // the question tree
        const isText = text => typeof text === 'string' && text === text.trim() && text.length >= 1 && !CONTROL.test(text);
        const treePart = isObject(raw.tree) ? raw.tree : {};
        Object.keys(treePart).forEach(category => {
            if (!isRef(category)) return fail('tree: bad category id.');
            const part = treePart[category];
            if (!isObject(part)) return fail('tree.' + category + ' must be an object.');
            const clean = { questions: {}, remove: [] };
            const questions = isObject(part.questions) ? part.questions : {};
            Object.keys(questions).forEach(id => {
                const where = 'tree.' + category + '.questions.' + id;
                const q = questions[id];
                if (!isRef(id)) return fail('tree.' + category + '.questions: bad question id.');
                if (!isObject(q)) return fail(where + ' must be an object.');
                if (!isText(q.text)) return fail(where + '.text: needs a text (not empty, no space at the start or end).');
                if (!Array.isArray(q.options) || q.options.length < 1) return fail(where + '.options: needs at least 1 option.');
                const options = [];
                q.options.forEach(option => {
                    if (!isObject(option) || !isText(option.text) || !isRef(option.next)) return fail(where + '.options: each option needs a text and a "next" (a question or a value).');
                    const entry = { text: option.text, next: option.next };
                    if (option.color !== undefined) {
                        if (typeof option.color === 'string' && COLOR.test(option.color)) entry.color = option.color; else return fail(where + '.options: color must be #rrggbb.');
                    }
                    options.push(entry);
                });
                clean.questions[id] = { text: q.text, options };
            });
            if (Array.isArray(part.remove)) part.remove.forEach(id => { if (isRef(id)) clean.remove.push(id); else fail('tree.' + category + '.remove: bad question id.'); });
            if (part.root !== undefined) { if (isRef(part.root)) clean.root = part.root; else fail('tree.' + category + '.root: bad question id.'); }
            pack.tree[category] = clean;
        });
        return errors.length ? { pack: null, errors } : { pack, errors: [] };
    }

    // Text of a file (or of a saved pack) to a checked pack: { pack, errors }
    function parseText(text) {
        let raw;
        try { raw = JSON.parse(text); } catch (e) { return { pack: null, errors: ['This is not a valid JSON file.'] }; }
        return validate(raw);
    }

    // ---------------------------------------------------------------------------------------------
    // Applying a pack to the tables of data.js (changes them in place)
    // ---------------------------------------------------------------------------------------------
    const customValues = new Set();    // ids of the values a pack added (they have no icon file)
    const customIcons = new Map();     // value id -> the clean SVG markup a pack gave it
    const movedFrom = {};              // value id -> the category its icon file is in, for an official value a pack moved

    function parseScores(text) {
        const scores = new Map();
        String(text || '').split('|').forEach(part => {
            const i = part.lastIndexOf(':');
            if (i < 1) return;
            const n = Number(part.slice(i + 1));
            if (Number.isFinite(n)) scores.set(part.slice(0, i), n);
        });
        return scores;
    }
    const formatScores = scores => Array.from(scores, ([id, n]) => id + ':' + n).join('|');

    function apply(pack) {
        const skipped = [];
        const skip = message => { skipped.push(message); };
        const categoryOfValue = id => Object.keys(resultsMapping).find(cat => has(resultsMapping[cat], id)) || null;
        const labelSet = () => new Set(Object.keys(labelMapping).map(key => labelMapping[key]));
        const cleanGroups = () => Object.keys(ideologyGroups).forEach(g => { if (!ideologyGroups[g].length) delete ideologyGroups[g]; });
        const takeOutOfGroups = label => Object.keys(ideologyGroups).forEach(g => {
            ideologyGroups[g] = ideologyGroups[g].filter(name => name !== label);
        });
        // A key of labelMapping that names nothing (the model reads the stances from ideologyScores); never one in use
        function customKey(label) {
            let key = 'custom:' + label;
            while (has(labelMapping, key)) key += '+';
            return key;
        }
        // The label keeps its place in the list, but its old value sets (which the model uses when an ideology has
        // no stances at all) are replaced by a key that names nothing
        function neutralizeOldKeys(label) {
            const next = [];
            let done = false;
            Object.keys(labelMapping).forEach(key => {
                if (labelMapping[key] !== label) next.push([key, labelMapping[key]]);
                else if (!done) { next.push([null, label]); done = true; }
            });
            Object.keys(labelMapping).forEach(key => { delete labelMapping[key]; });
            next.forEach(([key, name]) => { labelMapping[key === null ? customKey(name) : key] = name; });
        }
        const hasOldKeys = label => Object.keys(labelMapping).some(key => labelMapping[key] === label && !key.startsWith('custom:'));
        function setStances(label, changes, where) {
            const scores = parseScores(ideologyScores[label]);
            Object.keys(changes).forEach(id => {
                if (!categoryOfValue(id)) return skip(where + ': the value "' + id + '" does not exist.');
                const s = changes[id];
                if (s === null || s === 0) scores.delete(id); else scores.set(id, s);
            });
            ideologyScores[label] = formatScores(scores);
            if (!scores.size && hasOldKeys(label)) neutralizeOldKeys(label);
        }
        // Takes a value out of everything (and out of the stances of every ideology)
        function dropValue(id, cat) {
            delete resultsMapping[cat][id];
            delete descriptions[id];
            delete iconSources[id];
            delete movedFrom[id];
            customValues.delete(id);
            customIcons.delete(id);
            Object.keys(ideologyScores).forEach(label => {
                const scores = parseScores(ideologyScores[label]);
                if (scores.delete(id)) {
                    ideologyScores[label] = formatScores(scores);
                    if (!scores.size && hasOldKeys(label)) neutralizeOldKeys(label);
                }
            });
        }
        function moveKey(object, from, to) {
            if (has(object, from)) { object[to] = object[from]; delete object[from]; }
        }

        // categories: add, rename
        Object.keys(pack.categories.add).forEach(id => {
            if (has(resultsMapping, id) || categories.includes(id)) return skip('Category "' + id + '" already exists.');
            categories.push(id);
            categoryTitles[id] = pack.categories.add[id];
            resultsMapping[id] = {};
        });
        Object.keys(pack.categories.rename).forEach(id => {
            if (!has(resultsMapping, id)) return skip('Category "' + id + '" does not exist (rename).');
            categoryTitles[id] = pack.categories.rename[id];
        });

        // values: remove, add, edit (name, definition, icon, category)
        pack.values.remove.forEach(id => {
            const cat = categoryOfValue(id);
            if (!cat) return skip('Value "' + id + '" does not exist (remove).');
            dropValue(id, cat);
        });
        Object.keys(pack.values.add).forEach(cat => {
            if (!has(resultsMapping, cat)) return skip('Category "' + cat + '" does not exist (values added to it).');
            Object.keys(pack.values.add[cat]).forEach(id => {
                if (categoryOfValue(id)) return skip('Value "' + id + '" already exists.');
                const item = pack.values.add[cat][id];
                resultsMapping[cat][id] = item.name;
                if (item.definition) descriptions[id] = item.definition;
                if (item.icon) customIcons.set(id, item.icon);
                customValues.add(id);
            });
        });
        Object.keys(pack.values.edit).forEach(id => {
            const cat = categoryOfValue(id);
            if (!cat) return skip('Value "' + id + '" does not exist (edit).');
            const item = pack.values.edit[id];
            if (item.name !== undefined) resultsMapping[cat][id] = item.name;
            if (item.definition !== undefined) descriptions[id] = item.definition;
            if (item.icon !== undefined) customIcons.set(id, item.icon);
            if (item.category !== undefined && item.category !== cat) {
                if (!has(resultsMapping, item.category)) return skip('Category "' + item.category + '" does not exist (value "' + id + '" moved to it).');
                resultsMapping[item.category][id] = resultsMapping[cat][id];
                delete resultsMapping[cat][id];
                if (!customValues.has(id) && !has(movedFrom, id)) movedFrom[id] = cat;
            }
        });

        // categories: remove (the values still in it go with it)
        pack.categories.remove.forEach(cat => {
            if (!has(resultsMapping, cat)) return skip('Category "' + cat + '" does not exist (remove).');
            Object.keys(resultsMapping[cat]).forEach(id => dropValue(id, cat));
            delete resultsMapping[cat];
            delete categoryTitles[cat];
            const at = categories.indexOf(cat);
            if (at >= 0) categories.splice(at, 1);
        });

        // ideologies: remove, rename, add, edit. A change names an ideology by the label it has in the site's data,
        // before any rename of the pack, so a renamed ideology is found again through the table of renames and
        // its old name is free for a new ideology
        const renamed = {};
        pack.ideologies.remove.forEach(label => {
            if (!labelSet().has(label)) return skip('Ideology "' + label + '" does not exist (remove).');
            Object.keys(labelMapping).forEach(key => { if (labelMapping[key] === label) delete labelMapping[key]; });
            delete labelColors[label];
            delete descriptions[label];
            delete ideologyScores[label];
            takeOutOfGroups(label);
        });
        Object.keys(pack.ideologies.edit).forEach(label => {
            const name = pack.ideologies.edit[label].rename;
            if (name === undefined || name === label) return;
            if (!labelSet().has(label)) return skip('Ideology "' + label + '" does not exist (rename).');
            if (labelSet().has(name)) return skip('Ideology "' + label + '" cannot be renamed: "' + name + '" already exists.');
            Object.keys(labelMapping).forEach(key => { if (labelMapping[key] === label) labelMapping[key] = name; });
            moveKey(labelColors, label, name);
            moveKey(descriptions, label, name);
            moveKey(ideologyScores, label, name);
            Object.keys(ideologyGroups).forEach(g => { ideologyGroups[g] = ideologyGroups[g].map(x => (x === label ? name : x)); });
            renamed[label] = name;
        });
        Object.keys(pack.ideologies.add).forEach(label => {
            if (labelSet().has(label)) return skip('Ideology "' + label + '" already exists.');
            const item = pack.ideologies.add[label];
            labelMapping[customKey(label)] = label;
            ideologyScores[label] = '';
            setStances(label, item.stances || {}, 'Ideology "' + label + '"');
            labelColors[label] = item.color || '#7a7a7a';
            descriptions[label] = item.definition || '';
            const group = item.group || 'Custom';
            if (!has(ideologyGroups, group)) ideologyGroups[group] = [];
            ideologyGroups[group].push(label);
        });
        Object.keys(pack.ideologies.edit).forEach(original => {
            const label = has(renamed, original) ? renamed[original] : original;
            if (!labelSet().has(label)) return skip('Ideology "' + original + '" does not exist (edit).');
            const item = pack.ideologies.edit[original];
            if (item.color !== undefined) labelColors[label] = item.color;
            if (item.definition !== undefined) descriptions[label] = item.definition;
            if (item.group !== undefined) {
                takeOutOfGroups(label);
                if (!has(ideologyGroups, item.group)) ideologyGroups[item.group] = [];
                ideologyGroups[item.group].push(label);
            }
            if (item.stances) setStances(label, item.stances, 'Ideology "' + label + '"');
        });
        cleanGroups();
        return { skipped };
    }

    // ---------------------------------------------------------------------------------------------
    // The question tree (questions_tree.json): a list of nodes per category. A node with options is a question, a
    // node without options is a value (what the person gets); the first question is where the category starts.
    // ---------------------------------------------------------------------------------------------
    // The questions of a category as they are with a pack's changes: [{ id, text, options: [{ text, next, color? }] }]
    function mergeQuestions(baseNodes, part) {
        part = part || {};
        let list = (baseNodes || []).filter(node => node && node.options).map(node => ({ id: node.id, text: node.text || '', options: node.options.map(o => Object.assign({}, o)) }));
        const removed = new Set(part.remove || []);
        list = list.filter(q => !removed.has(q.id));
        Object.keys(part.questions || {}).forEach(id => {
            const item = { id, text: part.questions[id].text, options: part.questions[id].options.map(o => Object.assign({}, o)) };
            const at = list.findIndex(q => q.id === id);
            if (at >= 0) list[at] = item; else list.push(item);
        });
        if (part.root) {
            const at = list.findIndex(q => q.id === part.root);
            if (at > 0) list.unshift(list.splice(at, 1)[0]);
        }
        return list;
    }
    // Takes out the options that go to nothing (isValue says whether an id is a value that exists), and then the
    // questions left without options, until nothing changes
    function normalizeQuestions(list, isValue) {
        let questions = list.map(q => ({ id: q.id, text: q.text, options: q.options.slice() }));
        for (;;) {
            const ids = new Set(questions.map(q => q.id));
            let changed = false;
            questions = questions.filter(q => {
                const options = q.options.filter(o => ids.has(o.next) || isValue(o.next));
                if (options.length !== q.options.length) { q.options = options; changed = true; }
                if (!options.length) { changed = true; return false; }
                return true;
            });
            if (!changed) return questions;
        }
    }
    // Applies the pack's changes to a tree that was read from questions_tree.json (changes it in place). The values
    // a pack removed or added are taken into account, so a question never leads to a value that does not exist.
    function applyTree(tree) {
        const skipped = [];
        if (active && typeof resultsMapping !== 'undefined') {
            const values = new Set();
            Object.keys(resultsMapping).forEach(cat => Object.keys(resultsMapping[cat]).forEach(id => values.add(id)));
            const isValue = id => values.has(id);
            const names = new Set(Object.keys(tree).concat(Object.keys(active.tree)));
            names.forEach(cat => {
                if (!has(resultsMapping, cat)) { delete tree[cat]; return; }
                const part = has(active.tree, cat) ? active.tree[cat] : null;
                let list = mergeQuestions(tree[cat], part);
                list = list.filter(q => {
                    const fromPack = part && part.questions && has(part.questions, q.id);
                    if (fromPack && isValue(q.id)) { skipped.push('Question "' + q.id + '" has the id of a value.'); return false; }
                    return true;
                });
                list = normalizeQuestions(list, isValue);
                const ids = new Set(list.map(q => q.id));
                const leaves = [];
                const seen = new Set();
                list.forEach(q => q.options.forEach(o => {
                    if (!ids.has(o.next) && !seen.has(o.next)) { seen.add(o.next); leaves.push({ id: o.next }); }
                }));
                tree[cat] = list.concat(leaves);
            });
        }
        report.skipped.push(...skipped);
        return { skipped };
    }
    function fetchBaseTree() {
        return fetch('questions_tree.json').then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        });
    }
    // The tree as the quiz plays it: with the pack's changes in custom mode
    function loadTree() {
        return fetchBaseTree().then(tree => { if (isCustom()) applyTree(tree); return tree; });
    }

    // ---------------------------------------------------------------------------------------------
    // The saved pack, file export and the icon of a value
    // ---------------------------------------------------------------------------------------------
    function storedPack() {
        const text = read(PACK_KEY);
        if (!text) return null;
        const result = parseText(text);
        return result.pack;
    }
    function savePack(pack) { return write(PACK_KEY, JSON.stringify(pack)); }
    function clearPack() { write(PACK_KEY, null); }

    const text = pack => JSON.stringify(pack, null, 2) + '\n';
    function fileName(pack) {
        const slug = String(pack.name || 'pack').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'pack';
        return 'hypervalues-' + slug + '.json';
    }
    function download(pack) {
        const blob = new Blob([text(pack)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName(pack);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // What a pack changes, as short text
    function summary(pack) {
        const count = object => Object.keys(object).length;
        const added = Object.keys(pack.values.add).reduce((n, cat) => n + count(pack.values.add[cat]), 0);
        const parts = [];
        if (added) parts.push('+' + added + ' values');
        if (count(pack.values.edit)) parts.push(count(pack.values.edit) + ' values changed');
        if (pack.values.remove.length) parts.push('\u2212' + pack.values.remove.length + ' values');
        if (count(pack.ideologies.add)) parts.push('+' + count(pack.ideologies.add) + ' ideologies');
        if (count(pack.ideologies.edit)) parts.push(count(pack.ideologies.edit) + ' ideologies changed');
        if (pack.ideologies.remove.length) parts.push('\u2212' + pack.ideologies.remove.length + ' ideologies');
        if (count(pack.categories.add)) parts.push('+' + count(pack.categories.add) + ' categories');
        if (pack.categories.remove.length) parts.push('\u2212' + pack.categories.remove.length + ' categories');
        const questions = Object.keys(pack.tree).reduce((n, cat) => n + count(pack.tree[cat].questions) + pack.tree[cat].remove.length + (pack.tree[cat].root ? 1 : 0), 0);
        if (questions) parts.push(questions + ' question changes');
        return parts.length ? parts.join(', ') : 'no changes';
    }

    // The picture of a value: the PNG a pack gave it, or its file in icons/ (in the category it came from), or for a
    // value a pack added without a picture a gray circle with its first letter
    function iconUrl(category, id) {
        if (customIcons.has(id)) return svgUri(customIcons.get(id));
        if (!customValues.has(id)) return 'icons/' + (has(movedFrom, id) ? movedFrom[id] : category) + '/' + id + '.svg';
        const name = (typeof resultsMapping !== 'undefined' && resultsMapping[category] && resultsMapping[category][id]) || id;
        const letter = (Array.from(name.trim())[0] || '?').toUpperCase().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#8b949e"/>' +
            '<text x="50" y="50" font-family="sans-serif" font-size="52" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">' + letter + '</text></svg>';
        return svgUri(svg);
    }

    // ---------------------------------------------------------------------------------------------
    // On load: with custom mode on, apply the saved pack
    // ---------------------------------------------------------------------------------------------
    const report = { skipped: [], errors: [] };
    let active = null;
    // (the editor sets HV_NO_PACK before this script, because it works from the site's own data)
    const keepOwnData = typeof HV_NO_PACK !== 'undefined' && HV_NO_PACK === true;
    if (isCustom() && !keepOwnData && typeof resultsMapping !== 'undefined') {
        const saved = read(PACK_KEY);
        if (saved) {
            const result = parseText(saved);
            if (result.errors.length) {
                report.errors = result.errors;
            } else {
                try {
                    report.skipped = apply(result.pack).skipped;
                    active = result.pack;
                } catch (e) {
                    report.errors = ['The saved pack could not be applied.'];
                }
            }
        }
    }

    return {
        FORMAT, report, isCustom, setCustom, emptyPack, validate, parseText, apply, summary, iconUrl, cleanSvg, svgUri,
        mergeQuestions, normalizeQuestions, applyTree, fetchBaseTree, loadTree,
        storedPack, savePack, clearPack, text, fileName, download,
        active: () => active,
        isCustomValue: id => customValues.has(id),
        hasCustomIcon: id => customIcons.has(id)
    };
})();
