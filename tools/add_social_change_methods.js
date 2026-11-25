#!/usr/bin/env node
/*
 * Adds three more values to the Social Change category: Guerrilla Warfare, Coupism and Insurrectionism.
 * Run from the project root:  node tools/add_social_change_methods.js
 *
 * What it does
 *   1. Registers the values in resultsMapping.social_change, with a description and an "ai" icon source for each
 *      (the icons themselves are not made here: put icons/social_change/<id>.svg files in place).
 *   2. Extends the question tree of the category: after choosing "a fundamental transformation" the quiz asks by what
 *      means (broad revolution, guerrilla warfare, a coup, or an insurrection).
 *   3. Gives every ideology a stance on each value, from -1 (the ideology opposes it) to +1 (it matches it), in data.js
 *      (ideologyScores) and in ideology_scores.json. Only stances of at least MIN_STANCE in strength are stored.
 *
 * To change a stance, edit its row in SCORES below and run the script again (safe to re-run).
 * data.js, questions_tree.json and ideology_scores.json are backed up first (*.backup-social-methods-<time>).
 * Column order: [Guerrilla Warfare, Coupism, Insurrectionism].
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = process.cwd();
const dataPath = path.join(root, "data.js");
const scoresPath = path.join(root, "ideology_scores.json");
const treePath = path.join(root, "questions_tree.json");
for (const f of [dataPath, scoresPath, treePath]) if (!fs.existsSync(f)) { console.error("Not found: " + f + " (run from the project root)"); process.exit(1); }

const CATEGORY = "social_change";
const MIN_STANCE = 0.7;   // weaker stances are left out: storing every weak opinion makes the ideology ranking drift

const VALUES = ["guerrilla_warfare", "coupism", "insurrectionism"];
const NAMES = { guerrilla_warfare: "Guerrilla Warfare", coupism: "Coupism", insurrectionism: "Insurrectionism" };
const DESCRIPTIONS = {
  guerrilla_warfare:
    "A way of fighting in which small, mobile irregular forces, rooted in the countryside, mountains or cities, wear down a stronger state " +
    "or occupier through ambushes, sabotage and the support of the local population. It is a prolonged struggle that avoids open battle " +
    "and tries to win by exhaustion, legitimacy and control of the ground.",
  coupism:
    "The seizure of state power by a small group already inside or close to the state, usually the military or a faction of officials, " +
    "rather than by a mass movement or an election. It arrests or removes the rulers, takes the capital and the key institutions in a " +
    "sudden blow, and then governs from above.",
  insurrectionism:
    "The belief that the existing order should be attacked directly and immediately, through riots, sabotage, occupations and armed " +
    "uprisings by small autonomous groups or by the crowd, without waiting for parties, unions, elections or a vanguard. It hopes that " +
    "revolt spreads by example and breaks the system's ability to function."
};
const QUESTIONS = {
  guerrilla_warfare: "Through a prolonged armed struggle by small, mobile irregular forces who live among the people and wear down the state",
  coupism: "Through a sudden seizure of power by a small group inside the state, usually the army, who then govern from above",
  insurrectionism: "Through direct uprising: riots, sabotage and attacks on institutions by autonomous groups or the crowd, without parties or leaders"
};
const BREAK_QUESTION = "By what means should the existing order be broken?";
const ROOT_BROAD = "Through a broad revolution that replaces the whole political and social order, whatever form it takes";

// [Guerrilla Warfare, Coupism, Insurrectionism]
const SCORES = {
  // Third Position
  "National Syndicalism": [0.1, 0.4, 0.2],
  "Brazilian Integralism": [0, 0.7, 0.1],
  "Italian Fascism": [0, 0.3, 0.4],
  "Evolianism": [-0.1, 0.2, 0.1],
  "Futurism": [0, 0.3, 0.5],
  "National-Socialism": [0, 0.6, 0.3],
  "Neo-Nazism": [0.2, 0.5, 0.3],
  "Agrarian Fascism": [0.1, 0.3, 0.1],
  "Strasserism": [0.1, 0.4, 0.3],
  "Falangism": [0.1, 0.8, 0.2],
  "Sansepolcrismo": [0.1, 0.4, 0.3],
  "Ecofascism": [0.2, 0.3, 0.2],
  "Sorelianism": [0.2, 0, 0.8],
  "Legionarianism": [0.5, 0.6, 0.5],
  "Peronism": [-0.3, 0.6, -0.3],
  "Techno-Fascism": [-0.1, 0.4, 0],
  "National Solidarity": [-0.3, 0.2, -0.3],
  "Clerical Fascism": [0, 0.5, 0.1],
  "Rexism": [-0.1, 0.3, 0],
  "Ba'athism": [0.1, 0.9, 0.1],
  "Cosmist Vanguardism": [-0.2, 0.3, -0.2],
  "Duginism": [0.2, 0.2, 0.1],
  "Fiumanism": [0.2, 0.7, 0.2],
  "Pekerism": [-0.4, 0.6, -0.5],
  "Ethnonationalist Kemalism": [-0.2, 0.4, -0.3],
  "Eneasism": [-0.5, -0.2, -0.5],
  "Social Nationalism": [-0.5, -0.2, -0.5],
  "Ethnocacerismo": [0.7, 0.3, 0.3],
  "National Primitivism": [0.5, 0.1, 0.5],
  "Social-Bonapartism": [0, 0.9, 0],
  "Tridemism": [-0.2, 0.2, -0.2],
  "Nationalist Kemalism": [-0.3, 0.4, -0.4],
  "National Collectivism": [0.1, 0.5, 0.1],
  "Nazi-Maoism": [0.6, 0.4, 0.5],
  "Savinkovism": [0.5, 0.5, 0.4],
  "Mosleyism": [-0.2, 0.2, 0.1],
  "Revolutionary Nationalism": [0.7, 0.4, 0.5],
  "Paetel's National Bolshevism": [0.3, 0.5, 0.3],
  "National Radicalism": [0.3, 0.6, 0.3],
  // Reactionary
  "Volkism": [0.2, 0.3, 0.1],
  "Optimateism": [-0.4, 0.1, -0.7],
  "Integralism": [-0.4, 0.2, -0.7],
  "National Capitalism": [-0.6, 0.1, -0.8],
  "Carlism": [0.6, 0.5, -0.2],
  "Autocratic Monarchism": [-0.5, 0.3, -0.7],
  "Theocratic Distributism": [-0.3, 0.2, -0.6],
  "Reactionary Feudalism": [-0.1, 0.4, -0.5],
  "Neo-Absolutism": [-0.3, 0.5, -0.5],
  "Aristocratic Cameralism": [-0.4, 0.1, -0.7],
  "Feudal Monarchism": [-0.4, 0.1, -0.7],
  "Clerical Monarchism": [-0.4, 0.1, -0.7],
  "Developmental Theocracy": [-0.3, 0.3, -0.5],
  "Classical Eurasianism": [-0.1, 0.1, -0.4],
  "Mladorossism": [-0.1, 0.3, -0.2],
  "National Social Capitalism": [-0.4, 0.1, -0.7],
  "Right-State Liberalism": [-0.7, 0.1, -0.9],
  "Monarquia Syndicalista": [-0.4, 0.1, -0.7],
  "Serenissimism": [-0.4, 0.1, -0.7],
  // Conservative
  "National Conservatism": [-0.7, -0.4, -0.8],
  "Paternalistic Conservatism": [-0.7, -0.4, -0.8],
  "Buchanan Paleoconservatism": [-0.7, -0.4, -0.8],
  "Hard Right Paleoconservatism": [-0.3, 0, -0.5],
  "Old Right Paleoconservatism": [-0.4, -0.3, -0.6],
  "Neoconservatism": [-0.7, -0.4, -0.8],
  "Mesoconservatism": [-0.7, -0.4, -0.8],
  "Red Toryism": [-0.7, -0.4, -0.8],
  "Green Conservatism": [-0.7, -0.4, -0.8],
  "Clerical Conservatism": [-0.7, -0.4, -0.8],
  "Gaullism": [-0.6, -0.1, -0.8],
  "Free-Market Conservatism": [-0.7, -0.4, -0.8],
  "Agrarian Conservatism": [-0.7, -0.4, -0.8],
  "Liberal Toryism": [-0.7, -0.4, -0.8],
  "Social Gaullism": [-0.7, -0.4, -0.8],
  "Neo-Gaullism": [-0.7, -0.4, -0.8],
  "Bonapartist Gaullism": [-0.5, 0.4, -0.7],
  "Conservative Atlanticism": [-0.7, -0.4, -0.8],
  "Neoconservative Atlanticism": [-0.7, -0.4, -0.8],
  "One-Nation Conservatism": [-0.7, -0.4, -0.8],
  "Conservative Kemalism": [-0.6, 0.3, -0.8],
  "Conservative Technoliberalism": [-0.7, -0.4, -0.8],
  "Right-Social Authoritarianism": [-0.4, 0.6, -0.7],
  "Kjærsgaardism": [-0.7, -0.4, -0.8],
  "Kekkonism": [-0.8, -0.8, -0.9],
  "Reform Gaullism": [-0.7, -0.4, -0.8],
  "Paleoconservatism": [-0.7, -0.4, -0.8],
  "Putinism": [-0.4, 0.1, -0.9],
  "Post-Soviet Autocracy": [-0.4, 0.1, -0.9],
  // Centrist
  "Radicalism": [-0.8, -0.8, -0.9],
  "Third Way": [-0.8, -0.8, -0.9],
  "Christian Democracy": [-0.8, -0.8, -0.9],
  "Compassionate Conservatism": [-0.8, -0.8, -0.9],
  "Rockefeller Republicanism": [-0.8, -0.8, -0.9],
  "Democratic Transhumanism": [-0.8, -0.8, -0.9],
  "Neo-Solidarism": [-0.8, -0.8, -0.9],
  "Steppe Eurasianism": [-0.8, -0.8, -0.9],
  "Classical Kemalism": [-0.8, -0.8, -0.9],
  "Centrist Kemalism": [-0.8, -0.8, -0.9],
  "Catholic Social Teaching": [-0.8, -0.8, -0.9],
  "Bleeding-Heart Authoritarianism": [-0.4, 0.4, -0.6],
  "Austro-Corporatism": [-0.8, -0.8, -0.9],
  "Davos System": [-0.8, -0.8, -0.9],
  // Centre-Left
  "Nordic Model": [-0.8, -0.8, -0.9],
  "Social Democracy": [-0.9, -0.9, -1],
  "Conservative Social Democracy": [-0.8, -0.8, -0.9],
  "Social Distributism": [-0.8, -0.8, -0.9],
  "Liberal Socialism": [-0.8, -0.8, -0.9],
  "Social Georgism": [-0.8, -0.8, -0.9],
  "Agrarian Social Democracy": [-0.8, -0.8, -0.9],
  "Progressive Corporatism": [-0.8, -0.8, -0.9],
  "Left-Gaullism": [-0.8, -0.8, -0.9],
  "Labour Atlanticism": [-0.8, -0.8, -0.9],
  "Green Social Democracy": [-0.8, -0.8, -0.9],
  "Geo-Social Democracy": [-0.8, -0.8, -0.9],
  "Christian Social Democracy": [-0.8, -0.8, -0.9],
  "Police Labourism": [-0.8, -0.8, -0.9],
  "Ecevitism": [-0.7, -0.6, -0.8],
  "Left-Social Authoritarianism": [-0.2, 0.6, -0.4],
  "Progressive Social Authoritarianism": [-0.3, 0.6, -0.5],
  "Left-Wing Populism": [-0.3, -0.4, -0.1],
  "Left-Social Democracy": [-0.8, -0.8, -0.9],
  "Social-Helveticism": [-0.8, -0.8, -0.9],
  "Left Kemalism": [-0.3, 0.3, -0.5],
  "Longism": [-0.8, -0.8, -0.9],
  // Marxist
  "Eurocommunism": [-0.8, -0.8, -0.8],
  "Bordigism": [0.1, 0.2, 0.1],
  "Italian Left Communism": [0.1, 0.1, 0.4],
  "Juche": [0.6, 0.2, 0.1],
  "Mao Zedong Thought": [1, -0.2, 0.3],
  "Maoism Third Worldism": [1, -0.2, 0.3],
  "Marxism Leninism Maoism": [1, -0.2, 0.3],
  "Luxemburgism": [0.1, -0.8, 0.7],
  "Trotskyism": [0.3, -0.3, 0.5],
  "Marxism-Leninism": [0.6, 0.5, 0.5],
  "Stalinism": [0.2, 0.4, 0.1],
  "Titoism": [0.7, 0.2, 0.2],
  "Dengism": [0, 0.1, -0.5],
  "Hoxhaism": [0.6, 0.2, 0.3],
  "Castroism": [0.9, 0.3, 0.4],
  "Guevarism": [1, 0.1, 0.6],
  "Cyber-Communism": [-0.2, 0.1, -0.3],
  "De Leonism": [0, -0.5, 0.4],
  "Marxism-Kemalism": [0, 0.3, 0],
  "National Communism": [0.3, 0.4, 0.2],
  // Liberal
  "Classical Liberalism": [-0.8, -0.8, -0.9],
  "Neoliberalism": [-0.8, -0.8, -0.9],
  "National Liberalism": [-0.8, -0.8, -0.9],
  "Social Liberalism": [-0.8, -0.8, -0.9],
  "Ordoliberalism": [-0.8, -0.8, -0.9],
  "Bleeding-Heart Liberalism": [-0.8, -0.8, -0.9],
  "Geo-Liberalism": [-0.8, -0.8, -0.9],
  "Green Liberalism": [-0.8, -0.8, -0.9],
  "Whiggism": [-0.8, -0.8, -0.9],
  "Muscular Liberalism": [-0.8, -0.8, -0.9],
  "Liberal Atlanticism": [-0.8, -0.8, -0.9],
  "Transatlantic Federalism": [-0.8, -0.8, -0.9],
  "New Deal Liberalism": [-0.8, -0.8, -0.9],
  "Venizelism": [-0.8, -0.8, -0.9],
  "Liberal Kemalism": [-0.8, -0.8, -0.9],
  "Liberal Social Authoritarianism": [-0.5, 0.4, -0.7],
  "Techno-Social Liberalism": [-0.8, -0.8, -0.9],
  "Technoliberalism": [-0.8, -0.8, -0.9],
  "American Model": [-0.8, -0.8, -0.9],
  "Techno-Neoliberalism": [-0.8, -0.8, -0.9],
  "Tsaingwenism": [-0.8, -0.8, -0.9],
  "Liberal Imperialism": [-0.8, -0.8, -0.9],
  "Liberal Meritocracy": [-0.8, -0.8, -0.9],
  // Centre-Libertarian
  "Bleeding-Heart Libertarianism": [-0.6, -0.7, -0.6],
  "Geolibertarianism": [-0.6, -0.7, -0.6],
  "Social Libertarianism": [-0.6, -0.7, -0.6],
  "Helvetic Model": [-0.6, -0.7, -0.6],
  "Minarcho-Distributism": [-0.6, -0.7, -0.6],
  "Pirate Politics": [-0.6, -0.7, -0.6],
  "Agorist Minarchism": [-0.6, -0.7, -0.6],
  "Communal Distributism": [-0.6, -0.7, -0.6],
  "Yangism": [-0.6, -0.7, -0.6],
  "Libertarian Social Democracy": [-0.6, -0.7, -0.6],
  "Progressive Helveticism": [-0.6, -0.7, -0.6],
  "Cosmopolitan Distributism": [-0.6, -0.7, -0.6],
  "Cyber-Federalism": [-0.6, -0.7, -0.6],
  // Socialist
  "Christian Socialism": [-0.8, -0.7, -0.8],
  "National Bolshevism": [0.4, 0.6, 0.3],
  "Democratic Socialism": [-0.7, -0.8, -0.8],
  "Conservative Socialism": [-0.5, -0.5, -0.6],
  "Paleosocialism": [-0.5, -0.5, -0.6],
  "Cybernetic Socialism": [-0.5, -0.5, -0.6],
  "Utopian Communitarianism": [-0.9, -0.8, -0.8],
  "Syndicalist Republicanism": [-0.2, -0.6, 0.2],
  "Left-Eurasianism": [0, 0.1, -0.3],
  "Socialist Kemalism": [-0.2, 0.3, -0.4],
  "Socialist Technoliberalism": [-0.5, -0.5, -0.6],
  "Mugabeism": [0.5, 0.3, 0],
  "Old Left-Populism": [-0.5, -0.5, -0.6],
  "Left-State Liberalism": [-0.5, -0.5, -0.6],
  "American Technocracy": [-0.4, 0.3, -0.5],
  "Fabian Socialism": [-1, -1, -1],
  "Ujamaa": [-0.3, -0.4, -0.6],
  // Left-Libertarian
  "Libertarian Municipalism": [-0.4, -0.9, -0.2],
  "Communalism": [-0.4, -0.9, 0.1],
  "Minarcho-Socialism": [-0.5, -0.9, -0.4],
  "Libertarian Socialism": [0.2, -0.9, 0.4],
  "Council Communism": [-0.2, -0.8, 0.1],
  "Democratic Confederalism": [0.7, -0.7, 0.4],
  "Guild Socialism": [-0.6, -0.8, -0.5],
  "Eco-Socialism": [0, -0.7, 0.3],
  "Cybersyn Socialism": [-0.4, -0.7, -0.5],
  "Fourierism": [-0.8, -0.8, -0.8],
  "Gandhian Socialism": [-1, -0.9, -0.9],
  "Scythianism": [0.5, 0.3, 0.7],
  "Proutism": [-0.2, -0.5, 0],
  // Right-Libertarian
  "Neolibertarianism": [-0.5, -0.6, -0.5],
  "Libertarian Conservatism": [-0.5, -0.6, -0.5],
  "National Libertarianism": [-0.5, -0.6, -0.5],
  "Paleolibertarianism": [-0.5, -0.6, -0.5],
  "Dark Enlightenment": [-0.2, 0.7, -0.3],
  "Cyber-Libertarianism": [-0.5, -0.6, -0.5],
  "Objectivism": [-0.5, -0.6, -0.5],
  "Fusionism": [-0.5, -0.6, -0.5],
  "Minarcho-Avaritionism": [-0.5, -0.6, -0.5],
  "Libertarian Helveticism": [-0.5, -0.6, -0.5],
  "Yarvinism": [-0.3, 0.7, -0.4],
  "Landianism": [-0.1, 0.3, 0],
  // Left-Anarchist
  "Anarcho-Syndicalism": [0.3, -0.9, 0.6],
  "Platformism": [0.4, -0.9, 0.2],
  "Left-Agorism": [0.4, -0.8, 0.5],
  "Lys Noir": [-0.2, 0.1, -0.2],
  "Anarcho-Communism": [0.4, -0.9, 0.7],
  "Solarpunk Anarchism": [0.1, -0.9, 0.5],
  "Christian Anarchism": [-0.9, -0.9, -0.8],
  "Insurrectionary Anarchism": [0.6, -1, 1],
  "Catholic Workerism": [-0.9, -0.9, -0.8],
  // Centre-Anarchist
  "Mutualism": [-0.3, -0.9, 0.1],
  "Market Anarchism": [0, -0.8, 0.5],
  "Mutualist Distributism": [0, -0.8, 0.5],
  "Panarchism": [-0.6, -0.9, -0.3],
  "Geoanarchism": [0, -0.8, 0.5],
  "Green Anarchism": [0.5, -0.9, 0.7],
  "Anarcho-Primitivism": [0.4, -0.9, 0.7],
  "Post-Anarchism": [0, -0.8, 0.5],
  "Post-left": [0.2, -0.9, 0.8],
  "Anarcho-Transhumanism": [-0.1, -0.8, 0.2],
  "Ego-Communism": [0.1, -0.9, 0.7],
  "National-Anarchism": [0.3, -0.7, 0.5],
  "Ego-Mutualism": [-0.2, -0.9, 0],
  "Nihilist Anarchism": [0.3, -0.9, 0.9],
  // Right-Anarchist
  "Anarcho-Capitalism": [0, -0.8, 0.2],
  "Hoppeanism": [-0.2, -0.5, 0],
  "Bleeding-Heart Anarcho-Capitalism": [0, -0.7, 0.3],
  "Traditionalist Anarcho-Distributism": [0, -0.7, 0.3],
  "Crypto-Anarchism": [0, -0.7, 0.2],
  "Avaritionism": [-0.2, -0.6, 0],
  "Autarchism": [0, -0.7, 0.2],
  "Free-Market Anarcho-Distributism": [0, -0.7, 0.3],
  "Agorism": [0.3, -0.8, 0.3],
  // Accelerationist
  "Left-Accelerationism": [0, -0.2, 0.4],
  "Right-Accelerationism": [0.2, 0.4, 0.5],
  "Effective Accelerationism": [-0.5, -0.5, -0.6],
  "Unconditional Accelerationism": [0.1, 0.1, 0.5],
  // Dystopian
  "Neo-Libertarian Falangism": [-0.3, 0.1, -0.4],
  "Ingsoc": [-0.5, -0.4, -0.8],
  "Neo-Bolshevism": [-0.5, -0.4, -0.8],
  "Obliteration of the Self": [-0.5, -0.4, -0.8],
  "World State Fordism": [-0.5, -0.4, -0.8],
  "Gileadism": [-0.5, -0.4, -0.8],
  "One State Benefactorism": [-0.5, -0.4, -0.8],
  "Cyberpunk Corpostatism": [-0.5, -0.4, -0.8],
  "Fireman Statism": [-0.5, -0.4, -0.8],
  "Soylentism": [-0.5, -0.4, -0.8],
  "Burgundian System": [-0.5, -0.4, -0.8],
  "Russian Imperial Cult": [-0.5, -0.4, -0.8],
  "Anarcho-Fascism": [0.4, 0.3, 0.4],
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
const tree = JSON.parse(fs.readFileSync(treePath, "utf8"));
const known = findDeclaration(source, "ideologyScores").value;
const registry = findDeclaration(source, "resultsMapping").value;
if (!registry[CATEGORY]) fail('category "' + CATEGORY + '" not found in resultsMapping (is the Social Change category in data.js?)');
if (!tree[CATEGORY]) fail('category "' + CATEGORY + '" not found in questions_tree.json');
for (const [cat, vals] of Object.entries(registry)) if (cat !== CATEGORY) for (const id of VALUES) if (id in vals) fail(id + " already exists in " + cat);
for (const name of Object.keys(SCORES)) {
  if (!(name in known)) fail("unknown ideology in SCORES: " + name);
  if (SCORES[name].length !== 3 || SCORES[name].some(v => v !== null && !(v >= -1 && v <= 1))) fail("bad row for " + name);
}
const missing = Object.keys(known).filter(n => !(n in SCORES));
if (missing.length) console.log("Not in the table (left unchanged): " + missing.join(", "));

function rewrite(name, mutate) {
  const d = findDeclaration(source, name);
  const value = mutate(d.value) || d.value;
  source = source.slice(0, d.start) + "const " + name + " = " + JSON.stringify(value, null, 4) + ";" + source.slice(d.end);
}
rewrite("resultsMapping", v => { for (const id of VALUES) v[CATEGORY][id] = NAMES[id]; });
rewrite("iconSources", v => { for (const id of VALUES) if (!(id in v)) v[id] = "ai"; });
rewrite("ideologyScores", v => { for (const name of Object.keys(SCORES)) v[name] = rebuild(v[name], SCORES[name]); });
for (const name of Object.keys(SCORES)) {
  if (!jsonScores[name]) fail("ideology missing in ideology_scores.json: " + name);
  jsonScores[name].s = rebuild(jsonScores[name].s, SCORES[name]);
}
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

// question tree: root -> (reform | break) ; break -> (revolution | guerrilla | coup | insurrection)
{
  const nodes = tree[CATEGORY];
  const root = nodes[0];
  if (!root || !Array.isArray(root.options)) fail("unexpected question tree for " + CATEGORY);
  const toBreak = root.options.find(o => o.next === "revolutionism" || o.next === "sch_break");
  if (!toBreak) fail("could not find the revolution answer in the root question of " + CATEGORY);
  toBreak.next = "sch_break";
  const breakNode = {
    id: "sch_break",
    text: BREAK_QUESTION,
    options: [
      { text: ROOT_BROAD, next: "revolutionism" },
      ...VALUES.map(id => ({ text: QUESTIONS[id], next: id }))
    ]
  };
  const at = nodes.findIndex(n => n.id === "sch_break");
  if (at >= 0) nodes[at] = breakNode; else nodes.splice(1, 0, breakNode);
  for (const id of VALUES) if (!nodes.some(n => n.id === id)) nodes.push({ id });
}

// check before writing anything
const ctx = {};
vm.createContext(ctx);
try { vm.runInContext(source.replace(/^const /gm, "var "), ctx); } catch (e) { fail("data.js would not run: " + e.message); }
for (const id of VALUES) {
  if (ctx.resultsMapping[CATEGORY][id] !== NAMES[id]) fail(id + " not registered");
  if (ctx.descriptions[id] !== DESCRIPTIONS[id]) fail(id + " description not stored");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
for (const f of [dataPath, scoresPath, treePath]) fs.copyFileSync(f, f + ".backup-social-methods-" + stamp);
fs.writeFileSync(dataPath, source, "utf8");
fs.writeFileSync(scoresPath, JSON.stringify(jsonScores, null, 2) + "\n", "utf8");
fs.writeFileSync(treePath, JSON.stringify(tree, null, 2) + "\n", "utf8");

const used = VALUES.map((v, i) => Object.values(SCORES).filter(r => r[i] !== null && Math.abs(r[i]) >= MIN_STANCE).length);
console.log("Added to " + CATEGORY + ": " + VALUES.map(id => NAMES[id]).join(", "));
console.log("Ideologies with a stance - " + VALUES.map((id, i) => NAMES[id] + ": " + used[i]).join(", ") + " (of " + Object.keys(known).length + ")");
console.log("Icons are not created: add icons/" + CATEGORY + "/{" + VALUES.join(",") + "}.svg");
