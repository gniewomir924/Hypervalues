// Adds the category "Social Change" with the values Reformism, Evolutionism and Revolutionism:
// data.js (category, title, values, definitions, icon sources, stances, and a reasoned sentence in each affected ideology's definition),
// questions_tree.json (a new first question) and ideology_scores.json.
// Run from the repo root:  node tools/add_social_change.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const CAT = 'social_change';
const TITLE = 'Social Change';
const VALUES = {
    reformism: ['Reformism', 'A view of social change as the deliberate, step-by-step improvement of existing institutions through laws, elections, negotiation and public policy, rejecting both the revolutionary overthrow of the order and the wait for change to happen by itself. It treats society as a structure that can be repaired and reshaped while it keeps working, as in the labour and liberal reform movements and the social-democratic tradition of Eduard Bernstein.', ''],
    evolutionism: ['Evolutionism', 'A view of social change as a slow, largely unplanned growth of institutions, customs and knowledge through trial, error and adaptation across generations, in which no one designs the whole and no one can control it. It trusts what has survived and grown over what has been planned, as in Edmund Burke\'s defence of inherited institutions, Herbert Spencer\'s social evolution and Friedrich Hayek\'s spontaneous order.', 'ai'],
    revolutionism: ['Revolutionism', 'A view of social change as a rapid and fundamental break with the existing order, by uprising, seizure of power or mass upheaval that replaces its institutions, rulers and ownership, because the old order cannot be repaired from within. It holds that real change comes in leaps and not by gradual steps, as in the French and Russian revolutions and in the theories of Marx, Lenin and Sorel.', 'ai']
};
const QUESTION = {
    id: 'ch1', text: 'How should a society change when it needs to?', options: [
        { text: 'Step by step, by deliberately improving its laws and institutions through elections, negotiation and public policy', next: 'reformism' },
        { text: 'Slowly and mostly by itself, as customs and institutions adapt over generations with nobody planning the whole', next: 'evolutionism' },
        { text: 'Quickly and completely, by overthrowing the existing order and starting again on new foundations', next: 'revolutionism' }
    ]
};
// [ideology, value, stance, sentence]; a sentence is needed when the stance is 0.5 or more (it ends with the value's name in brackets)
const R = 'reformism', E = 'evolutionism', V = 'revolutionism';
const S = [
    // ---- Reformism: for
    ['Social Democracy', R, .9, `Capitalism is made fairer through welfare laws, collective bargaining and progressive taxation won at the ballot box, because lasting gains for workers are secured once they are written into the rules of the state (Reformism).`],
    ['Fabian Socialism', R, .9, `Socialism is approached by patient research, expert reports and quiet influence on civil servants, since carefully tested proposals win durable majorities and cannot easily be undone (Reformism).`],
    ['Democratic Socialism', R, .8, `Public ownership and equality are pursued through parliamentary majorities and union campaigns, because the vote already gives working people the means to reshape the economy peacefully (Reformism).`],
    ['Third Way', R, .8, `Public services are modernised through pragmatic legislation while markets are kept, because practical policy fixes can renew the welfare state without a clash of classes (Reformism).`],
    ['Social Liberalism', R, .8, `Freedom is widened through public schooling, health provision and labour law, since the constitutional order can be amended so that everyone gains real opportunity (Reformism).`],
    ['New Deal Liberalism', R, .8, `Economic crises are answered with regulation, public works and social insurance passed by the legislature, because capitalism can be stabilised and made fairer through statutes (Reformism).`],
    ['Nordic Model', R, .8, `Compromise among unions, employers and government yields measures that expand security and equality, since broad bargaining makes each improvement last (Reformism).`],
    ['Left-Social Democracy', R, .8, `Inequality is reduced through tax reform, stronger unions and public investment achieved in elections, because democratic majorities can steadily push the economy toward fairness (Reformism).`],
    ['Christian Democracy', R, .7, `Social harm is addressed through patient legislation and cooperation between classes, because the moral aim of fairness can be pursued within the constitutional order (Reformism).`],
    ['Radicalism', R, .7, `Privilege and corruption are challenged through electoral and constitutional change, since a wider franchise and curbs on monopoly can correct injustice peacefully (Reformism).`],
    ['Eurocommunism', R, .6, `Socialism is pursued inside pluralist parliamentary democracy, because a majority won at the polls can transform society while civil rights are kept (Reformism).`],
    ['Reform Gaullism', R, .7, `Institutions are adapted through targeted changes such as profit sharing and regional devolution, because a strong state can renew itself without breaking its continuity (Reformism).`],
    // ---- Reformism: against
    ['Luxemburgism', R, -.9, `Piecemeal improvement of the capitalist state is rejected, because palliatives leave the ownership of production untouched and only a mass uprising of workers can end exploitation (against Reformism).`],
    ['Marxism-Leninism', R, -.8, `Parliamentary compromise is rejected because the bourgeois state serves the ruling class and cannot be used to abolish it, so that only seizing power through a disciplined vanguard can bring socialism (against Reformism).`],
    ['Trotskyism', R, -.8, `Gradual improvement inside capitalism is rejected since every concession is withdrawn in a crisis unless the workers' own power is permanently established (against Reformism).`],
    ['Insurrectionary Anarchism', R, -.9, `Petitioning authorities and winning concessions is rejected because bargaining with the state only tames resistance, whereas direct attack on its structures keeps the struggle alive (against Reformism).`],
    ['Bordigism', R, -.9, `Compromise with democratic institutions is rejected, since the revolutionary party must keep its programme intact and refuse electoral deals that corrupt the class movement (against Reformism).`],
    ['Italian Left Communism', R, -.8, `Alliances with parliamentary parties are rejected because they dilute the class programme, so the party must stay uncompromising until the decisive confrontation (against Reformism).`],
    ['Anarcho-Communism', R, -.6, `Winning laws from the state is rejected because the state itself is the instrument of domination, so stateless communes must be built by direct action and not by petition (against Reformism).`],
    ['Mao Zedong Thought', R, -.8, `Peaceful parliamentary change is rejected since ruling classes never yield power willingly and the peasant majority must be mobilised in a protracted people's war (against Reformism).`],
    ['Marxism Leninism Maoism', R, -.8, `Legal and electoral roads are rejected because they leave the old state machinery in place, so that sustained armed struggle is needed to build a new one (against Reformism).`],
    ['Guevarism', R, -.8, `Electoral and reformist roads are rejected because small armed groups in the countryside can create the conditions for revolt faster than any parliament could (against Reformism).`],
    ['Hoxhaism', R, -.8, `Gradual accommodation with capital is rejected since revisionists who seek peaceful transitions end by restoring the rule of the bourgeoisie (against Reformism).`],
    ['Castroism', R, -.7, `Waiting for elections to improve conditions is rejected because the dictatorship and its owners would never allow a vote that threatened their interests (against Reformism).`],
    ['Council Communism', R, -.7, `Changes handed down through parliament and union bureaucracies are rejected, because only the workers' own councils can take over production while a parliament merely diverts them (against Reformism).`],
    ['Sorelianism', R, -.8, `Parliamentary socialism and bargaining are rejected because they soften class conflict, while the myth of a general strike keeps workers' energy and moral force alive (against Reformism).`],
    ['Revolutionary Nationalism', R, -.7, `Constitutional tinkering with the existing regime is rejected since national renewal needs a clean break with the corrupt political class and its institutions (against Reformism).`],
    // ---- Reformism: weaker stances (no sentence needed below 0.5)
    ['Labour Atlanticism', R, .4], ['Bleeding-Heart Liberalism', R, .4], ['Green Social Democracy', R, .4], ['Christian Social Democracy', R, .4],
    ['Agrarian Social Democracy', R, .4], ['Conservative Social Democracy', R, .4], ['Libertarian Social Democracy', R, .4], ['Geo-Social Democracy', R, .4],
    ['Social Georgism', R, .4], ['Liberal Socialism', R, .4], ['Neo-Solidarism', R, .4], ['Social-Helveticism', R, .3], ['Progressive Helveticism', R, .3],
    ['Techno-Social Liberalism', R, .3], ['Compassionate Conservatism', R, .3], ['Rockefeller Republicanism', R, .3],
    ['Stalinism', R, -.4], ['Platformism', R, -.4], ['Libertarian Socialism', R, -.4], ['Anarcho-Syndicalism', R, -.4], ['Unconditional Accelerationism', R, -.4],
    // ---- Evolutionism: for
    ['One-Nation Conservatism', E, .8, `Society is a living inheritance improved by cautious adaptation, because customs and institutions grown over centuries carry experience that no single generation could design (Evolutionism).`],
    ['Whiggism', E, .8, `Constitutional liberty is the fruit of a long accumulation of precedents such as the common law, so that progress comes from continuity and not from rupture (Evolutionism).`],
    ['Paternalistic Conservatism', E, .7, `Social bonds, duties and ranks grow out of ancient custom, so that care for the poor should extend those old obligations and not replace them (Evolutionism).`],
    ['Old Right Paleoconservatism', E, .7, `Order rests on habits, local loyalties and religion that took generations to form, because rational blueprints destroy what slow experience has proven to work (Evolutionism).`],
    ['Red Toryism', E, .7, `Parishes, guilds and neighbourhoods are products of long association, since civil society matured beneath the state over centuries and must be left to renew itself (Evolutionism).`],
    ['Classical Liberalism', E, .6, `Markets, law and manners emerge from countless voluntary exchanges, because no authority holds the knowledge needed to plan them and good rules spread through use (Evolutionism).`],
    ['Market Anarchism', E, .7, `Order arises from spontaneous cooperation among free people, since customs and contracts that work spread while those that fail are abandoned (Evolutionism).`],
    ['Hoppeanism', E, .6, `A natural social order grows from private property and voluntary community, since communities that keep sound norms outlast those that do not (Evolutionism).`],
    ['Catholic Social Teaching', E, .6, `The family, the parish and the guild form before the state, so that higher bodies should support these grown communities and not replace them (Evolutionism).`],
    ['Free-Market Conservatism', E, .6, `Prosperity is a by-product of tradition and competition, since institutions tested by long experience outperform grand plans (Evolutionism).`],
    ['Agrarian Conservatism', E, .6, `Rural customs and the rhythm of the seasons shape a way of life learned over many generations, because the land teaches patience that planners cannot supply (Evolutionism).`],
    // ---- Evolutionism: against
    ['American Technocracy', E, -.7, `Society is run by engineered systems designed by experts, because customs and markets are too slow and wasteful to organize modern production (against Evolutionism).`],
    ['World State Fordism', E, -.7, `Every habit of life is designed centrally to produce stability, so that nothing is left to chance or to the drift of inherited custom (against Evolutionism).`],
    ['One State Benefactorism', E, -.7, `Behaviour is calculated by formula and supervised, since spontaneous impulses are treated as threats to a perfectly ordered happiness (against Evolutionism).`],
    ['Futurism', E, -.7, `The past and its slow habits are treated as dead weight, because a nation is renewed by deliberate leaps of will and technology (against Evolutionism).`],
    ['Cosmist Vanguardism', E, -.7, `Humanity is steered by a vanguard toward the planned conquest of nature, because blind natural processes cannot be trusted to reach that end (against Evolutionism).`],
    ['Cyber-Communism', E, -.6, `Production is steered by computing networks and central plans, since prices and custom cannot coordinate a modern economy as well as calculation (against Evolutionism).`],
    // ---- Evolutionism: weaker stances
    ['Mesoconservatism', E, .4], ['Liberal Toryism', E, .4], ['Paleoconservatism', E, .4], ['Buchanan Paleoconservatism', E, .4], ['Hard Right Paleoconservatism', E, .4],
    ['Conservative Atlanticism', E, .4], ['National Conservatism', E, .4], ['Anarcho-Capitalism', E, .4], ['Libertarian Conservatism', E, .4], ['Fabian Socialism', E, .4],
    ['Clerical Conservatism', E, .4], ['Carlism', E, .4], ['Feudal Monarchism', E, .4], ['Reactionary Feudalism', E, .4], ['Neolibertarianism', E, .4], ['Fusionism', E, .4],
    ['Social Democracy', E, .3], ['Social Liberalism', E, .3], ['Reform Gaullism', E, .3],
    ['Marxism-Leninism', E, -.4], ['Techno-Fascism', E, -.4], ['Ingsoc', E, -.4], ['Neo-Bolshevism', E, -.4], ['Cybernetic Socialism', E, -.4], ['Cybersyn Socialism', E, -.4],
    // ---- Revolutionism: for
    ['Marxism-Leninism', V, .9, `The old state is smashed by a disciplined vanguard that seizes power in a moment of crisis, because the ruling class will never give up its rule peacefully (Revolutionism).`],
    ['Trotskyism', V, .9, `Workers' power is won through an uninterrupted international upheaval, since each national revolution survives only when it keeps spreading beyond its borders (Revolutionism).`],
    ['Mao Zedong Thought', V, .9, `Power is taken by a protracted people's war carried by the peasantry, because the countryside can encircle the cities and overturn the old order from below (Revolutionism).`],
    ['Marxism Leninism Maoism', V, .9, `The existing order is overthrown by protracted war led by a vanguard party, since only armed struggle can destroy the state of landlords and capitalists (Revolutionism).`],
    ['Guevarism', V, .9, `Armed groups in the countryside ignite revolt, because a determined minority can create the conditions for upheaval without waiting for them to ripen (Revolutionism).`],
    ['Luxemburgism', V, .9, `The working masses take power through a mass strike and an uprising, since their own spontaneous action alone can break the rule of capital (Revolutionism).`],
    ['Council Communism', V, .9, `Workers seize the factories and form councils in one sweeping act, because the old order falls only when its productive basis is taken over from below (Revolutionism).`],
    ['Bordigism', V, .9, `The revolutionary party prepares an insurrection that destroys the bourgeois state entirely, since no part of the old machinery can be taken over and used (Revolutionism).`],
    ['Italian Left Communism', V, .9, `Capitalism is ended by an insurrection led by an uncompromising party, because the class struggle can only be resolved through a violent seizure of power (Revolutionism).`],
    ['Insurrectionary Anarchism', V, .9, `The existing order is attacked directly and continuously through riots and sabotage, because a sudden rupture and not gradual pressure opens the way to freedom (Revolutionism).`],
    ['Anarcho-Communism', V, .8, `The state and capital are abolished at once by a social upheaval, since a mass uprising can replace them immediately with free communes (Revolutionism).`],
    ['Anarcho-Syndicalism', V, .8, `A general strike by organised unions takes over workplaces and ends capitalism, because direct action by workers can overturn the whole system at one stroke (Revolutionism).`],
    ['Sorelianism', V, .9, `The myth of a general strike mobilises workers for a decisive clash, because violent confrontation gives the movement the moral energy to remake society (Revolutionism).`],
    ['Revolutionary Nationalism', V, .9, `The corrupt regime is overthrown and the nation is rebuilt on new foundations, since only a clean break can release its energies after decades of decay (Revolutionism).`],
    ['National Bolshevism', V, .8, `The nation is rebuilt through a social upheaval against both capital and old elites, since a sweeping overthrow unites the working people behind it (Revolutionism).`],
    ['Strasserism', V, .8, `A second revolution is needed to complete the national one, because the movement's socialist promises are betrayed if it settles with the old elites (Revolutionism).`],
    ['Savinkovism', V, .7, `Terror and conspiracy strike the autocracy directly, since a determined few can topple a regime that no petition could move (Revolutionism).`],
    ['Unconditional Accelerationism', V, .8, `Every force that breaks existing structures is welcomed, because a violent collapse of the present order is the surest road to something wholly new (Revolutionism).`],
    ['Hoxhaism', V, .8, `The bourgeois state is destroyed by armed uprising without compromise, since every concession to revisionists ends in the restoration of capital (Revolutionism).`],
    ['Castroism', V, .7, `A guerrilla campaign overturns the dictatorship and then the whole social order, because a small armed force can inspire the masses to rise (Revolutionism).`],
    // ---- Revolutionism: against
    ['Social Democracy', V, -.8, `The overthrow of the existing order is rejected, because violent upheaval destroys the institutions, trade unions and parties through which workers have built their power (against Revolutionism).`],
    ['Fabian Socialism', V, -.8, `Sudden upheaval is rejected since changes imposed by force seldom last, whereas patient work among voters builds lasting majorities (against Revolutionism).`],
    ['One-Nation Conservatism', V, -.8, `Revolutionary upheaval is rejected because abstract schemes of renewal destroy the accumulated trust of generations and often end in tyranny (against Revolutionism).`],
    ['Whiggism', V, -.8, `A violent break with the constitution is rejected, since liberties survive best when they are protected by ordered, lawful alteration (against Revolutionism).`],
    ['Paternalistic Conservatism', V, -.7, `Overturning society is rejected because the poor suffer most when order collapses and the duties that protected them vanish (against Revolutionism).`],
    ['Classical Liberalism', V, -.6, `Seizures of power are rejected since violent seizures threaten property and individual rights, and the new rulers soon become as arbitrary as the old (against Revolutionism).`],
    ['Third Way', V, -.7, `Radical rupture is rejected because voters and markets punish disorder, and practical results come from steady management (against Revolutionism).`],
    ['Christian Democracy', V, -.7, `Upheaval is rejected since class hatred and violence contradict the dignity of the person and the aim of reconciliation among social groups (against Revolutionism).`],
    // ---- Revolutionism: weaker stances
    ['Stalinism', V, .4], ['Titoism', V, .4], ['Juche', V, .4], ['Platformism', V, .4], ['Italian Fascism', V, .4], ['Sansepolcrismo', V, .4], ['Falangism', V, .4],
    ['National-Socialism', V, .4], ['Neo-Nazism', V, .4], ['Nazi-Maoism', V, .4], ['National Syndicalism', V, .4], ['Left-Accelerationism', V, .4],
    ['Right-Accelerationism', V, .4], ['National Communism', V, .3], ['Evolianism', V, .4], ['Syndicalist Republicanism', V, .4], ['Ba\'athism', V, .4],
    ['Nordic Model', V, -.4], ['Social Liberalism', V, -.4], ['Democratic Socialism', V, -.4], ['Eurocommunism', V, -.4], ['Mesoconservatism', V, -.4],
    ['Liberal Toryism', V, -.4], ['Red Toryism', V, -.4], ['Old Right Paleoconservatism', V, -.4], ['Free-Market Conservatism', V, -.4],
    ['Conservative Atlanticism', V, -.4], ['Neoliberalism', V, -.4], ['Ordoliberalism', V, -.4], ['Gandhian Socialism', V, -.4]
];

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const q = s => JSON.stringify(s);
function blockRange(src, name) {
    const s = src.indexOf('const ' + name + ' = {');
    if (s < 0) throw new Error('cannot find ' + name);
    return [s, src.indexOf('\n};', s)];
}
function addAfter(src, blockName, anchorStart, makeLine, what) {
    const [s, e] = blockRange(src, blockName);
    const at = src.indexOf(anchorStart, s);
    if (at < 0 || at > e) throw new Error('cannot find ' + what);
    const eol = src.indexOf('\n', at);
    const line = src.slice(at, eol);
    if (line.endsWith(',')) return src.slice(0, eol + 1) + makeLine(true) + src.slice(eol + 1);
    return src.slice(0, eol) + ',\n' + makeLine(false).replace(/\n$/, '') + src.slice(eol);
}

