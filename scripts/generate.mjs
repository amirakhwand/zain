// Builds the dictionary (public/words.js) and the daily puzzle database
// (public/puzzles.js) for the ZAIN word ladder.
//
//   npm install            # once, installs the word list
//   npm run generate       # rebuilds both files
//
// Every puzzle is guaranteed solvable, and its "par" is the true shortest
// number of steps to ZAIN using any accepted word. The intended solution
// only uses common words, so the puzzle is always fair.

import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const wordlist = require("wordlist-english");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const TARGET = "zain";
const LAUNCH_DATE = "2026-11-05"; // Puzzle #1 (local date of the player)
// Puzzles already played before the schedule was regenerated stay fixed.
const PINNED = ["pins"];          // #1 = 5 Nov 2026
const DAYS = 365 * 4;             // How many daily puzzles to schedule
const SEED = 20261106;            // Change to reshuffle the schedule

// ---- 1. Dictionary -------------------------------------------------------
// SCOWL tiers: 10-35 = everyday words, 40-70 = rarer but real words.
const COMMON_MAX = 35;
const tiers = [10, 20, 35, 40, 50, 55, 60, 70];
const tierOf = new Map();
for (const t of tiers)
  for (const region of ["english", "english/american", "english/british"])
    for (const w of wordlist[`${region}/${t}`])
      if (/^[a-z]{4}$/.test(w) && !tierOf.has(w)) tierOf.set(w, t);
tierOf.set(TARGET, 10);

const blocklist = new Set(
  readFileSync(join(root, "scripts/blocklist.txt"), "utf8")
    .split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#"))
);

const valid = [...tierOf.keys()].sort();
const common = valid.filter((w) => tierOf.get(w) <= COMMON_MAX && !blocklist.has(w));
const commonSet = new Set(common);
const validSet = new Set(valid);

// ---- 2. Graph search -----------------------------------------------------
function neighbours(word, set) {
  const out = [];
  for (let i = 0; i < 4; i++)
    for (let c = 97; c <= 122; c++) {
      const ch = String.fromCharCode(c);
      if (ch === word[i]) continue;
      const n = word.slice(0, i) + ch + word.slice(i + 1);
      if (set.has(n)) out.push(n);
    }
  return out;
}
function bfsFromTarget(set) {
  const dist = new Map([[TARGET, 0]]);
  const next = new Map(); // word -> next word on a shortest path to TARGET
  const queue = [TARGET];
  for (let q = 0; q < queue.length; q++) {
    const w = queue[q];
    for (const n of neighbours(w, set))
      if (!dist.has(n)) { dist.set(n, dist.get(w) + 1); next.set(n, w); queue.push(n); }
  }
  return { dist, next };
}
const full = bfsFromTarget(validSet);
const easy = bfsFromTarget(new Set([...commonSet, TARGET]));

// ---- 3. Candidate start words -------------------------------------------
// A good start word is common, 3-7 steps from ZAIN, and its par (using any
// valid word) equals its shortest path using only common words.
const candidates = common.filter((w) => {
  const d = easy.dist.get(w);
  return w !== TARGET && d >= 3 && d <= 7 && full.dist.get(w) === d;
});
const byPar = {};
for (const w of candidates) (byPar[easy.dist.get(w)] ??= []).push(w);

// ---- 4. Daily schedule ---------------------------------------------------
// Difficulty follows the week: easy at the start, hardest at the weekend.
// Mon=0 ... Sun=6  →  preferred par
const parByWeekday = [3, 4, 4, 5, 5, 6, 6];

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const pools = {};
for (const p of Object.keys(byPar)) pools[p] = shuffle(byPar[p]);
const used = new Set();
function take(par) {
  // Try the preferred par, then nearby ones, so we never run dry.
  for (const p of [par, par - 1, par + 1, par - 2, par + 2, par + 3, par - 3]) {
    const pool = pools[p];
    while (pool && pool.length) {
      const w = pool.pop();
      if (!used.has(w)) { used.add(w); return w; }
    }
  }
  used.clear(); // Database exhausted: start a fresh cycle.
  for (const p of Object.keys(byPar)) pools[p] = shuffle(byPar[p]);
  return take(par);
}

const launch = new Date(LAUNCH_DATE + "T00:00:00Z");
const pathOf = (w) => { const p = [w]; while (p.at(-1) !== TARGET) p.push(easy.next.get(p.at(-1))); return p; };
const puzzles = [];
for (const w of PINNED) used.add(w);
for (let i = 0; i < DAYS; i++) {
  const date = new Date(launch.getTime() + i * 86400000);
  const weekday = (date.getUTCDay() + 6) % 7;
  const start = i < PINNED.length ? PINNED[i] : take(parByWeekday[weekday]);
  puzzles.push({ n: i + 1, date: date.toISOString().slice(0, 10), start, par: easy.dist.get(start), solution: pathOf(start) });
}

// ---- 5. Write output -----------------------------------------------------
mkdirSync(join(root, "public"), { recursive: true });
const header = "// AUTO-GENERATED by scripts/generate.mjs. Do not edit by hand.\n";
writeFileSync(join(root, "public/words.js"),
  header +
  `window.ZAIN_WORDS = {\n  target: ${JSON.stringify(TARGET)},\n` +
  `  common: ${JSON.stringify(common.join(" "))},\n` +
  `  extra: ${JSON.stringify(valid.filter((w) => !commonSet.has(w)).join(" "))}\n};\n`);
writeFileSync(join(root, "public/puzzles.js"),
  header +
  `window.ZAIN_PUZZLES = {\n  launch: ${JSON.stringify(LAUNCH_DATE)},\n` +
  `  // [start word, par] for puzzle #1, #2, ... (one per day)\n` +
  `  days: [\n${puzzles.map((p) => `    [${JSON.stringify(p.start)},${p.par}]`).join(",\n")}\n  ],\n` +
  `  // Start words for Unlimited mode\n  unlimited: ${JSON.stringify(candidates.join(" "))}\n};\n`);
writeFileSync(join(root, "data/schedule.csv"),
  "puzzle,date,start,par,solution\n" +
  puzzles.map((p) => `${p.n},${p.date},${p.start.toUpperCase()},${p.par},${p.solution.join(" > ").toUpperCase()}`).join("\n") + "\n");

console.log(`Dictionary: ${valid.length} valid words (${common.length} common)`);
console.log(`Start words that reach ZAIN: ${candidates.length}`,
  Object.fromEntries(Object.entries(byPar).map(([k, v]) => [`par ${k}`, v.length])));
console.log(`Scheduled ${DAYS} daily puzzles: ${puzzles[0].date} → ${puzzles.at(-1).date}`);
console.log("First week:"); for (const p of puzzles.slice(0, 7)) console.log(`  #${p.n} ${p.date}  ${p.solution.join(" → ").toUpperCase()}`);
