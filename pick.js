// Custom mode: the values of one category (pick.html?cat=economics) as a list to choose from, next to the
// question tree (which a pack can change). Choosing a value adds it with agreement 1 and goes back to the list of categories (results.html).
const params = new URLSearchParams(window.location.search);
const category = params.get('cat');

function backToList() {
    window.location.href = category ? `results.html#cat-${category}` : 'results.html';
}

if (!HVPack.isCustom()) {
    window.location.replace(category ? `quiz.html?cat=${encodeURIComponent(category)}` : 'results.html');
} else if (!category || !Object.prototype.hasOwnProperty.call(resultsMapping, category)) {
    window.location.replace('results.html');
} else {
    const answers = HV.loadAnswers();
    const list = answers[category] || [];
    document.getElementById('pick-title').textContent = categoryTitles[category] || category;
    const container = document.getElementById('pick-container');
    const flex = document.createElement('div');
    flex.className = 'values-flex-container';

    const ids = Object.keys(resultsMapping[category]);
    ids.forEach(id => {
        const done = list.find(item => item.value === id);
        const tile = document.createElement('a');
        tile.className = 'result-item';
        tile.style.textDecoration = 'none';
        tile.style.color = 'inherit';
        tile.href = done ? `description.html?id=${id}&cat=${category}&edit=1` : '#';
        if (done) {
            tile.style.opacity = '0.5';
            } else {
            tile.onclick = event => {
                event.preventDefault();
                const entries = answers[category] || (answers[category] = []);
                entries.push({ value: id, agree: 1 });
                HV.saveAnswers(answers);
                backToList();
            };
        }

        const img = document.createElement('img');
        img.src = HVPack.iconUrl(category, id);
        img.className = 'result-icon';
        img.alt = '';
        img.style.borderRadius = '50%';
        img.onerror = () => { img.style.display = 'none'; };

        const name = document.createElement('p');
        name.className = 'result-text';
        setName(name, HV.nameOf(category, id));

        tile.appendChild(img);
        tile.appendChild(name);
        flex.appendChild(tile);
    });
    container.appendChild(flex);
    if (typeof fitNames === 'function') fitNames(container);

    // If the category has questions (with the changes of the pack), they are another way to get a value
    HVPack.loadTree().then(tree => {
        const list = tree[category];
        if (!Array.isArray(list) || !list.length || !Array.isArray(list[0].options)) return;
        const questions = document.createElement('button');
        questions.textContent = 'Questions';
        questions.onclick = () => { window.location.href = `quiz.html?cat=${encodeURIComponent(category)}`; };
        const buttons = document.getElementById('pick-buttons');
        buttons.insertBefore(questions, buttons.firstChild);
    }).catch(() => {});
}
