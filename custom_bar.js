// The top of the results page in custom mode: three round buttons (edit the pack, import a pack, export it) and the
// name of the pack next to the version. Needs pack.js and custom_ui.js. A pack is a file of changes to the site's
// data (see pack.js).
(function () {
    if (typeof HVPack === 'undefined' || typeof HVUI === 'undefined' || !HVPack.isCustom()) return;
    const holder = document.querySelector('.main-container');
    const anchor = document.querySelector('.title-container');
    if (!holder || !anchor) return;

    const pack = HVPack.active();
    const version = anchor.querySelector('.version-text');
    if (version && pack && pack.name) {
        version.textContent += ' \u00b7 ' + pack.name;
        if (HVPack.report.skipped.length) version.title = HVPack.report.skipped.slice(0, 20).join('\n');
    }

    if (HVPack.report.errors.length) {
        const error = document.createElement('p');
        error.className = 'hv-error';
        error.textContent = HVPack.report.errors[0];
        holder.insertBefore(error, anchor.nextSibling);
    }

    const tools = document.createElement('div');
    tools.className = 'hv-tools';
    tools.appendChild(HVUI.round('edit', 'Edit', () => { location.href = 'editor.html'; }));
    const importButton = HVUI.round('import', 'Import');
    if (HVUI.hasChanges()) HVUI.arm(importButton, 'import', HVUI.importPack);
    else importButton.onclick = HVUI.importPack;
    tools.appendChild(importButton);
    if (pack) tools.appendChild(HVUI.round('export', 'Export', () => HVPack.download(pack)));
    holder.insertBefore(tools, anchor.nextSibling);
})();
