#!/usr/bin/env node
/*
 * Descriptions + stances for the three values: Reformism, Revolutionism and Social Darwinism.
 * Run from the project root:  node tools/set_social_scores.js
 *
 * What it does
 *   1. Writes a description for each value (data.js "descriptions", the text shown on the value page).
 *   2. Gives every ideology a stance on each value, from -1 (the ideology opposes it) to +1 (it matches it),
 *      in data.js (ideologyScores) and in ideology_scores.json. Old stances for these three values are replaced.
 *      "null" in the table below means the ideology takes no clear side, so nothing is stored for it.
 *      Only stances of at least MIN_STANCE (0.6) in strength are stored; weaker rows stay in the table for later.
 *   3. Repairs labelColors: tools/add_social_theories.js appended stances to the colour of 30 ideologies
 *      (for example "#FF3333|revolutionism:-0.8"), which is not a valid colour. They are cut back to the plain colour.
 *
 * To change a stance, edit its row in SCORES below and run the script again (safe to re-run).
 * data.js and ideology_scores.json are backed up first (*.backup-social-scores-<time>).
 * Column order: [Reformism, Revolutionism, Social Darwinism].
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = process.cwd();
const dataPath = path.join(root, "data.js");
const scoresPath = path.join(root, "ideology_scores.json");
for (const f of [dataPath, scoresPath]) if (!fs.existsSync(f)) { console.error("Not found: " + f + " (run from the project root)"); process.exit(1); }

const VALUES = ["reformism", "revolutionism", "social_darwinism"];

// Stances weaker than this are not stored. Giving every ideology a weak opinion on every value makes the closest-ideology
// ranking drift (tested on all 270 ideologies), so only clear positions are kept. Set it to 0 to store every row below.
const MIN_STANCE = 0.6;

const DESCRIPTIONS = {
  reformism:
    "The view that a society should be improved gradually from within, through its existing institutions: laws, elections, parties, " +
    "unions, courts and public policy. It holds that lasting change comes step by step, keeps what works while fixing what does not, " +
    "and avoids the violence and instability of overthrowing the system.",
  revolutionism:
    "The view that the deepest problems of a society cannot be solved inside the existing order, which must be fundamentally changed or " +
    "overthrown and replaced quickly, by a decisive break such as an uprising, a seizure of power or a mass rupture. It holds that those " +
    "in power do not give it up willingly and that reforms alone only preserve the old structure.",
  social_darwinism:
    "The view that human society is shaped by natural competition and the struggle for existence, so that hierarchies and differences in " +
    "success between individuals, classes, nations or races are natural outcomes of the survival of the fittest. It tends to argue that " +
    "welfare, equalizing policies and protection of the weak interfere with that process."
};

// [Reformism, Revolutionism, Social Darwinism]
const SCORES = {
  // Third Position
  "National Syndicalism": [-0.5, 0.5, 0.2],
  "Brazilian Integralism": [-0.4, 0.4, -0.2],
  "Italian Fascism": [-0.6, 0.5, 0.5],
  "Evolianism": [-0.7, 0.5, -0.3],
  "Futurism": [-0.6, 0.6, 0.5],
  "National-Socialism": [-0.7, 0.6, 0.65],
  "Neo-Nazism": [-0.7, 0.6, 0.65],
  "Agrarian Fascism": [-0.5, 0.4, 0.3],
  "Strasserism": [-0.5, 0.7, 0.2],
  "Falangism": [-0.5, 0.5, 0.2],
  "Sansepolcrismo": [-0.3, 0.6, 0.1],
  "Ecofascism": [-0.6, 0.5, 0.4],
  "Sorelianism": [-1, 1, 0.1],
  "Legionarianism": [-0.7, 0.8, 0.2],
  "Peronism": [0.3, -0.3, -0.4],
  "Techno-Fascism": [-0.5, 0.5, 0.5],
  "National Solidarity": [-0.3, 0.3, -0.3],
  "Clerical Fascism": [-0.5, 0.4, -0.4],
  "Rexism": [-0.4, 0.4, -0.3],
  "Ba'athism": [-0.3, 0.6, -0.1],
  "Cosmist Vanguardism": [-0.3, 0.4, null],
  "Duginism": [-0.5, 0.6, 0.2],
  "Fiumanism": [-0.4, 0.4, -0.2],
  "Pekerism": [0.2, -0.4, 0.2],
  "Ethnonationalist Kemalism": [0.3, -0.4, 0.4],
  "Eneasism": [0.2, -0.3, 0.2],
  "Social Nationalism": [0.3, -0.3, -0.4],
  "Ethnocacerismo": [-0.5, 0.5, 0.4],
  "National Primitivism": [-0.4, 0.6, 0.2],
  "Social-Bonapartism": [-0.3, 0.3, null],
  "Tridemism": [0.3, 0.3, -0.2],
  "Nationalist Kemalism": [0.3, -0.4, 0.3],
  "National Collectivism": [-0.6, 0.6, 0.4],
  "Nazi-Maoism": [-0.8, 0.9, 0.4],
  "Savinkovism": [-0.3, 0.5, null],
  "Mosleyism": [-0.5, 0.5, 0.2],
  "Revolutionary Nationalism": [-0.8, 0.9, -0.3],
  "Paetel's National Bolshevism": [-0.7, 0.9, null],
  "National Radicalism": [-0.5, 0.5, 0.4],
  // Reactionary
  "Volkism": [-0.4, 0.3, 0.5],
  "Optimateism": [-0.1, -0.7, 0.5],
  "Integralism": [null, -0.7, -0.3],
  "National Capitalism": [0.2, -0.6, 0.4],
  "Carlism": [-0.3, -0.5, 0.1],
  "Autocratic Monarchism": [-0.2, -0.8, 0.3],
  "Theocratic Distributism": [-0.4, 0.2, -0.3],
  "Reactionary Feudalism": [-0.5, 0.2, 0.3],
  "Neo-Absolutism": [-0.5, 0.2, 0.4],
  "Aristocratic Cameralism": [-0.1, -0.7, 0.4],
  "Feudal Monarchism": [-0.1, -0.7, 0.2],
  "Clerical Monarchism": [-0.1, -0.7, -0.2],
  "Developmental Theocracy": [-0.4, 0.2, null],
  "Classical Eurasianism": [-0.2, -0.2, 0.1],
  "Mladorossism": [-0.2, 0.1, -0.2],
  "National Social Capitalism": [0.2, -0.6, 0.4],
  "Right-State Liberalism": [0.5, -0.8, 0.3],
  "Monarquia Syndicalista": [-0.3, null, -0.2],
  "Serenissimism": [null, -0.7, 0.3],
  // Conservative
  "National Conservatism": [0.3, -0.6, null],
  "Paternalistic Conservatism": [0.7, -0.8, -0.6],
  "Buchanan Paleoconservatism": [0.3, -0.5, null],
  "Hard Right Paleoconservatism": [0.2, -0.5, 0.2],
  "Old Right Paleoconservatism": [0.3, -0.6, 0.1],
  "Neoconservatism": [0.4, -0.6, 0.1],
  "Mesoconservatism": [0.8, -0.8, -0.2],
  "Red Toryism": [0.7, -0.7, -0.6],
  "Green Conservatism": [0.7, -0.7, -0.5],
  "Clerical Conservatism": [0.4, -0.8, -0.4],
  "Gaullism": [0.5, -0.4, -0.1],
  "Free-Market Conservatism": [0.4, -0.7, 0.2],
  "Agrarian Conservatism": [0.5, -0.8, -0.2],
  "Liberal Toryism": [0.7, -0.8, -0.2],
  "Social Gaullism": [0.8, -0.8, -0.2],
  "Neo-Gaullism": [0.5, -0.5, -0.1],
  "Bonapartist Gaullism": [0.2, -0.3, null],
  "Conservative Atlanticism": [0.5, -0.8, -0.2],
  "Neoconservative Atlanticism": [0.5, -0.8, -0.2],
  "One-Nation Conservatism": [0.9, -0.8, -0.2],
  "Conservative Kemalism": [0.6, -0.4, null],
  "Conservative Technoliberalism": [0.6, -0.8, -0.2],
  "Right-Social Authoritarianism": [-0.2, -0.5, null],
  "Kjærsgaardism": [0.3, -0.6, null],
  "Kekkonism": [0.5, -0.7, -0.3],
  "Reform Gaullism": [0.9, -0.8, -0.2],
  "Paleoconservatism": [0.3, -0.5, null],
  "Putinism": [-0.3, -0.9, 0.2],
  "Post-Soviet Autocracy": [-0.3, -0.9, 0.1],
  // Centrist
  "Radicalism": [0.7, -0.2, -0.3],
  "Third Way": [0.8, -0.9, -0.5],
  "Christian Democracy": [0.8, -0.9, -0.8],
  "Compassionate Conservatism": [0.8, -0.8, -0.7],
  "Rockefeller Republicanism": [0.8, -0.9, -0.5],
  "Democratic Transhumanism": [0.7, -0.5, -0.5],
  "Neo-Solidarism": [0.8, -0.7, -0.8],
  "Steppe Eurasianism": [0.8, -0.9, -0.5],
  "Classical Kemalism": [0.8, 0.2, -0.2],
  "Centrist Kemalism": [0.7, -0.3, -0.2],
  "Catholic Social Teaching": [0.7, -0.8, -0.9],
  "Bleeding-Heart Authoritarianism": [-0.2, -0.5, -0.5],
  "Austro-Corporatism": [-0.2, -0.6, -0.3],
  "Davos System": [0.6, -0.8, 0.1],
  // Centre-Left
  "Nordic Model": [0.9, -0.9, -0.8],
  "Social Democracy": [1, -0.8, -0.8],
  "Conservative Social Democracy": [0.9, -0.9, -0.8],
  "Social Distributism": [0.4, -0.2, -0.6],
  "Liberal Socialism": [0.9, -0.9, -0.8],
  "Social Georgism": [0.7, -0.9, -0.8],
  "Agrarian Social Democracy": [0.9, -0.9, -0.8],
  "Progressive Corporatism": [0.7, -0.6, -0.5],
  "Left-Gaullism": [0.7, -0.4, -0.6],
  "Labour Atlanticism": [0.7, -0.9, -0.8],
  "Green Social Democracy": [0.9, -0.9, -0.8],
  "Geo-Social Democracy": [0.9, -0.9, -0.8],
  "Christian Social Democracy": [0.9, -0.9, -0.8],
  "Police Labourism": [0.5, -0.8, -0.2],
  "Ecevitism": [0.8, -0.4, -0.6],
  "Left-Social Authoritarianism": [-0.2, 0.3, -0.4],
  "Progressive Social Authoritarianism": [-0.1, 0.2, -0.4],
  "Left-Wing Populism": [0.5, 0.2, -0.7],
  "Left-Social Democracy": [0.8, -0.9, -0.8],
  "Social-Helveticism": [0.8, -0.9, -0.8],
  "Left Kemalism": [0.4, 0.3, -0.5],
  "Longism": [0.6, -0.3, -0.6],
  // Marxist
  "Eurocommunism": [0.9, -0.6, -0.8],
  "Bordigism": [-1, 1, -0.7],
  "Italian Left Communism": [-0.8, 1, -0.7],
  "Juche": [-0.3, 0.5, 0.1],
  "Mao Zedong Thought": [-0.8, 1, -0.7],
  "Maoism Third Worldism": [-0.8, 1, -0.7],
  "Marxism Leninism Maoism": [-0.8, 1, -0.7],
  "Luxemburgism": [-0.9, 1, -0.9],
  "Trotskyism": [-0.8, 1, -0.7],
  "Marxism-Leninism": [-0.8, 0.9, -0.7],
  "Stalinism": [-0.7, 0.6, -0.3],
  "Titoism": [0.1, 0.7, -0.7],
  "Dengism": [0.7, -0.5, 0.1],
  "Hoxhaism": [-0.8, 0.9, -0.7],
  "Castroism": [-0.8, 0.9, -0.7],
  "Guevarism": [-0.8, 1, -0.7],
  "Cyber-Communism": [-0.3, 0.6, -0.7],
  "De Leonism": [-0.8, 0.9, -0.7],
  "Marxism-Kemalism": [-0.2, 0.5, -0.6],
  "National Communism": [-0.4, 0.6, -0.3],
  // Liberal
  "Classical Liberalism": [0.6, -0.5, -0.2],
  "Neoliberalism": [0.4, -0.7, 0.2],
  "National Liberalism": [0.6, -0.7, 0.1],
  "Social Liberalism": [0.8, -0.8, -0.7],
  "Ordoliberalism": [0.8, -0.8, -0.4],
  "Bleeding-Heart Liberalism": [0.7, -0.7, -0.7],
  "Geo-Liberalism": [0.8, -0.8, -0.4],
  "Green Liberalism": [0.8, -0.8, -0.4],
  "Whiggism": [0.8, -0.8, -0.4],
  "Muscular Liberalism": [0.5, -0.7, -0.2],
  "Liberal Atlanticism": [0.8, -0.8, -0.4],
  "Transatlantic Federalism": [0.8, -0.8, -0.4],
  "New Deal Liberalism": [0.8, -0.8, -0.4],
  "Venizelism": [0.6, -0.3, -0.2],
  "Liberal Kemalism": [0.7, null, -0.3],
  "Liberal Social Authoritarianism": [-0.1, -0.4, null],
  "Techno-Social Liberalism": [0.8, -0.8, -0.4],
  "Technoliberalism": [0.8, -0.8, -0.4],
  "American Model": [0.5, -0.6, null],
  "Techno-Neoliberalism": [0.5, -0.7, 0.1],
  "Tsaingwenism": [0.7, -0.8, -0.4],
  "Liberal Imperialism": [0.5, -0.8, 0.3],
  "Liberal Meritocracy": [0.6, -0.7, 0.1],
  // Centre-Libertarian
  "Bleeding-Heart Libertarianism": [0.7, -0.4, -0.5],
  "Geolibertarianism": [0.7, -0.3, -0.3],
  "Social Libertarianism": [0.8, -0.4, -0.5],
  "Helvetic Model": [0.8, -0.8, -0.2],
  "Minarcho-Distributism": [0.5, -0.2, -0.4],
  "Pirate Politics": [0.7, -0.4, -0.4],
  "Agorist Minarchism": [0.2, 0.3, 0.1],
  "Communal Distributism": [0.4, -0.2, -0.5],
  "Yangism": [0.8, -0.7, -0.5],
  "Libertarian Social Democracy": [0.8, -0.6, -0.6],
  "Progressive Helveticism": [0.8, -0.8, -0.5],
  "Cosmopolitan Distributism": [0.3, -0.2, -0.7],
  "Cyber-Federalism": [0.5, -0.2, -0.5],
  // Socialist
  "Christian Socialism": [0.7, -0.6, -0.8],
  "National Bolshevism": [-0.7, 0.8, -0.2],
  "Democratic Socialism": [0.8, -0.5, -0.8],
  "Conservative Socialism": [0.4, -0.3, -0.5],
  "Paleosocialism": [0.3, -0.3, -0.3],
  "Cybernetic Socialism": [0.4, -0.2, -0.7],
  "Utopian Communitarianism": [0.3, -0.5, -0.8],
  "Syndicalist Republicanism": [-0.2, 0.5, -0.6],
  "Left-Eurasianism": [null, null, -0.3],
  "Socialist Kemalism": [0.2, 0.4, -0.6],
  "Socialist Technoliberalism": [0.6, -0.5, -0.6],
  "Mugabeism": [-0.3, 0.3, null],
  "Old Left-Populism": [0.3, null, -0.7],
  "Left-State Liberalism": [0.7, -0.6, -0.6],
  "American Technocracy": [-0.2, 0.5, null],
  "Fabian Socialism": [1, -1, -0.8],
  "Ujamaa": [0.4, null, -0.9],
  // Left-Libertarian
  "Libertarian Municipalism": [0.5, -0.1, -0.8],
  "Communalism": [0.5, -0.1, -0.8],
  "Minarcho-Socialism": [0.4, -0.2, -0.5],
  "Libertarian Socialism": [-0.2, 0.6, -0.8],
  "Council Communism": [-0.8, 1, -0.8],
  "Democratic Confederalism": [0.2, 0.4, -0.8],
  "Guild Socialism": [0.4, -0.2, -0.7],
  "Eco-Socialism": [0.2, 0.4, -0.8],
  "Cybersyn Socialism": [0.4, -0.2, -0.7],
  "Fourierism": [0.3, -0.5, -0.8],
  "Gandhian Socialism": [0.6, -0.4, -0.9],
  "Scythianism": [-0.5, 0.8, null],
  "Proutism": [0.4, 0.2, -0.7],
  // Right-Libertarian
  "Neolibertarianism": [0.5, -0.5, 0.3],
  "Libertarian Conservatism": [0.5, -0.7, 0.2],
  "National Libertarianism": [0.4, -0.6, 0.3],
  "Paleolibertarianism": [0.3, -0.5, 0.3],
  "Dark Enlightenment": [-0.5, 0.4, 0.8],
  "Cyber-Libertarianism": [0.3, -0.1, 0.1],
  "Objectivism": [0.4, -0.5, 0.4],
  "Fusionism": [0.5, -0.6, 0.1],
  "Minarcho-Avaritionism": [0.3, -0.3, 0.5],
  "Libertarian Helveticism": [0.8, -0.8, 0.1],
  "Yarvinism": [-0.4, 0.3, 0.6],
  "Landianism": [-0.6, 0.5, 0.8],
  // Left-Anarchist
  "Anarcho-Syndicalism": [-0.8, 1, -0.8],
  "Platformism": [-0.8, 0.9, -0.8],
  "Left-Agorism": [-0.2, 0.6, -0.5],
  "Lys Noir": [-0.3, 0.2, 0.2],
  "Anarcho-Communism": [-0.8, 0.9, -0.9],
  "Solarpunk Anarchism": [-0.2, 0.6, -0.8],
  "Christian Anarchism": [0.1, 0.3, -0.9],
  "Insurrectionary Anarchism": [-1, 1, -0.7],
  "Catholic Workerism": [0.1, 0.3, -0.9],
  // Centre-Anarchist
  "Mutualism": [0.4, 0.2, -0.6],
  "Market Anarchism": [0.1, 0.5, 0.2],
  "Mutualist Distributism": [0.3, 0.1, -0.6],
  "Panarchism": [0.4, -0.1, null],
  "Geoanarchism": [0.2, 0.4, -0.3],
  "Green Anarchism": [-0.3, 0.7, -0.7],
  "Anarcho-Primitivism": [-0.5, 0.9, -0.4],
  "Post-Anarchism": [-0.2, 0.5, -0.5],
  "Post-left": [-0.5, 0.8, -0.5],
  "Anarcho-Transhumanism": [0.1, 0.4, -0.1],
  "Ego-Communism": [-0.3, 0.7, -0.5],
  "National-Anarchism": [-0.3, 0.7, 0.3],
  "Ego-Mutualism": [0.3, 0.1, -0.2],
  "Nihilist Anarchism": [-0.4, 0.7, null],
  // Right-Anarchist
  "Anarcho-Capitalism": [0.1, 0.5, 0.4],
  "Hoppeanism": [-0.1, 0.5, 0.5],
  "Bleeding-Heart Anarcho-Capitalism": [0.3, 0.3, -0.3],
  "Traditionalist Anarcho-Distributism": [0.1, 0.4, -0.2],
  "Crypto-Anarchism": [-0.1, 0.5, 0.2],
  "Avaritionism": [null, 0.4, 0.6],
  "Autarchism": [0.1, 0.4, 0.3],
  "Free-Market Anarcho-Distributism": [0.2, 0.4, -0.2],
  "Agorism": [-0.4, 0.8, 0.3],
  // Accelerationist
  "Left-Accelerationism": [-0.4, 0.7, -0.5],
  "Right-Accelerationism": [-0.6, 0.9, 0.6],
  "Effective Accelerationism": [0.3, 0.1, 0.4],
  "Unconditional Accelerationism": [-0.8, 0.9, 0.6],
  // Dystopian
  "Neo-Libertarian Falangism": [0.2, null, 0.1],
  "Ingsoc": [-0.2, -0.7, 0.3],
  "Neo-Bolshevism": [-0.2, -0.5, 0.3],
  "Obliteration of the Self": [-0.2, -0.5, 0.3],
  "World State Fordism": [-0.2, -0.9, null],
  "Gileadism": [-0.3, -0.7, 0.4],
  "One State Benefactorism": [-0.2, -0.9, null],
  "Cyberpunk Corpostatism": [-0.2, -0.7, 0.6],
  "Fireman Statism": [-0.2, -0.9, null],
  "Soylentism": [-0.3, -0.6, 0.7],
  "Burgundian System": [-0.3, -0.7, 0.8],
  "Russian Imperial Cult": [-0.3, -0.8, 0.2],
  "Anarcho-Fascism": [-0.3, 0.4, 0.3],
};

// ---------------------------------------------------------------------------------------------
function findDeclaration(source, name) {
  const match = new RegExp("\\bconst\\s+" + name + "\\s*=").exec(source);
  if (!match) throw new Error('Could not find "const ' + name + ' =" in data.js');
  const exprStart = source.indexOf("=", match.index) + 1;
  let quote = null, escaped = false, lineComment = false, blockComment = false, depth = 0, end = -1;
  for (let i = exprStart; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i++; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === quote) quote = null; continue; }
    if (c === "/" && n === "/") { lineComment = true; i++; continue; }
    if (c === "/" && n === "*") { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === "`") { quote = c; continue; }
    if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") depth--;
    else if (c === ";" && depth === 0) { end = i + 1; break; }
  }
  if (end < 0) throw new Error('Could not find the end of "' + name + '"');
  return { start: match.index, end, value: vm.runInNewContext("(" + source.slice(exprStart, end - 1).trim() + ")") };
}
function fail(msg) { console.error("STOPPED: " + msg); process.exit(1); }
const parse = s => String(s || "").split("|").filter(Boolean);
const withoutValues = s => parse(s).filter(p => !VALUES.some(v => p.startsWith(v + ":"))).join("|");
const fmt = v => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2))));
function rebuild(base, row) {
  const extra = [];
  VALUES.forEach((v, i) => { if (row[i] !== null && Math.abs(row[i]) >= MIN_STANCE) extra.push(v + ":" + fmt(row[i])); });
  return [withoutValues(base), ...extra].filter(Boolean).join("|");
}

let source = fs.readFileSync(dataPath, "utf8");
const jsonScores = JSON.parse(fs.readFileSync(scoresPath, "utf8"));
const known = findDeclaration(source, "ideologyScores").value;
for (const name of Object.keys(SCORES)) if (!(name in known)) fail("unknown ideology in SCORES: " + name);
for (const name of Object.keys(SCORES)) {
  if (SCORES[name].length !== 3 || SCORES[name].some(v => v !== null && !(v >= -1 && v <= 1))) fail("bad row for " + name);
}
const missing = Object.keys(known).filter(n => !(n in SCORES));
if (missing.length) console.log("Not in the table (left unchanged): " + missing.join(", "));

function rewrite(name, mutate) {
  const d = findDeclaration(source, name);
  const value = mutate(d.value) || d.value;
  source = source.slice(0, d.start) + "const " + name + " = " + JSON.stringify(value, null, 4) + ";" + source.slice(d.end);
}

// 1. colours: cut anything after the colour itself
let repaired = 0;
rewrite("labelColors", v => {
  for (const k of Object.keys(v)) {
    if (typeof v[k] === "string" && v[k].includes("|")) { v[k] = v[k].split("|")[0]; repaired++; }
  }
});

// 2. stances
rewrite("ideologyScores", v => {
  for (const name of Object.keys(SCORES)) v[name] = rebuild(v[name], SCORES[name]);
});
for (const name of Object.keys(SCORES)) {
  if (!jsonScores[name]) fail("ideology missing in ideology_scores.json: " + name);
  jsonScores[name].s = rebuild(jsonScores[name].s, SCORES[name]);
}

// 3. descriptions: text insertion, so comments inside the object stay untouched
{
  const d = findDeclaration(source, "descriptions");
  let body = source.slice(d.start, d.end);
  for (const id of VALUES) body = body.replace(new RegExp('\\n[ \\t]*"' + id + '":[^\\n]*'), "");
  const close = body.lastIndexOf("}");
  let head = body.slice(0, close).replace(/\s+$/, "");
  if (!head.endsWith(",") && !head.endsWith("{")) head += ",";
  const lines = VALUES.map(id => "    " + JSON.stringify(id) + ": " + JSON.stringify(DESCRIPTIONS[id])).join(",\n");
  source = source.slice(0, d.start) + head + "\n" + lines + "\n" + body.slice(close) + source.slice(d.end);
}

// check before writing
const ctx = {};
vm.createContext(ctx);
try { vm.runInContext(source.replace(/^const /gm, "var "), ctx); } catch (e) { fail("data.js would not run: " + e.message); }
for (const id of VALUES) if (ctx.descriptions[id] !== DESCRIPTIONS[id]) fail("description not stored: " + id);
const badColor = Object.entries(ctx.labelColors).filter(([, c]) => typeof c === "string" && c.includes("|"));
if (badColor.length) fail("labelColors still has stance text: " + badColor.map(x => x[0]).join(", "));

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
for (const f of [dataPath, scoresPath]) fs.copyFileSync(f, f + ".backup-social-scores-" + stamp);
fs.writeFileSync(dataPath, source, "utf8");
fs.writeFileSync(scoresPath, JSON.stringify(jsonScores, null, 2) + "\n", "utf8");

const used = VALUES.map((v, i) => Object.values(SCORES).filter(r => r[i] !== null && Math.abs(r[i]) >= MIN_STANCE).length);
console.log("Descriptions written for: " + VALUES.join(", "));
console.log("Ideologies with a stance - Reformism: " + used[0] + ", Revolutionism: " + used[1] + ", Social Darwinism: " + used[2] + " (of " + Object.keys(known).length + ")");
console.log("Colours repaired: " + repaired);
