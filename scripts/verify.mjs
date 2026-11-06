// Checks every scheduled daily puzzle: start word is valid and ZAIN is
// reachable in exactly `par` steps. Run with: npm test
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ctx = { window: {} };
vm.runInNewContext(readFileSync(new URL("../public/words.js", import.meta.url), "utf8"), ctx);
vm.runInNewContext(readFileSync(new URL("../public/puzzles.js", import.meta.url), "utf8"), ctx);
const { ZAIN_WORDS: W, ZAIN_PUZZLES: P } = ctx.window;
const valid = new Set([...W.common.split(" "), ...W.extra.split(" "), W.target]);

const dist = new Map([[W.target, 0]]);
const q = [W.target];
for (let i = 0; i < q.length; i++)
  for (let p = 0; p < 4; p++)
    for (let c = 97; c <= 122; c++) {
      const n = q[i].slice(0, p) + String.fromCharCode(c) + q[i].slice(p + 1);
      if (valid.has(n) && !dist.has(n)) { dist.set(n, dist.get(q[i]) + 1); q.push(n); }
    }

let bad = 0;
P.days.forEach(([start, par], i) => {
  if (!valid.has(start) || dist.get(start) !== par) { bad++; console.error(`#${i + 1} ${start}: par ${par}, actual ${dist.get(start)}`); }
});
for (const w of P.unlimited.split(" ")) if (!dist.has(w)) { bad++; console.error(`unlimited ${w} unreachable`); }
console.log(bad ? `${bad} problems` : `OK: all ${P.days.length} daily puzzles and ${P.unlimited.split(" ").length} unlimited words reach ZAIN at their par.`);
process.exit(bad ? 1 : 0);
