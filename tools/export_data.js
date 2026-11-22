// Prints the data that tools/check_definitions.py needs as JSON: node tools/export_data.js > data.json
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { localStorage: { getItem() { return null; }, setItem() {} }, console, atob: text => Buffer.from(text, 'base64').toString('binary') };
vm.createContext(ctx);
['data.js', 'scoring.js'].forEach(file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8').replace(/^const /gm, 'var '), ctx, { filename: file }));
const scoring = fs.readFileSync(path.join(root, 'scoring.js'), 'utf8');
const stop = scoring.match(/STOP_WORDS = new Set\('([^']*)'/)[1].split(' ');
const tree = JSON.parse(fs.readFileSync(path.join(root, 'questions_tree.json'), 'utf8'));
// the text of every option that leads to a value (the quiz text of that value)
const quiz = {};
Object.keys(tree).forEach(cat => tree[cat].forEach(node => (node.options || []).forEach(option => {
    if (option.next) (quiz[option.next] = quiz[option.next] || []).push(option.text);
})));
const labels = Object.keys(ctx.ideologyScores);
process.stdout.write(JSON.stringify({
    resultsMapping: ctx.resultsMapping, categoryOf: ctx.HV.categoryOf, descriptions: ctx.descriptions,
    ideologyScores: ctx.ideologyScores, labels, stop, quiz
}));
