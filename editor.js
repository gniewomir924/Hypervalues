// The editor of Custom Pages (editor.html): create and change values and ideologies and save the changes as a pack
// (see pack.js). It shows the site's own data (data.js, loaded without the pack) with the pack's changes on top,
// and every change goes through HVPack.validate before it is saved, so what it saves is always a valid pack.
(function () {
    if (!HVPack.isCustom()) { location.replace('index.html'); return; }

    const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
    const clone = x => JSON.parse(JSON.stringify(x));
    const round2 = n => Math.round(n * 100) / 100;
    const fmt = n => { const r = round2(n); return (r > 0 ? '+' : (r < 0 ? '\u2212' : '')) + Math.abs(r).toFixed(2); };

    let draft = HVPack.storedPack() || HVPack.emptyPack('My pack');
    let tab = 'values';
    let valueCategory = categories[0];
    let form = null;              // the form open in the values tab: { type: 'add' } or { type: 'edit', id }
    let openIdeology = null;      // the ideology being edited, or null for the list
    let ideologyForm = false;     // the form for a new ideology is open
    let search = '';
    let baseTree = null;          // questions_tree.json as the site has it (read once)
    let baseTreeFailed = false;
    let treeCategory = null;
    let questionForm = false;     // the form for a new question is open

    const tabsHolder = document.getElementById('editor-tabs');
    const status = document.getElementById('editor-status');
    const body = document.getElementById('editor-body');

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function button(text, onClick, className) {
        const node = el('button', className || 'editor-button', text);
        node.type = 'button';
        node.onclick = onClick;
        return node;
    }
    function field(labelText, control) {
        const wrap = el('label', 'editor-field');
        wrap.appendChild(el('span', 'editor-field-label', labelText));
        wrap.appendChild(control);
        return wrap;
    }
    function textInput(value, unused, label) {
        const input = el('input', 'editor-input');
        input.type = 'text';
        input.value = value;
        input.setAttribute('aria-label', label);
        return input;
    }
    function say(message, bad) {
        status.textContent = message;
        status.className = 'editor-status' + (bad ? ' editor-status-bad' : '');
    }

    // ---------------------------------------------------------------------------------------------
    // Making a change: on a copy, checked, then saved. Returns false (and says why) if it is not allowed.
    // ---------------------------------------------------------------------------------------------
    function prune(pack) {
        Object.keys(pack.values.add).forEach(cat => { if (!Object.keys(pack.values.add[cat]).length) delete pack.values.add[cat]; });
        Object.keys(pack.values.edit).forEach(id => { if (!Object.keys(pack.values.edit[id]).length) delete pack.values.edit[id]; });
        Object.keys(pack.tree).forEach(cat => {
            const part = pack.tree[cat];
            if (!Object.keys(part.questions).length && !part.remove.length && !part.root) delete pack.tree[cat];
        });
        Object.keys(pack.ideologies.edit).forEach(label => {
            const item = pack.ideologies.edit[label];
            if (item.stances && !Object.keys(item.stances).length) delete item.stances;
            if (!Object.keys(item).length) delete pack.ideologies.edit[label];
        });
    }
    function change(mutate, rerender) {
        const copy = clone(draft);
        mutate(copy);
        prune(copy);
        const result = HVPack.validate(copy);
        if (result.errors.length) { say(result.errors[0], true); return false; }
        if (!HVPack.savePack(result.pack)) { say('The pack could not be saved in this browser.', true); return false; }
        draft = result.pack;
        say('Saved.', false);
        if (rerender !== false) render();
        return true;
    }

    // ---------------------------------------------------------------------------------------------
    // The data as it is with the pack's changes
    // ---------------------------------------------------------------------------------------------
    const baseCategories = categories.slice();
    const baseValueCategory = {};
    baseCategories.forEach(cat => Object.keys(resultsMapping[cat] || {}).forEach(id => { baseValueCategory[id] = cat; }));
    const baseLabels = (function () {
        const labels = [];
        const seen = new Set();
        const add = label => { if (!seen.has(label)) { seen.add(label); labels.push(label); } };
        Object.keys(ideologyGroups).forEach(group => ideologyGroups[group].forEach(add));
        Object.keys(labelMapping).forEach(key => add(labelMapping[key]));
        return labels;
    })();
    const baseGroupOf = {};
    Object.keys(ideologyGroups).forEach(group => ideologyGroups[group].forEach(label => { baseGroupOf[label] = group; }));

    const isCatRemoved = cat => draft.categories.remove.includes(cat);
    const allCategories = () => baseCategories.concat(Object.keys(draft.categories.add));
    const effCategories = () => allCategories().filter(cat => !isCatRemoved(cat));
    function catTitle(cat) {
        if (own(draft.categories.rename, cat)) return draft.categories.rename[cat];
        if (own(draft.categories.add, cat)) return draft.categories.add[cat];
        return categoryTitles[cat] || cat;
    }
    // Every value (also the removed ones) with the category it is in now: { id, cat, baseCat (null for a new value), ... }
    function allValues() {
        const list = [];
        baseCategories.forEach(baseCat => Object.keys(resultsMapping[baseCat] || {}).forEach(id => {
            const edit = draft.values.edit[id] || {};
            list.push({
                id, baseCat, cat: edit.category !== undefined ? edit.category : baseCat, custom: false,
                removed: draft.values.remove.includes(id),
                name: edit.name !== undefined ? edit.name : resultsMapping[baseCat][id],
                definition: edit.definition !== undefined ? edit.definition : (descriptions[id] || ''),
                icon: edit.icon || null,
                changed: Object.keys(edit).length > 0
            });
        }));
        Object.keys(draft.values.add).forEach(cat => Object.keys(draft.values.add[cat]).forEach(id => {
            const item = draft.values.add[cat][id];
            list.push({ id, baseCat: null, cat, custom: true, removed: false, name: item.name, definition: item.definition, icon: item.icon || null, changed: false });
        }));
        return list;
    }
    // The values of a category in the order a page shows them: the site's own, then new ones, then those moved in
    function effValues(cat) {
        const rank = v => (v.custom ? 1 : (v.baseCat === cat ? 0 : 2));
        return allValues().filter(v => v.cat === cat).map((v, i) => ({ v, i })).sort((x, y) => rank(x.v) - rank(y.v) || x.i - y.i).map(x => x.v);
    }
    function valueIdTaken(id) {
        if (own(baseValueCategory, id) || id in Object.prototype) return true;
        return Object.keys(draft.values.add).some(cat => own(draft.values.add[cat], id));
    }
    function slug(text, fallback) {
        let base = text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40).replace(/_+$/, '');
        if (!base) base = fallback;
        if (!/^[a-z]/.test(base)) base = 'v_' + base;
        return base;
    }
    function newValueId(name) {
        const base = slug(name, 'value');
        let id = base, n = 2;
        while (valueIdTaken(id)) id = base + '_' + (n++);
        return id;
    }
    function newCategoryId(title) {
        const base = slug(title, 'category');
        let id = base, n = 2;
        while (own(resultsMapping, id) || own(draft.categories.add, id) || id in Object.prototype) id = base + '_' + (n++);
        return id;
    }

    // A picture is an SVG file. It is not kept as it is: HVPack.cleanSvg rebuilds it from a short list of safe
    // parts (shapes, colors, gradients, clip paths and color filters) and drops the rest (scripts, links, images,
    // style sheets, animations, Inkscape's own data), so what is saved cannot run anything
    function readSvgFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('The file could not be read.'));
            reader.onload = () => {
                const result = HVPack.cleanSvg(String(reader.result));
                if (result.svg) resolve(result); else reject(new Error(result.error));
            };
            reader.readAsText(file);
        });
    }

    const isCustomLabel = label => own(draft.ideologies.add, label);
    // The name an ideology shows (an official one can be renamed in the pack; its key stays the official label)
    const shownName = label => (!isCustomLabel(label) && (draft.ideologies.edit[label] || {}).rename) || label;
    const isRemovedLabel = label => draft.ideologies.remove.includes(label);
    function effLabels() { return baseLabels.concat(Object.keys(draft.ideologies.add)); }
    function parseBaseStances(label) {
        const map = new Map();
        String(ideologyScores[label] || '').split('|').forEach(part => {
            const i = part.lastIndexOf(':');
            const n = Number(part.slice(i + 1));
            if (i > 0 && Number.isFinite(n) && n !== 0) map.set(part.slice(0, i), n);
        });
        return map;
    }
    function effStances(label) {
        if (isCustomLabel(label)) return new Map(Object.entries(draft.ideologies.add[label].stances || {}));
        const map = parseBaseStances(label);
        const edit = (draft.ideologies.edit[label] || {}).stances || {};
        Object.keys(edit).forEach(id => { if (edit[id] === null) map.delete(id); else map.set(id, edit[id]); });
        return map;
    }
    function effGroup(label) {
        if (isCustomLabel(label)) return draft.ideologies.add[label].group || 'Custom';
        const edit = draft.ideologies.edit[label] || {};
        return edit.group !== undefined ? edit.group : (baseGroupOf[label] || 'Other');
    }
    function effColor(label) {
        const item = isCustomLabel(label) ? draft.ideologies.add[label] : (draft.ideologies.edit[label] || {});
        return item.color !== undefined ? item.color : (labelColors[label] || '#7a7a7a');
    }
    function effDefinition(label) {
        const item = isCustomLabel(label) ? draft.ideologies.add[label] : (draft.ideologies.edit[label] || {});
        return item.definition !== undefined ? item.definition : (descriptions[label] || '');
    }
    function groupNames() {
        const names = new Set(Object.keys(ideologyGroups));
        effLabels().forEach(label => names.add(effGroup(label)));
        return Array.from(names);
    }

    // ---------------------------------------------------------------------------------------------
    // Changes to the pack (each takes the copy of the pack that change() hands over)
    // ---------------------------------------------------------------------------------------------
    function dropStanceReferences(pack, id) {
        Object.keys(pack.ideologies.add).forEach(label => { if (pack.ideologies.add[label].stances) delete pack.ideologies.add[label].stances[id]; });
        Object.keys(pack.ideologies.edit).forEach(label => { if (pack.ideologies.edit[label].stances) delete pack.ideologies.edit[label].stances[id]; });
    }
    function saveValueFields(pack, value, name, definition, icon, category) {
        if (value.custom) {
            const entry = { name, definition };
            if (icon) entry.icon = icon;
            delete pack.values.add[value.cat][value.id];
            (pack.values.add[category] || (pack.values.add[category] = {}))[value.id] = entry;
            return;
        }
        const edit = pack.values.edit[value.id] || (pack.values.edit[value.id] = {});
        if (name === resultsMapping[value.baseCat][value.id]) delete edit.name; else edit.name = name;
        if (definition === (descriptions[value.id] || '')) delete edit.definition; else edit.definition = definition;
        if (icon) edit.icon = icon; else delete edit.icon;
        if (category === value.baseCat) delete edit.category; else edit.category = category;
    }
    function setStance(pack, label, id, stance) {      // stance: a number from -1 to 1, or null for none
        if (isCustomLabel(label)) {
            const item = pack.ideologies.add[label];
            item.stances = item.stances || {};
            if (stance === null) delete item.stances[id]; else item.stances[id] = stance;
            return;
        }
        const edit = pack.ideologies.edit[label] || (pack.ideologies.edit[label] = {});
        edit.stances = edit.stances || {};
        const base = parseBaseStances(label).get(id);
        if (stance === null) {
            if (base === undefined) delete edit.stances[id]; else edit.stances[id] = null;
        } else if (base !== undefined && round2(base) === stance) {
            delete edit.stances[id];
        } else {
            edit.stances[id] = stance;
        }
    }
    function setIdeologyField(pack, label, name, value) {
        if (isCustomLabel(label)) { pack.ideologies.add[label][name] = value; return; }
        const edit = pack.ideologies.edit[label] || (pack.ideologies.edit[label] = {});
        const base = name === 'group' ? (baseGroupOf[label] || 'Other')
            : name === 'rename' ? label
            : name === 'color' ? (labelColors[label] || '#7a7a7a').slice(0, 7)
            : (descriptions[label] || '');
        const same = name === 'color' ? value.toLowerCase() === base.toLowerCase() : value === base;
        if (same) delete edit[name]; else edit[name] = value;
    }

    // ---------------------------------------------------------------------------------------------
    // Values tab
    // ---------------------------------------------------------------------------------------------
    function valueForm(value) {
        const box = el('div', 'editor-form');
        const name = textInput(value ? value.name : '', 80, 'Name of the value');
        const category = el('select', 'editor-input');
        category.setAttribute('aria-label', 'Category of the value');
        const here = value ? value.cat : valueCategory;
        effCategories().forEach(cat => {
            const option = el('option', '', catTitle(cat));
            option.value = cat;
            if (cat === here) option.selected = true;
            category.appendChild(option);
        });
        const definition = el('textarea', 'editor-input editor-textarea');
        definition.value = value ? value.definition : '';
        definition.rows = 5;
        definition.setAttribute('aria-label', 'Definition of the value');

        let icon = value ? value.icon : null;
        const preview = el('img', 'editor-icon-preview');
        preview.alt = '';
        preview.onerror = () => { preview.style.display = 'none'; };
        function showIcon() {
            const src = icon ? HVPack.svgUri(icon) : (value && !value.custom ? 'icons/' + value.baseCat + '/' + value.id + '.svg' : '');
            if (src) { preview.style.display = ''; preview.src = src; } else { preview.style.display = 'none'; }
        }
        showIcon();
        const file = el('input', 'editor-file');
        file.type = 'file';
        file.accept = '.svg,image/svg+xml';
        file.setAttribute('aria-label', 'Choose an SVG picture for the value');
        file.onchange = () => {
            const chosen = file.files && file.files[0];
            file.value = '';
            if (!chosen) return;
            readSvgFile(chosen).then(result => {
                icon = result.svg;
                showIcon();
                say(result.dropped ? 'Picture added. ' + result.dropped + ' parts that are not supported (scripts, links, images, Inkscape data...) were left out.' : 'Picture added.', false);
            }, error => say(error.message, true));
        };
        const iconRow = el('div', 'editor-row');
        iconRow.appendChild(preview);
        iconRow.appendChild(file);
        iconRow.appendChild(button('Remove picture', () => { icon = null; showIcon(); }, 'editor-button editor-small'));

        box.appendChild(field('Name', name));
        box.appendChild(field('Category', category));
        box.appendChild(field('Definition (also used by the model to guess what ideologies think of it)', definition));
        box.appendChild(field('Picture (an SVG file; without one a new value gets its first letter)', iconRow));
        const row = el('div', 'editor-row');
        row.appendChild(button('Save', () => {
            const text = name.value.trim();
            if (!text) { say('The value needs a name.', true); return; }
            const ok = change(pack => {
                if (value) {
                    saveValueFields(pack, value, text, definition.value.trim(), icon, category.value);
                } else {
                    const entry = { name: text, definition: definition.value.trim() };
                    if (icon) entry.icon = icon;
                    (pack.values.add[category.value] || (pack.values.add[category.value] = {}))[newValueId(text)] = entry;
                }
            }, false);
            if (ok) { form = null; valueCategory = category.value; render(); }
        }));
        row.appendChild(button('Cancel', () => { form = null; render(); }));
        box.appendChild(row);
        return box;
    }
    function valueThumb(value) {
        const src = value.icon ? HVPack.svgUri(value.icon) : (value.custom ? '' : 'icons/' + value.baseCat + '/' + value.id + '.svg');
        if (!src) return el('span', 'editor-icon editor-letter', (Array.from(value.name)[0] || '?').toUpperCase());
        const img = el('img', 'editor-icon');
        img.alt = '';
        img.src = src;
        img.onerror = () => { img.style.visibility = 'hidden'; };
        return img;
    }
    function renderValues() {
        const cats = effCategories();
        if (!cats.length) {
            body.appendChild(el('p', 'editor-note', 'There are no categories, so there are no values. Add a category in the Categories tab, or restore one.'));
            return;
        }
        if (!cats.includes(valueCategory)) valueCategory = cats[0];
        const select = el('select', 'editor-input');
        select.setAttribute('aria-label', 'Category');
        cats.forEach(cat => {
            const option = el('option', '', catTitle(cat));
            option.value = cat;
            if (cat === valueCategory) option.selected = true;
            select.appendChild(option);
        });
        select.onchange = () => { valueCategory = select.value; form = null; render(); };
        const top = el('div', 'editor-row');
        top.appendChild(select);
        top.appendChild(button('Add value', () => { form = { type: 'add' }; render(); }));
        body.appendChild(top);

        const values = effValues(valueCategory);
        if (form && form.type === 'add') body.appendChild(valueForm(null));
        if (!values.length && !form) body.appendChild(el('p', 'editor-note', 'This category has no values.'));

        values.forEach(value => {
            const row = el('div', 'editor-item' + (value.removed ? ' editor-removed' : ''));
            row.appendChild(valueThumb(value));
            row.appendChild(el('span', 'editor-item-name', value.name));
            if (value.custom) row.appendChild(el('span', 'editor-badge', 'new'));
            else if (value.removed) row.appendChild(el('span', 'editor-badge', 'removed'));
            else if (value.changed) row.appendChild(el('span', 'editor-badge', 'changed'));
            const actions = el('span', 'editor-actions');
            if (value.removed) {
                actions.appendChild(button('Restore', () => change(pack => { pack.values.remove = pack.values.remove.filter(id => id !== value.id); })));
            } else {
                actions.appendChild(button('Edit', () => { form = { type: 'edit', id: value.id }; render(); }));
                actions.appendChild(button(value.custom ? 'Delete' : 'Remove', () => {
                    if (!confirm((value.custom ? 'Delete' : 'Remove') + ' \u201c' + value.name + '\u201d? Stances of ideologies on it are dropped from the pack.')) return;
                    change(pack => {
                        if (value.custom) {
                            delete pack.values.add[value.cat][value.id];
                        } else {
                            pack.values.remove.push(value.id);
                            delete pack.values.edit[value.id];
                        }
                        dropStanceReferences(pack, value.id);
                    });
                }));
            }
            row.appendChild(actions);
            body.appendChild(row);
            if (form && form.type === 'edit' && form.id === value.id) body.appendChild(valueForm(value));
        });
    }

    // ---------------------------------------------------------------------------------------------
    // Ideologies tab
    // ---------------------------------------------------------------------------------------------
    function groupsDatalist() {
        const datalist = el('datalist');
        datalist.id = 'editor-groups';
        groupNames().forEach(name => { const option = document.createElement('option'); option.value = name; datalist.appendChild(option); });
        return datalist;
    }
    function ideologyAddForm() {
        const box = el('div', 'editor-form');
        const label = textInput('', 80, 'Name of the ideology');
        const group = textInput('Custom', 60, 'Group');
        group.setAttribute('list', 'editor-groups');
        const color = el('input', 'editor-color');
        color.type = 'color';
        color.value = '#2a9d8f';
        color.setAttribute('aria-label', 'Color');
        const definition = el('textarea', 'editor-input editor-textarea');
        definition.rows = 5;
        definition.setAttribute('aria-label', 'Definition of the ideology');
        box.appendChild(field('Name', label));
        box.appendChild(field('Group', group));
        box.appendChild(field('Color', color));
        box.appendChild(field('Definition (the model also reads it to guess the stances you do not set)', definition));
        const row = el('div', 'editor-row');
        row.appendChild(button('Create', () => {
            const text = label.value.trim();
            if (!text) { say('The ideology needs a name.', true); return; }
            if (effLabels().some(k => shownName(k) === text)) { say('An ideology with this name already exists.', true); return; }
            const ok = change(pack => {
                pack.ideologies.add[text] = { group: group.value.trim() || 'Custom', color: color.value, definition: definition.value.trim(), stances: {} };
            }, false);
            if (ok) { ideologyForm = false; openIdeology = text; render(); }
        }));
        row.appendChild(button('Cancel', () => { ideologyForm = false; render(); }));
        box.appendChild(row);
        return box;
    }
    function renderIdeologyList() {
        const top = el('div', 'editor-row');
        const find = textInput(search, 60, 'Search ideologies');
        find.placeholder = 'Search';
        find.oninput = () => { search = find.value; renderList(); };
        top.appendChild(find);
        top.appendChild(button('Add ideology', () => { ideologyForm = true; render(); }));
        body.appendChild(top);
        body.appendChild(groupsDatalist());
        if (ideologyForm) body.appendChild(ideologyAddForm());
        const listHolder = el('div', 'editor-ideologies');
        body.appendChild(listHolder);
        function renderList() {
            listHolder.textContent = '';
            const query = search.trim().toLowerCase();
            const groups = {};
            groupNames().forEach(name => { groups[name] = []; });
            effLabels().forEach(label => {
                if (query && !shownName(label).toLowerCase().includes(query)) return;
                (groups[effGroup(label)] || (groups[effGroup(label)] = [])).push(label);
            });
            Object.keys(groups).forEach(name => {
                if (!groups[name].length) return;
                listHolder.appendChild(el('h3', 'editor-cat', name));
                const flex = el('div', 'editor-bubbles');
                groups[name].forEach(label => {
                    const bubble = el('button', 'editor-bubble' + (isRemovedLabel(label) ? ' editor-removed' : ''), shownName(label));
                    bubble.type = 'button';
                    bubble.style.backgroundColor = effColor(label).slice(0, 7);
                    bubble.onclick = () => { openIdeology = label; render(); };
                    flex.appendChild(bubble);
                });
                listHolder.appendChild(flex);
            });
            if (!listHolder.childNodes.length) listHolder.appendChild(el('p', 'editor-note', 'No ideology matches.'));
        }
        renderList();
    }

    function stanceRow(label, value, current) {
        const row = el('div', 'editor-stance' + (current !== undefined ? ' editor-has-stance' : ''));
        row.appendChild(el('span', 'editor-stance-name', value.name));
        const range = el('input', 'editor-range');
        range.type = 'range';
        range.min = -100;
        range.max = 100;
        range.step = 5;
        range.value = current === undefined ? 0 : Math.round(current * 100);
        range.setAttribute('aria-label', 'Stance of ' + shownName(label) + ' on ' + value.name);
        const readout = el('span', 'editor-readout', current === undefined ? '\u2014' : fmt(current));
        const clear = button('Clear', () => {
            if (!change(pack => setStance(pack, label, value.id, null), false)) return;
            range.value = 0;
            readout.textContent = '\u2014';
            row.classList.remove('editor-has-stance');
        }, 'editor-button editor-small');
        range.oninput = () => {
            const stance = round2(Number(range.value) / 100);
            if (stance === 0) { clear.onclick(); return; }
            if (!change(pack => setStance(pack, label, value.id, stance), false)) return;
            readout.textContent = fmt(stance);
            row.classList.add('editor-has-stance');
        };
        row.appendChild(range);
        row.appendChild(readout);
        row.appendChild(clear);
        return row;
    }
    function renderIdeology(label) {
        const removed = isRemovedLabel(label);
        const custom = isCustomLabel(label);
        body.appendChild(button('\u2190 All ideologies', () => { openIdeology = null; render(); }));
        const head = el('h2', 'editor-title', shownName(label));
        head.style.borderLeft = '10px solid ' + effColor(label).slice(0, 7);
        body.appendChild(head);
        if (custom) body.appendChild(el('span', 'editor-badge', 'new'));
        if (removed) {
            body.appendChild(el('p', 'editor-note', 'This ideology is removed from your pages.'));
            body.appendChild(button('Restore', () => change(pack => { pack.ideologies.remove = pack.ideologies.remove.filter(x => x !== label); })));
            return;
        }

        const box = el('div', 'editor-form');
        const nameInput = textInput(shownName(label), 80, 'Name of the ideology');
        nameInput.onchange = () => {
            const text = nameInput.value.trim();
            if (!text || text === shownName(label)) { nameInput.value = shownName(label); return; }
            if (effLabels().some(k => k !== label && shownName(k) === text)) {
                say('An ideology with this name already exists.', true);
                nameInput.value = shownName(label);
                return;
            }
            if (custom) {
                const ok = change(pack => { pack.ideologies.add[text] = pack.ideologies.add[label]; delete pack.ideologies.add[label]; }, false);
                if (ok) { openIdeology = text; render(); } else nameInput.value = shownName(label);
            } else if (change(pack => setIdeologyField(pack, label, 'rename', text), false)) {
                head.textContent = text;
            } else {
                nameInput.value = shownName(label);
            }
        };
        const group = textInput(effGroup(label), 60, 'Group');
        group.setAttribute('list', 'editor-groups');
        group.onchange = () => {
            const text = group.value.trim();
            if (!text) { group.value = effGroup(label); return; }
            change(pack => setIdeologyField(pack, label, 'group', text), false);
        };
        const color = el('input', 'editor-color');
        color.type = 'color';
        color.value = effColor(label).slice(0, 7);
        color.setAttribute('aria-label', 'Color');
        color.onchange = () => {
            if (change(pack => setIdeologyField(pack, label, 'color', color.value), false)) head.style.borderLeftColor = color.value;
        };
        const definition = el('textarea', 'editor-input editor-textarea');
        definition.value = effDefinition(label);
        definition.rows = 6;
        definition.setAttribute('aria-label', 'Definition of ' + shownName(label));
        definition.onchange = () => change(pack => setIdeologyField(pack, label, 'definition', definition.value.trim()), false);
        box.appendChild(field('Name', nameInput));
        box.appendChild(field('Group', group));
        box.appendChild(field('Color', color));
        box.appendChild(field('Definition', definition));
        body.appendChild(box);

        body.appendChild(groupsDatalist());

        body.appendChild(el('h2', 'editor-title', 'Stances'));
        body.appendChild(el('p', 'editor-note', 'How much this ideology matches (+1) or opposes (\u22121) each value. \u201cClear\u201d means its definition does not say anything about it.'));
        const stances = effStances(label);
        effCategories().forEach(cat => {
            const values = effValues(cat).filter(v => !v.removed);
            if (!values.length) return;
            body.appendChild(el('h3', 'editor-cat', catTitle(cat)));
            values.forEach(value => body.appendChild(stanceRow(label, value, stances.get(value.id))));
        });

        const danger = el('div', 'editor-row');
        danger.appendChild(button(custom ? 'Delete ideology' : 'Remove ideology', () => {
            if (!confirm((custom ? 'Delete' : 'Remove') + ' \u201c' + shownName(label) + '\u201d?')) return;
            const ok = change(pack => {
                if (custom) {
                    delete pack.ideologies.add[label];
                } else {
                    pack.ideologies.remove.push(label);
                    delete pack.ideologies.edit[label];
                }
            }, false);
            if (ok) { openIdeology = null; render(); }
        }));
        body.appendChild(danger);
    }

    // ---------------------------------------------------------------------------------------------
    // Questions tab (the question tree of a category)
    // ---------------------------------------------------------------------------------------------
    const liveValueIds = () => new Set(allValues().filter(v => !v.removed && effCategories().includes(v.cat)).map(v => v.id));
    // The questions of a category as the quiz will play them, the first one first
    function effQuestions(cat) {
        const merged = HVPack.mergeQuestions((baseTree && baseTree[cat]) || [], draft.tree[cat] || {});
        const live = liveValueIds();
        return HVPack.normalizeQuestions(merged, id => live.has(id));
    }
    const baseQuestion = (cat, id) => ((baseTree && baseTree[cat]) || []).find(n => n.id === id && n.options) || null;
    const sameQuestion = (a, b) => a.text === b.text && JSON.stringify(a.options.map(o => ({ text: o.text, next: o.next, color: o.color }))) ===
        JSON.stringify(b.options.map(o => ({ text: o.text, next: o.next, color: o.color })));
    const treePart = (pack, cat) => pack.tree[cat] || (pack.tree[cat] = { questions: {}, remove: [] });
    function storeQuestion(pack, cat, q) {
        const part = treePart(pack, cat);
        const base = baseQuestion(cat, q.id);
        if (base && sameQuestion(base, q)) delete part.questions[q.id];
        else part.questions[q.id] = { text: q.text, options: q.options.map(o => { const entry = { text: o.text, next: o.next }; if (o.color) entry.color = o.color; return entry; }) };
        part.remove = part.remove.filter(id => id !== q.id);
    }
    function deleteQuestion(pack, cat, id) {
        const part = treePart(pack, cat);
        delete part.questions[id];
        if (baseQuestion(cat, id) && !part.remove.includes(id)) part.remove.push(id);
        if (part.root === id) delete part.root;
    }
    function setRoot(pack, cat, id) {
        const part = treePart(pack, cat);
        const first = ((baseTree && baseTree[cat]) || []).find(n => n.options);
        if (first && first.id === id) delete part.root; else part.root = id;
    }
    function takenIds() {
        const ids = new Set(allValues().map(v => v.id));
        Object.keys(baseTree || {}).forEach(cat => baseTree[cat].forEach(n => ids.add(n.id)));
        Object.keys(draft.tree).forEach(cat => Object.keys(draft.tree[cat].questions).forEach(id => ids.add(id)));
        return ids;
    }
    function newQuestionId(text) {
        const taken = takenIds();
        const base = slug(text, 'question');
        let id = base, n = 2;
        while (taken.has(id) || id in Object.prototype) id = base + '_' + (n++);
        return id;
    }
    function updateQuestion(cat, id, mutate, rerender) {
        return change(pack => {
            const q = effQuestions(cat).find(x => x.id === id);
            if (!q) return;
            mutate(q);
            storeQuestion(pack, cat, q);
        }, rerender);
    }
    const shorten = (text, n) => (text.length > n ? text.slice(0, n - 1) + '\u2026' : text);

    // A list of what an answer can lead to: another question, or a value (which is what the person gets)
    function targetSelect(cat, selfId, current, label) {
        const select = el('select', 'editor-input editor-target');
        select.setAttribute('aria-label', label);
        const questions = effQuestions(cat).filter(q => q.id !== selfId);
        if (questions.length) {
            const group = el('optgroup');
            group.label = 'Another question';
            questions.forEach(q => { const option = el('option', '', shorten(q.text, 70)); option.value = q.id; group.appendChild(option); });
            select.appendChild(group);
        }
        effCategories().forEach(c => {
            const values = effValues(c).filter(v => !v.removed);
            if (!values.length) return;
            const group = el('optgroup');
            group.label = 'Value: ' + catTitle(c);
            values.forEach(v => { const option = el('option', '', v.name); option.value = v.id; group.appendChild(option); });
            select.appendChild(group);
        });
        if (current) select.value = current;
        return select;
    }

    function questionCard(cat, q, isFirst) {
        const card = el('div', 'editor-question');
        const head = el('div', 'editor-row editor-question-head');
        if (isFirst) head.appendChild(el('span', 'editor-badge', 'first question'));
        const part = draft.tree[cat] || { questions: {}, remove: [] };
        const base = baseQuestion(cat, q.id);
        if (!base) head.appendChild(el('span', 'editor-badge', 'new'));
        else if (own(part.questions, q.id)) head.appendChild(el('span', 'editor-badge', 'changed'));
        const actions = el('span', 'editor-actions');
        if (!isFirst) actions.appendChild(button('Make first', () => change(pack => setRoot(pack, cat, q.id)), 'editor-button editor-small'));
        actions.appendChild(button(base ? 'Remove' : 'Delete', () => {
            if (!confirm((base ? 'Remove' : 'Delete') + ' this question? Answers that lead to it are taken away.')) return;
            change(pack => {
                if (!base) {           // a question of the pack cannot be restored, so the answers that led to it go too
                    effQuestions(cat).forEach(other => {
                        if (other.id === q.id) return;
                        const options = other.options.filter(o => o.next !== q.id);
                        if (options.length && options.length !== other.options.length) storeQuestion(pack, cat, { id: other.id, text: other.text, options });
                    });
                }
                deleteQuestion(pack, cat, q.id);
            });
        }, 'editor-button editor-small'));
        head.appendChild(actions);
        card.appendChild(head);

        const text = el('textarea', 'editor-input editor-textarea');
        text.value = q.text;
        text.rows = 2;
        text.setAttribute('aria-label', 'Question');
        text.onchange = () => {
            const value = text.value.trim();
            if (!value) { text.value = q.text; say('The question needs a text.', true); return; }
            if (!updateQuestion(cat, q.id, f => { f.text = value; }, false)) text.value = q.text;
        };
        card.appendChild(text);

        q.options.forEach((option, index) => {
            const row = el('div', 'editor-option');
            const answer = textInput(option.text, 400, 'Answer ' + (index + 1));
            answer.onchange = () => {
                const value = answer.value.trim();
                if (!value) { answer.value = option.text; say('The answer needs a text.', true); return; }
                if (!updateQuestion(cat, q.id, f => { f.options[index].text = value; }, false)) answer.value = option.text;
            };
            const target = targetSelect(cat, q.id, option.next, 'Where answer ' + (index + 1) + ' leads');
            target.onchange = () => { if (!updateQuestion(cat, q.id, f => { f.options[index].next = target.value; }, false)) target.value = option.next; };
            row.appendChild(answer);
            row.appendChild(el('span', 'editor-arrow', '\u2192'));
            row.appendChild(target);
            const remove = button('\u2715', () => updateQuestion(cat, q.id, f => { f.options.splice(index, 1); }), 'editor-button editor-small');
            remove.setAttribute('aria-label', 'Remove answer ' + (index + 1));
            remove.disabled = q.options.length <= 1;
            row.appendChild(remove);
            card.appendChild(row);
        });
        {
            const add = el('div', 'editor-option');
            const answer = textInput('', 400, 'New answer');
            answer.placeholder = 'New answer';
            const target = targetSelect(cat, q.id, '', 'Where the new answer leads');
            add.appendChild(answer);
            add.appendChild(el('span', 'editor-arrow', '\u2192'));
            add.appendChild(target);
            add.appendChild(button('Add answer', () => {
                const value = answer.value.trim();
                if (!value) { say('The answer needs a text.', true); return; }
                updateQuestion(cat, q.id, f => { f.options.push({ text: value, next: target.value }); });
            }, 'editor-button editor-small'));
            card.appendChild(add);
        }
        return card;
    }

    function questionAddForm(cat) {
        const box = el('div', 'editor-form');
        const text = textInput('', 400, 'Text of the question');
        const answer = textInput('', 400, 'First answer');
        const target = targetSelect(cat, '', '', 'Where the first answer leads');
        const questions = effQuestions(cat);
        const parent = el('select', 'editor-input');
        parent.setAttribute('aria-label', 'The question that leads here');
        const none = el('option', '', questions.length ? 'No question (link it yourself later)' : 'None (it will be the first question)');
        none.value = '';
        parent.appendChild(none);
        questions.forEach(q => { const option = el('option', '', shorten(q.text, 70)); option.value = q.id; parent.appendChild(option); });
        const parentAnswer = textInput('', 400, 'The answer that leads to the new question');
        box.appendChild(field('Question', text));
        box.appendChild(field('First answer', answer));
        box.appendChild(field('The first answer leads to', target));
        if (questions.length) {
            box.appendChild(field('Reached from the question', parent));
            box.appendChild(field('Answer there that leads to this question (if it is empty, the question text is used)', parentAnswer));
        }
        const row = el('div', 'editor-row');
        row.appendChild(button('Create', () => {
            const t = text.value.trim(), a = answer.value.trim();
            if (!t || !a) { say('The question and its first answer need a text.', true); return; }
            const parentQuestion = parent.value ? questions.find(q => q.id === parent.value) : null;
            const ok = change(pack => {
                const id = newQuestionId(t);
                storeQuestion(pack, cat, { id, text: t, options: [{ text: a, next: target.value }] });
                if (parentQuestion) storeQuestion(pack, cat, { id: parentQuestion.id, text: parentQuestion.text, options: parentQuestion.options.concat({ text: parentAnswer.value.trim() || shorten(t, 400), next: id }) });
            }, false);
            if (ok) { questionForm = false; render(); }
        }));
        row.appendChild(button('Cancel', () => { questionForm = false; render(); }));
        box.appendChild(row);
        return box;
    }

    function renderTree() {
        if (!baseTree) {
            if (baseTreeFailed) body.appendChild(el('p', 'editor-note', 'The questions could not be loaded. Check your connection and try again.'));
            else body.appendChild(el('p', 'editor-note', 'Loading the questions\u2026'));
            return;
        }
        const cats = effCategories();
        if (!cats.length) {
            body.appendChild(el('p', 'editor-note', 'There are no categories, so there are no questions. Add a category in the Categories tab, or restore one.'));
            return;
        }
        if (!cats.includes(treeCategory)) treeCategory = cats[0];
        const select = el('select', 'editor-input');
        select.setAttribute('aria-label', 'Category');
        cats.forEach(cat => {
            const option = el('option', '', catTitle(cat));
            option.value = cat;
            if (cat === treeCategory) option.selected = true;
            select.appendChild(option);
        });
        select.onchange = () => { treeCategory = select.value; questionForm = false; render(); };
        const top = el('div', 'editor-row');
        top.appendChild(select);
        top.appendChild(button('Add question', () => { questionForm = true; render(); }));
        body.appendChild(top);

        const questions = effQuestions(treeCategory);
        if (questionForm) body.appendChild(questionAddForm(treeCategory));
        if (!questions.length && !questionForm) {
            body.appendChild(el('p', 'editor-note', 'This category has no questions: people pick its values from a list. Add a question to start a quiz for it.'));
        } else if (questions.length) {
            body.appendChild(el('p', 'editor-note', 'The quiz of this category starts with the first question. An answer leads to another question or to a value, which is what the person gets. Questions that no answer leads to are never asked.'));
        }
        questions.forEach((q, index) => body.appendChild(questionCard(treeCategory, q, index === 0)));

        const part = draft.tree[treeCategory];
        const removed = part ? part.remove.filter(id => baseQuestion(treeCategory, id)) : [];
        if (removed.length) {
            body.appendChild(el('h3', 'editor-cat', 'Removed questions'));
            removed.forEach(id => {
                const row = el('div', 'editor-item editor-removed');
                row.appendChild(el('span', 'editor-item-name', baseQuestion(treeCategory, id).text));
                const actions = el('span', 'editor-actions');
                actions.appendChild(button('Restore', () => change(pack => { const p = treePart(pack, treeCategory); p.remove = p.remove.filter(x => x !== id); })));
                row.appendChild(actions);
                body.appendChild(row);
            });
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Categories and pack tabs
    // ---------------------------------------------------------------------------------------------
    function renderCategories() {
        allCategories().forEach(cat => {
            const removed = isCatRemoved(cat);
            const custom = own(draft.categories.add, cat);
            const row = el('div', 'editor-item' + (removed ? ' editor-removed' : ''));
            if (removed) {
                row.appendChild(el('span', 'editor-item-name', catTitle(cat)));
                row.appendChild(el('span', 'editor-badge', 'removed'));
                const actions = el('span', 'editor-actions');
                actions.appendChild(button('Restore', () => change(pack => { pack.categories.remove = pack.categories.remove.filter(id => id !== cat); })));
                row.appendChild(actions);
                body.appendChild(row);
                return;
            }
            const input = textInput(catTitle(cat), 80, 'Title of the category');
            input.onchange = () => {
                const text = input.value.trim();
                if (!text) { input.value = catTitle(cat); return; }
                change(pack => {
                    if (own(pack.categories.add, cat)) pack.categories.add[cat] = text;
                    else if (text === categoryTitles[cat]) delete pack.categories.rename[cat];
                    else pack.categories.rename[cat] = text;
                }, false);
            };
            row.appendChild(input);
            if (custom) row.appendChild(el('span', 'editor-badge', 'new'));
            const actions = el('span', 'editor-actions');
            actions.appendChild(button(custom ? 'Delete' : 'Remove', () => {
                const inside = allValues().filter(v => v.cat === cat && !v.removed);
                if (!confirm((custom ? 'Delete' : 'Remove') + ' \u201c' + catTitle(cat) + '\u201d' + (inside.length ? ' and its ' + inside.length + ' values?' : '?') +
                    (custom ? '' : ' You can restore it later, but ideology stances on its values are dropped from the pack.'))) return;
                change(pack => {
                    inside.forEach(v => {
                        if (v.custom) {
                            dropStanceReferences(pack, v.id);
                            delete pack.values.add[cat][v.id];
                        } else if (custom) {
                            if (pack.values.edit[v.id]) delete pack.values.edit[v.id].category;   // it goes back where it came from
                        } else {
                            dropStanceReferences(pack, v.id);                                      // the site drops it with the category
                        }
                    });
                    delete pack.categories.rename[cat];
                    if (custom) { delete pack.categories.add[cat]; delete pack.values.add[cat]; } else pack.categories.remove.push(cat);
                });
            }));
            row.appendChild(actions);
            body.appendChild(row);
        });
        const add = el('div', 'editor-row');
        const title = textInput('', 80, 'Title of a new category');
        title.placeholder = 'New category';
        add.appendChild(title);
        add.appendChild(button('Add category', () => {
            const text = title.value.trim();
            if (!text) { say('The category needs a title.', true); return; }
            change(pack => { pack.categories.add[newCategoryId(text)] = text; });
        }));
        body.appendChild(add);
    }
    function renderPack() {
        const name = textInput(draft.name, 80, 'Name of the pack');
        name.onchange = () => {
            const text = name.value.trim();
            if (!text) { name.value = draft.name; return; }
            change(pack => { pack.name = text; }, false);
        };
        body.appendChild(field('Name of the pack', name));
        body.appendChild(el('p', 'editor-note', 'Changes: ' + HVPack.summary(draft)));
        const row = el('div', 'editor-row');
        row.appendChild(button('Export pack', () => HVPack.download(draft)));
        row.appendChild(button('Remove all changes', () => {
            if (!confirm('Remove every change in this pack?')) return;
            change(pack => {
                const fresh = HVPack.emptyPack(pack.name);
                Object.keys(fresh).forEach(key => { pack[key] = fresh[key]; });
            });
        }));
        body.appendChild(row);
        body.appendChild(el('p', 'editor-note',
            'A picture you choose for a value must be an SVG. Only shapes, colors, gradients, clip paths and color filters are kept; ' +
            'blur, shadow and glow effects, scripts, links, images, style sheets, animations and the data an editor like Inkscape adds are left out.'));
    }

    // ---------------------------------------------------------------------------------------------
    function render() {
        tabsHolder.textContent = '';
        [['values', 'Values'], ['ideologies', 'Ideologies'], ['categories', 'Categories'], ['tree', 'Questions'], ['pack', 'Pack']].forEach(([key, text]) => {
            const node = button(text, () => { tab = key; form = null; ideologyForm = false; questionForm = false; openIdeology = null; say('', false); render(); }, 'editor-tab' + (tab === key ? ' editor-tab-on' : ''));
            node.setAttribute('role', 'tab');
            node.setAttribute('aria-selected', tab === key ? 'true' : 'false');
            tabsHolder.appendChild(node);
        });
        body.textContent = '';
        if (tab === 'values') renderValues();
        else if (tab === 'ideologies') { if (openIdeology) renderIdeology(openIdeology); else renderIdeologyList(); }
        else if (tab === 'categories') renderCategories();
        else if (tab === 'tree') renderTree();
        else renderPack();
    }
    render();
    HVPack.fetchBaseTree().then(tree => { baseTree = tree; render(); }, () => { baseTreeFailed = true; if (tab === 'tree') render(); });
})();
