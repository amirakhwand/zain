// Fills 5x5 mini crossword grids with common words. Run once to choose the
// grids; clues are then written by hand in scripts/content/mini.mjs.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const wl = require("wordlist-english");
const tierOf = new Map();
for (const t of [10, 20, 35]) for (const r of ["english", "english/american"]) for (const w of wl[`${r}/${t}`]) if (/^[a-z]+$/.test(w) && !tierOf.has(w)) tierOf.set(w, t);
const bad = new Set("lust moron hated coke gay hes cant ass bigot naked ken sic devil evil hate pope bible lord anal anus arse butt crap damn dick hell piss shit slut tits turd cock porn rape sexy nude kill dead died gays fags homo".split(" "));
const byLen = {};
for (const [w, t] of tierOf) {
  if (bad.has(w) || w.length < 3 || w.length > 5) continue;
  if (w.length >= 4 && t > 20) continue; // long answers: very common only
  if (w.length === 3 && t > 20) continue;
  if (w.endsWith("s") && !w.endsWith("ss") && w.length >= 4) continue; // avoid plural fills
  (byLen[w.length] ??= []).push(w.toUpperCase());
}
const PATTERNS = [
  ["#....", ".....", ".....", ".....", "....#"],
  ["##...", "#....", ".....", "....#", "...##"],
  ["....#", ".....", ".....", ".....", "#...."],
  ["#...#", ".....", ".....", ".....", "#...#"],
  ["...##", "....#", ".....", "#....", "##..."],
];
function slots(p) {
  const out = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    if (p[r][c] === "#") continue;
    if ((c === 0 || p[r][c - 1] === "#") && c + 1 < 5 && p[r][c + 1] !== "#") { const cells = []; for (let k = c; k < 5 && p[r][k] !== "#"; k++) cells.push(r * 5 + k); if (cells.length >= 3) out.push({ dir: "A", cells }); }
    if ((r === 0 || p[r - 1][c] === "#") && r + 1 < 5 && p[r + 1][c] !== "#") { const cells = []; for (let k = r; k < 5 && p[k][c] !== "#"; k++) cells.push(k * 5 + c); if (cells.length >= 3) out.push({ dir: "D", cells }); }
  }
  return out;
}
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function fill(p, r, avoid) {
  const S = slots(p), grid = new Array(25).fill(null);
  for (let i = 0; i < 25; i++) if (p[Math.floor(i / 5)][i % 5] === "#") grid[i] = "#";
  const used = new Set(); let budget = 200000;
  const fits = (s, w) => s.cells.every((c, k) => grid[c] === null || grid[c] === w[k]);
  function solve() {
    const open = S.filter((s) => s.cells.some((c) => grid[c] === null));
    if (!open.length) return true;
    if (--budget < 0) return false;
    let best = null, bestC = null;
    for (const s of open) { const c = byLen[s.cells.length].filter((w) => !used.has(w) && fits(s, w)); if (!best || c.length < bestC.length) { best = s; bestC = c; } if (!c.length) return false; }
    const cands = bestC.map((w) => [w, r() + (avoid.has(w) ? 0.8 : 0)]).sort((a, b) => a[1] - b[1]).map((x) => x[0]).slice(0, 40);
    for (const w of cands) {
      const prev = best.cells.map((c) => grid[c]);
      best.cells.forEach((c, k) => (grid[c] = w[k])); used.add(w);
      // every other slot must still be fillable and full slots must be real words
      const fullWords = S.filter((s) => s.cells.every((c) => grid[c] !== null)).map((s) => s.cells.map((c) => grid[c]).join(""));
      if (new Set(fullWords).size === fullWords.length && S.every((s) => { const full = s.cells.every((c) => grid[c] !== null); const word = s.cells.map((c) => grid[c]).join(""); return full ? byLen[s.cells.length].includes(word) : true; }) && solve()) return true;
      used.delete(w); best.cells.forEach((c, k) => (grid[c] = prev[k]));
      if (budget < 0) return false;
    }
    return false;
  }
  return solve() ? { pattern: p, grid: grid.join(""), slots: S.map((s) => ({ dir: s.dir, cells: s.cells, word: s.cells.map((c) => grid[c]).join("") })) } : null;
}
// Keep the grids already in use; add new ones after them (TARGET total).
import { readFileSync, existsSync } from "node:fs";
const FILE = new URL("./content/mini-grids.json", import.meta.url);
const TARGET = Number(process.env.MINI_TARGET || 120);
const out = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : [];
const keep = out.length;
const seen = new Set(out.flatMap((g) => g.slots.map((s) => s.word)));
const gridsSeen = new Set(out.map((g) => g.grid));
const r = rng(31121 + keep);
for (let i = 0; out.length < TARGET && i < 4000; i++) {
  const res = fill(PATTERNS[i % PATTERNS.length], r, seen);
  if (res && !gridsSeen.has(res.grid)) { out.push(res); gridsSeen.add(res.grid); res.slots.forEach((s) => seen.add(s.word)); }
}
writeFileSync(FILE, JSON.stringify(out, null, 0));
const all = [...new Set(out.flatMap((g) => g.slots.map((s) => s.word)))].sort();
console.log(out.length, "grids (" + keep + " kept),", all.length, "distinct words");