// ---- checks of the table above
const names = { reformism: 'Reformism', evolutionism: 'Evolutionism', revolutionism: 'Revolutionism' };
S.forEach(([label, value, score, text]) => {
    if (!names[value] || !(Math.abs(score) <= 1) || score === 0) throw new Error('bad stance: ' + label + ' ' + value);
    if (Math.abs(score) >= 0.5) {
        const end = '(' + (score < 0 ? 'against ' : '') + names[value] + ').';
        if (!text || !text.endsWith(end)) throw new Error('the sentence for ' + label + ' / ' + value + ' must end with ' + end);
    } else if (text) throw new Error('a stance under 0.5 has no sentence: ' + label + ' / ' + value);
});

const dataPath = path.join(root, 'data.js');
let src = fs.readFileSync(dataPath, 'utf8');
if (src.includes('"' + CAT + '": {')) {
    console.log('data.js already has the category ' + CAT);
} else {
    // categories and title
    const cm = src.match(/const categories = \[([^\]]*)\];/);
    if (!cm) throw new Error('cannot find the categories list');
    const multi = cm[1].includes('\n');
    const inner = cm[1].replace(/\s+$/, '');
    src = src.replace(cm[0], () => 'const categories = [' + inner + (multi ? ',\n    ' : ', ') + q(CAT) + (multi ? '\n' : '') + '];');
    src = addAfter(src, 'categoryTitles', '    "territorial_organization": ', c => '    ' + q(CAT) + ': ' + q(TITLE) + (c ? ',' : '') + '\n', 'the territorial_organization title');
    // the values
    {
        const [s, e] = blockRange(src, 'resultsMapping');
        const block = src.slice(s, e);
        const lastClose = block.lastIndexOf('\n    }');
        if (lastClose < 0) throw new Error('cannot read the end of resultsMapping');
        const entries = Object.keys(VALUES).map(v => '        ' + q(v) + ': ' + q(VALUES[v][0])).join(',\n');
        src = src.slice(0, s) + block.slice(0, lastClose) + '\n    },\n    ' + q(CAT) + ': {\n' + entries + '\n    }' + block.slice(lastClose + '\n    }'.length) + src.slice(e);
    }
    // definitions and icon sources of the three values, after the mercantilism lines
    const order = Object.keys(VALUES).reverse();
    order.forEach(v => {
        src = addAfter(src, 'descriptions', '    "mercantilism": ', c => '    ' + q(v) + ': ' + q(VALUES[v][1]) + (c ? ',' : '') + '\n', 'the mercantilism definition');
        src = addAfter(src, 'iconSources', '    "mercantilism": ', c => '    ' + q(v) + ': ' + q(VALUES[v][2]) + (c ? ',' : '') + '\n', 'the mercantilism icon source');
    });
    // stances and sentences of the ideologies
    const byLabel = {};
    S.forEach(row => { (byLabel[row[0]] = byLabel[row[0]] || []).push(row); });
    const [ss, se] = blockRange(src, 'ideologyScores');
    let sblock = src.slice(ss, se);
    const lead0 = (sblock.match(/:0\./g) || []).length > (sblock.match(/:-?\.\d/g) || []).length;
    const fmt = x => (x < 0 ? '-' : '') + (lead0 ? String(Math.abs(x)) : String(Math.abs(x)).replace(/^0\./, '.'));
    Object.keys(byLabel).forEach(label => {
        const re = new RegExp('^(    ' + esc(q(label)) + ': ")([^"\\n]*)(")', 'm');
        const m = sblock.match(re);
        if (!m) throw new Error('no ideology called ' + label);
        let add = '';
        byLabel[label].forEach(([l, value, score]) => {
            if (new RegExp('(^|\\|)' + value + ':').test(m[2])) throw new Error(label + ' already has ' + value);
            add += '|' + value + ':' + fmt(score);
        });
        sblock = sblock.replace(re, (all, a, b, c) => a + b + add + c);
    });
    src = src.slice(0, ss) + sblock + src.slice(se);
    const [ds, de] = blockRange(src, 'descriptions');
    let dblock = src.slice(ds, de);
    Object.keys(byLabel).forEach(label => {
        const sentences = byLabel[label].filter(r => r[3]).map(r => r[3]);
        if (!sentences.length) return;
        const re = new RegExp('^(    ' + esc(q(label)) + ': )("(?:[^"\\\\\\n]|\\\\.)*")(,?)$', 'm');
        const m = dblock.match(re);
        if (!m) throw new Error('no definition for ' + label);
        const text = JSON.parse(m[2]);
        dblock = dblock.replace(re, (all, a, b, c) => a + q(text + ' ' + sentences.join(' ')) + c);
    });
    src = src.slice(0, ds) + dblock + src.slice(de);
    fs.writeFileSync(dataPath, src);
    console.log('data.js updated: category, 3 values, stances for ' + Object.keys(byLabel).length + ' ideologies');
}

