// The questions of one category (quiz.html?cat=economics). Getting a value saves it and goes back to
// the list of categories (results.html).
const params = new URLSearchParams(window.location.search);
const category = params.get('cat');
const answers = HV.loadAnswers();
let currentQuestions = {};
let currentNodeId = null;
let nodeStack = [];        // questions already answered, for the back button

function backToList() {
  window.location.href = `results.html#cat-${category}`;
}

function showError(message) {
  document.getElementById('question').innerText = message;
  const buttonsDiv = document.getElementById('buttons');
  buttonsDiv.innerHTML = '';
  buttonsDiv.appendChild(makeButton('Back', backToList));
}

// In custom mode the tree comes with the changes of the pack (pack.js); a category that has no questions there
// goes to the list of values to pick from
HVPack.loadTree()
  .then(tree => {
    const has = Object.prototype.hasOwnProperty;
    const startsWithQuestion = list => Array.isArray(list) && list.length > 0 && list[0] && Array.isArray(list[0].options);
    // hasOwnProperty: keys such as "constructor" or "__proto__" must not count as categories
    if (!category || !has.call(tree, category) || !startsWithQuestion(tree[category])) {
      if (HVPack.isCustom() && category && has.call(resultsMapping, category)) {
        window.location.replace(`pick.html?cat=${encodeURIComponent(category)}`);
      } else {
        window.location.replace('results.html');
      }
      return;
    }
    tree[category].forEach(q => currentQuestions[q.id] = q);
    renderNode(currentQuestions[tree[category][0].id]);
  })
  .catch(() => {
    showError('Could not load the questions. Check your connection and try again.');
  });

function makeButton(text, onClick) {
  const btn = document.createElement('button');
  btn.innerText = text;
  btn.onclick = onClick;
  return btn;
}

function renderNode(node) {
  currentNodeId = node.id;
  const buttonsDiv = document.getElementById('buttons');
  buttonsDiv.innerHTML = '';
  document.getElementById('question').innerText = node.text || "";

  if (node.options && node.options.length > 3) {
    buttonsDiv.classList.add('multi-column');
  } else {
    buttonsDiv.classList.remove('multi-column');
  }

  node.options.forEach(opt => {
    const btn = makeButton(opt.text, () => selectOption(opt.next));
    if (opt.color) btn.style.backgroundColor = opt.color;
    buttonsDiv.appendChild(btn);
  });

  buttonsDiv.appendChild(makeButton(nodeStack.length ? 'Previous Question' : 'Back', previousQuestion));
}

function selectOption(nextId) {
  nodeStack.push(currentNodeId);
  const node = currentQuestions[nextId];
  if (!node) {
    nodeStack.pop();
    showError('This question is missing. Please go back.');
    return;
  }
  if (!node.options) {
    addValue(node.id);
  } else {
    renderNode(node);
  }
}

function addValue(valueId) {
  const list = answers[category] || (answers[category] = []);
  const existing = list.find(item => item.value === valueId);
  if (!existing) {
    list.push({ value: valueId, agree: 1 });
  } else if (!(existing.agree > 0)) {
    // picked again after being marked neutral or opposite: it now matches
    existing.agree = 1;
  }
  HV.saveAnswers(answers);
  backToList();
}

function previousQuestion() {
  if (nodeStack.length) {
    renderNode(currentQuestions[nodeStack.pop()]);
  } else {
    backToList();
  }
}
