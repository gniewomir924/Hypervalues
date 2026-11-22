// The bar at the top of the results page in custom mode: the pack in use, and importing, exporting and
// removing a pack. Needs pack.js. A pack is a file of changes to the site's data (see pack.js).
(function () {
    if (typeof HVPack === 'undefined' || !HVPack.isCustom()) return;
    const holder = document.querySelector('.main-container');
    const anchor = document.querySelector('.title-container');
    if (!holder || !anchor) return;

    function make(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function button(text, onClick) {
        const node = make('button', 'custom-bar-button', text);
        node.type = 'button';
        node.onclick = onClick;
        return node;
    }

    const pack = HVPack.active();
    const bar = make('div', 'custom-bar');
    bar.appendChild(make('strong', 'custom-bar-title', 'Custom Pages'));

    const status = make('span', 'custom-bar-status');
    if (HVPack.report.errors.length) {
        status.textContent = 'The saved pack cannot be used: ' + HVPack.report.errors[0];
    } else if (pack) {
        status.textContent = 'Pack \u201c' + pack.name + '\u201d: ' + HVPack.summary(pack);
        if (HVPack.report.skipped.length) {
            status.textContent += ` (${HVPack.report.skipped.length} changes skipped)`;
            status.title = HVPack.report.skipped.slice(0, 20).join('\n');
        }
    } else {
        status.textContent = 'No pack yet: the site\u2019s own values and ideologies. Edit or import a pack to change them.';
    }
    bar.appendChild(status);

    const row = make('div', 'custom-bar-row');
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = '.json,application/json';
    file.style.display = 'none';
    file.onchange = () => {
        const chosen = file.files && file.files[0];
        file.value = '';
        if (!chosen) return;
        const reader = new FileReader();
        reader.onerror = () => alert('The file could not be read.');
        reader.onload = () => {
            const result = HVPack.parseText(String(reader.result));
            if (result.errors.length) {
                alert('This pack cannot be used:\n\n' + result.errors.slice(0, 8).join('\n'));
                return;
            }
            if (HVPack.storedPack() && !confirm('Replace the pack in use with \u201c' + result.pack.name + '\u201d?')) return;
            if (!HVPack.savePack(result.pack)) { alert('The pack could not be saved in this browser.'); return; }
            location.reload();
        };
        reader.readAsText(chosen);
    };
    row.appendChild(file);
    row.appendChild(button('Edit pack', () => { location.href = 'editor.html'; }));
    row.appendChild(button('Import pack', () => file.click()));
    if (pack) {
        row.appendChild(button('Export pack', () => HVPack.download(pack)));
        row.appendChild(button('Copy pack', () => {
            const done = () => alert('Pack copied. Paste it into a .json file to keep or send it.');
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(HVPack.text(pack)).then(done, () => alert('This browser did not allow copying.'));
            } else {
                alert('This browser did not allow copying.');
            }
        }));
    }
    if (HVPack.storedPack()) {
        row.appendChild(button('Remove pack', () => {
            if (!confirm('Remove the pack? Your answers stay, but values it added disappear from them.')) return;
            HVPack.clearPack();
            location.reload();
        }));
    }
    row.appendChild(button('Normal mode', () => {
        HVPack.setCustom(false);
        location.reload();
    }));
    bar.appendChild(row);
    holder.insertBefore(bar, anchor.nextSibling);
})();