// ---- questions_tree.json
const treePath = path.join(root, 'questions_tree.json');
const rawTree = fs.readFileSync(treePath, 'utf8');
const im = rawTree.match(/^\{\r?\n( +)"/);
const tree = JSON.parse(rawTree);
if (tree[CAT]) {
    console.log('questions_tree.json already has ' + CAT);
} else {
    tree[CAT] = [QUESTION].concat(Object.keys(VALUES).map(id => ({ id })));
    fs.writeFileSync(treePath, JSON.stringify(tree, null, im ? im[1].length : 0) + (rawTree.endsWith('\n') ? '\n' : ''));
    console.log('questions_tree.json updated');
}

// ---- ideology_scores.json
const ctx = { localStorage: { getItem() { return null; }, setItem() {} }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(dataPath, 'utf8').replace(/^const /gm, 'var '), ctx);
const jsonPath = path.join(root, 'ideology_scores.json');
const rawJson = fs.readFileSync(jsonPath, 'utf8');
const jm = rawJson.match(/^\{\r?\n( +)"/);
const copy = JSON.parse(rawJson);
let changed = 0;
Object.keys(ctx.ideologyScores).forEach(label => {
    if (!copy[label]) return;
    let touched = false;
    if (copy[label].s !== ctx.ideologyScores[label]) { copy[label].s = ctx.ideologyScores[label]; touched = true; }
    if ('d' in copy[label] && copy[label].d !== ctx.descriptions[label]) { copy[label].d = ctx.descriptions[label]; touched = true; }
    if (touched) changed++;
});
fs.writeFileSync(jsonPath, JSON.stringify(copy, null, jm ? jm[1].length : 0) + (rawJson.endsWith('\n') ? '\n' : ''));
console.log('ideology_scores.json updated: ' + changed + ' ideologies');
