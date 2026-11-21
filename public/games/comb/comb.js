(() => {
  "use strict";
  const D = ZG.comb, $ = (id) => document.getElementById(id);
  const KEY = "zg-comb";
  const RANKS = [["Starting", 0], ["Warming up", 2], ["Getting there", 5], ["Solid", 8], ["Nice", 15], ["Great", 25], ["Amazing", 40], ["Brilliant", 50], ["Zain-level", 70]];
  let n, center, outer, answers, max, state, typed = "";

  const isPangram = (w) => new Set(w).size === 7;
  const points = (w) => (w.length === 4 ? 1 : w.length) + (isPangram(w) ? 7 : 0);
  const rankIndex = (score) => { let i = 0; RANKS.forEach(([, pct], k) => { if (score >= Math.round((max * pct) / 100)) i = k; }); return i; };

  function load() {
    n = ZG.dayIndex(D.launch) + 1;
    const d = D.days[(n - 1) % D.days.length];
    center = d[0]; outer = d[1].split(""); answers = new Set(d[2].split(" "));
    max = [...answers].reduce((s, w) => s + points(w), 0);
    const saved = ZG.store.get(KEY, null);
    state = saved && saved.n === n ? saved : { n, found: [], top: false };
    typed = "";
    document.querySelector(".zg-title span").textContent = ZG.puzzleTitle(n);
    drawHive(); render();
  }
  const save = () => ZG.store.set(KEY, state);
  const score = () => state.found.reduce((s, w) => s + points(w), 0);

  function drawHive() {
    const hive = $("hive"); hive.innerHTML = "";
    // centre plus six around it (flat-top hexagons)
    const pos = [[84, 97], [84, 23], [148, 60], [148, 134], [84, 171], [20, 134], [20, 60]];
    [center, ...outer].forEach((ch, i) => {
      const b = document.createElement("button");
      b.className = "c-hex" + (i === 0 ? " center" : "");
      b.style.left = pos[i][0] + "px"; b.style.top = pos[i][1] + "px";
      b.textContent = ch; b.setAttribute("aria-label", ch + (i === 0 ? " (center letter)" : ""));
      b.addEventListener("touchstart", (e) => { e.preventDefault(); add(ch); }, { passive: false });
      b.addEventListener("click", () => add(ch));
      hive.append(b);
    });
  }

  function render() {
    const s = score(), ri = rankIndex(s);
    $("rank").textContent = RANKS[ri][0];
    $("score").textContent = s;
    $("track").innerHTML = `<div class="fill" style="width:${(ri / (RANKS.length - 1)) * 100}%"></div>` + RANKS.map((_, k) => `<i class="${k <= ri ? "on" : ""}"></i>`).join("");
    const list = [...state.found].sort();
    $("found-sum").textContent = list.length ? `${list.length} word${list.length === 1 ? "" : "s"}: ${[...state.found].reverse().join(", ")}` : "You have found 0 words";
    $("found-list").innerHTML = "";
    list.forEach((w) => { const li = document.createElement("li"); li.textContent = w; if (isPangram(w)) li.className = "pg"; $("found-list").append(li); });
    const inp = $("input"); inp.innerHTML = "";
    [...typed].forEach((ch) => { const sp = document.createElement("span"); sp.textContent = ch; if (ch === center) sp.className = "center"; else if (!outer.includes(ch)) sp.className = "bad"; inp.append(sp); });
    const caret = document.createElement("span"); caret.className = "caret"; inp.append(caret);
  }

  function add(ch) { if (typed.length < 19) { typed += ch; render(); } }

  function submit() {
    const w = typed;
    if (!w) return;
    const fail = (msg) => { ZG.toast(msg); ZG.shake($("input")); setTimeout(() => { if (typed === w) { typed = ""; render(); } }, 500); };
    if (w.length < 4) return fail("Too short");
    if ([...w].some((c) => c !== center && !outer.includes(c))) return fail("Bad letters");
    if (!w.includes(center)) return fail("Missing center letter");
    if (state.found.includes(w)) return fail("Already found");
    if (!answers.has(w)) return fail("Not in word list");
    const before = rankIndex(score());
    state.found.push(w); typed = "";
    const p = points(w), after = rankIndex(score());
    ZG.toast(isPangram(w) ? `All seven letters! +${p}` : `${p === 1 ? "Good!" : p < 7 ? "Nice!" : "Awesome!"} +${p}`);
    if (after > before) setTimeout(() => ZG.toast(`New rank: ${RANKS[after][0]}`), 1400);
    if (after >= 7 && !state.top) { state.top = true; ZG.stats.record("comb", n, true); }
    if (state.found.length === answers.size) setTimeout(() => ZG.toast("You found every word!", 3000), 2800);
    save(); render();
  }

  function shuffleOuter() { for (let i = outer.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [outer[i], outer[j]] = [outer[j], outer[i]]; } drawHive(); }

  function showStats() {
    const s = score(), ri = rankIndex(s);
    $("ranks").innerHTML = RANKS.map(([name, pct], k) => `<tr class="${k === ri ? "me" : ""}"><td>${name}</td><td>${Math.round((max * pct) / 100)}</td></tr>`).join("");
    const y = n - 2;
    if (y >= 0) {
      const d = D.days[y % D.days.length];
      $("yday-letters").textContent = `Center ${d[0].toUpperCase()}, with ${d[1].toUpperCase().split("").join(" ")}`;
      $("yday").innerHTML = d[2].split(" ").map((w) => `<li${new Set(w).size === 7 ? ' style="font-weight:800"' : ""}>${w}</li>`).join("");
    } else { $("yday-letters").textContent = "Today is the first Comb."; $("yday").innerHTML = ""; }
    ZG.open("dlg-stats");
  }

  ZG.setup({ name: "Comb", helpKey: "zg-comb-help", stats: showStats });
  $("del").onclick = () => { typed = typed.slice(0, -1); render(); };
  $("enter").onclick = submit;
  $("shuffle").onclick = shuffleOuter;
  $("share").onclick = () => ZG.share(`Comb #${n}\nRank: ${RANKS[rankIndex(score())][0]} · ${score()} points · ${state.found.length} words\n${location.origin}/games/comb/`);
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || ZG.modalOpen()) return;
    if (e.key === "Enter") { e.preventDefault(); submit(); }
    else if (e.key === "Backspace") { typed = typed.slice(0, -1); render(); }
    else if (e.key === " ") { e.preventDefault(); shuffleOuter(); }
    else if (/^[a-z]$/i.test(e.key)) add(e.key.toLowerCase());
  });
  load();
  ZG.onNewDay(D.launch, () => n - 1, load);
  setInterval(() => ($("countdown").textContent = ZG.countdown()), 1000);
  window.__comb = { get answers() { return [...answers]; }, get center() { return center; } };
})();
