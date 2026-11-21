(() => {
  "use strict";
  const D = ZG.domino, $ = (id) => document.getElementById(id);
  const PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const TINTS = ["#f6d5d5", "#d7e9f7", "#dff2dc", "#fbe8c8", "#e6dcf7", "#d5f0ee", "#f7dcef", "#ecebd2", "#dfe3ea"];
  const TINTS_DARK = ["#5a3434", "#2f4a63", "#30502f", "#5c4826", "#45375f", "#2c5552", "#5a3550", "#4c4b2e", "#3a3f4a"];
  let n, level = "easy", pz, state, selTray = -1, active = -1, size = 50, minR, minC;
  const cellSet = () => new Set(pz.cells);

  function load() {
    n = ZG.dayIndex(D.launch) + 1;
    pz = D.days[(n - 1) % D.days.length][level];
    const all = ZG.store.get("zg-domino", null);
    const saved = all && all.n === n ? all : { n, easy: null, medium: null, hard: null };
    ZG.store.set("zg-domino", saved);
    state = saved[level] || { placed: [], done: false, gaveUp: false };
    selTray = -1; active = -1;
    document.querySelector(".zg-title span").textContent = ZG.puzzleTitle(n) + " · " + level[0].toUpperCase() + level.slice(1);
    document.querySelectorAll("#levels button").forEach((b) => { b.classList.toggle("on", b.dataset.l === level); b.classList.toggle("solved", !!(saved[b.dataset.l] && saved[b.dataset.l].done && !saved[b.dataset.l].gaveUp)); });
    layout(); render();
  }
  function save() { const all = ZG.store.get("zg-domino", { n }); all.n = n; all[level] = state; ZG.store.set("zg-domino", all); }

  // value at each cell from placed dominoes: placed = [{d: trayIndex, a: cell, b: cell, flip: bool}]
  function values() {
    const v = {};
    state.placed.forEach((p) => { const [x, y] = pz.tray[p.d]; v[p.a] = p.flip ? y : x; v[p.b] = p.flip ? x : y; });
    return v;
  }
  const occupied = () => new Set(state.placed.flatMap((p) => [p.a, p.b]));

  function ruleState(g, v) {
    const vs = g.cells.map((c) => v[c]);
    const known = vs.filter((x) => x !== undefined), full = known.length === vs.length, sum = known.reduce((a, b) => a + b, 0);
    let ok = true;
    if (g.t === "sum") ok = full ? sum === g.v : sum <= g.v;
    else if (g.t === "lt") ok = sum < g.v;
    else if (g.t === "gt") ok = full ? sum > g.v : true;
    else if (g.t === "eq") ok = known.every((x) => x === known[0]);
    else if (g.t === "ne") ok = new Set(known).size === known.length;
    return !ok ? "bad" : full && g.t !== "none" ? "ok" : "";
  }
  const label = (g) => ({ sum: String(g.v), lt: "<" + g.v, gt: ">" + g.v, eq: "=", ne: "≠", none: "" })[g.t];

  function layout() {
    const rs = pz.cells.map((c) => Math.floor(c / 8)), cs = pz.cells.map((c) => c % 8);
    minR = Math.min(...rs); minC = Math.min(...cs);
    const rows = Math.max(...rs) - minR + 1, cols = Math.max(...cs) - minC + 1;
    const w = document.querySelector(".zg-wrap").clientWidth - 16;
    const h = document.querySelector(".zg-main").clientHeight - 300;
    size = Math.max(36, Math.min(Math.floor(w / cols), Math.floor(h / rows), 70));
    const b = $("board"); b.style.width = cols * size + "px"; b.style.height = rows * size + "px";
  }
  const pos = (c) => [(Math.floor(c / 8) - minR) * size, ((c % 8) - minC) * size];
  const dark = () => (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";

  function face(v) { const h = document.createElement("div"); h.className = "d-half"; for (let i = 0; i < 9; i++) { const s = document.createElement("span"); if (PIPS[v].includes(i)) s.className = "d-pip"; h.append(s); } return h; }
  function domEl(x, y, vertical) { const d = document.createElement("div"); d.className = "d-dom" + (vertical ? " v" : ""); d.append(face(x), face(y)); d.setAttribute("aria-label", `domino ${x} and ${y}`); return d; }

  function render() {
    const b = $("board"); b.innerHTML = "";
    const v = values(), regionOf = {}, tints = dark() ? TINTS_DARK : TINTS;
    pz.regions.forEach((g, k) => g.cells.forEach((c) => (regionOf[c] = k)));
    const set = cellSet();
    // Give touching regions different tints (greedy coloring).
    const tintOf = [];
    pz.regions.forEach((g, k) => {
      const near = new Set();
      g.cells.forEach((c) => [c - 8, c + 8, c % 8 ? c - 1 : -1, c % 8 < 7 ? c + 1 : -1].forEach((o) => { if (set.has(o) && regionOf[o] !== k && tintOf[regionOf[o]] !== undefined) near.add(tintOf[regionOf[o]]); }));
      let t = 0; while (near.has(t)) t++; tintOf[k] = t;
    });
    pz.cells.forEach((c) => {
      const [top, left] = pos(c), k = regionOf[c], g = pz.regions[k];
      const el = document.createElement("div"); el.className = "d-cell"; el.dataset.c = c;
      const same = (o) => set.has(o) && regionOf[o] === k;
      const line = "2px dashed " + (dark() ? "#9b98a8" : "#7d7b88"), none = "2px solid transparent";
      // Each region edge is drawn once: top/left always, bottom/right only on the board's outer edge.
      const up = c - 8, dn = c + 8, lf = c % 8 ? c - 1 : -1, rt = c % 8 < 7 ? c + 1 : -1;
      Object.assign(el.style, {
        top: top + "px", left: left + "px", width: size + "px", height: size + "px", borderRadius: "0",
        background: g.t === "none" ? "var(--panel)" : tints[tintOf[k] % tints.length],
        borderTop: same(up) ? none : line, borderLeft: same(lf) ? none : line,
        borderBottom: same(dn) ? none : set.has(dn) ? none : line, borderRight: same(rt) ? none : set.has(rt) ? none : line,
      });
      el.onclick = () => tapCell(c);
      b.append(el);
    });
    pz.regions.forEach((g) => {
      if (g.t === "none") return;
      const c = Math.min(...g.cells), [top, left] = pos(c);
      const s = document.createElement("div"); s.className = "d-badge " + ruleState(g, v); s.textContent = label(g);
      s.style.top = top + 4 + "px"; s.style.left = left + 4 + "px"; b.append(s);
    });
    state.placed.forEach((p, i) => {
      const [x, y] = pz.tray[p.d], first = p.a < p.b ? p.a : p.b, vertical = Math.abs(p.a - p.b) === 8;
      const va = p.flip ? y : x, vb = p.flip ? x : y;
      const el = domEl(p.a < p.b ? va : vb, p.a < p.b ? vb : va, vertical);
      const [top, left] = pos(first), pad = size * 0.07;
      Object.assign(el.style, { top: top + pad + "px", left: left + pad + "px", width: (vertical ? size : size * 2) - pad * 2 + "px", height: (vertical ? size * 2 : size) - pad * 2 + "px" });
      if (i === active) el.classList.add("active");
      el.onclick = (e) => { e.stopPropagation(); if (state.done) return; if (active === i) rotate(i); else { active = i; selTray = -1; render(); } };
      b.append(el);
    });
    const t = $("tray"); t.innerHTML = "";
    const used = new Set(state.placed.map((p) => p.d));
    pz.tray.forEach(([x, y], i) => {
      const el = domEl(x, y, false);
      if (used.has(i)) el.classList.add("used");
      if (i === selTray) el.classList.add("sel");
      el.onclick = () => { if (state.done || used.has(i)) return; selTray = selTray === i ? -1 : i; active = -1; render(); };
      t.append(el);
    });
    $("remove").disabled = active < 0 || state.done;
    $("clear").disabled = !state.placed.length || state.done;
  }

  const DIRS = [1, 8, -1, -8];
  function fits(a, d) { const b = a + d; if (!cellSet().has(b)) return false; if ((d === 1 && a % 8 === 7) || (d === -1 && a % 8 === 0)) return false; return true; }

  function tapCell(c) {
    if (state.done) return;
    const occ = occupied();
    if (occ.has(c)) return;
    if (selTray < 0) { active = -1; render(); return ZG.toast("Pick a domino below first"); }
    const d = DIRS.find((dd) => fits(c, dd) && !occ.has(c + dd));
    if (d === undefined) return ZG.toast("No room for a domino there");
    state.placed.push({ d: selTray, a: c, b: c + d, flip: false });
    active = state.placed.length - 1; selTray = -1;
    save(); render(); check();
  }

  // Rotate around the first half: step through the 8 positions
  // (4 directions x halves either way round), skipping blocked ones.
  function rotate(i) {
    const p = state.placed[i], occ = occupied();
    occ.delete(p.a); occ.delete(p.b);
    const cur = DIRS.indexOf(p.b - p.a) + (p.flip ? 4 : 0);
    for (let k = 1; k <= 8; k++) {
      const s8 = (cur + k) % 8, d = DIRS[s8 % 4];
      if (fits(p.a, d) && !occ.has(p.a + d)) { p.b = p.a + d; p.flip = s8 >= 4; break; }
    }
    save(); render(); check();
  }

  function check() {
    const v = values();
    if (Object.keys(v).length !== pz.cells.length) return;
    const bad = pz.regions.filter((g) => ruleState(g, v) === "bad");
    if (bad.length) return ZG.toast(`Board full, but ${bad.length} rule${bad.length > 1 ? "s aren't" : " isn't"} met`);
    state.done = true; active = -1; save(); render();
    ZG.stats.record("domino-" + level, n, true);
    document.querySelector(`#levels [data-l="${level}"]`).classList.add("solved");
    ZG.toast("Solved!", 2000);
    setTimeout(showStats, 1400);
  }

  function showStats() {
    const s = ZG.stats.load("domino-" + level, n);
    $("result").innerHTML = state.done ? `<h2>${state.gaveUp ? "Here's the solution" : "Solved!"}</h2><p>${level[0].toUpperCase() + level.slice(1)} board · Puzzle #${n}</p>${state.gaveUp ? "" : '<div class="zg-btns"><button class="zg-btn primary" id="share">Share result</button></div>'}` : "";
    if (state.done && !state.gaveUp) $("share").onclick = () => ZG.share(`Domino #${n} · ${level} ✅\n${location.origin}/games/domino/`);
    $("stats").innerHTML = ZG.statsHTML(s);
    $("giveup").classList.toggle("hidden", state.done);
    ZG.open("dlg-stats");
  }

  ZG.setup({ name: "Domino", helpKey: "zg-domino-help", stats: showStats });
  document.querySelectorAll("#levels button").forEach((b) => (b.onclick = () => { level = b.dataset.l; load(); }));
  $("remove").onclick = () => { if (active >= 0) { state.placed.splice(active, 1); active = -1; save(); render(); } };
  $("clear").onclick = () => { state.placed = []; active = -1; selTray = -1; save(); render(); };
  $("giveup").onclick = () => {
    // map the stored solution onto tray indices
    const left = pz.tray.map((d, i) => i), placed = [];
    pz.solution.forEach(([a, b, va, vb]) => {
      const k = left.findIndex((i) => (pz.tray[i][0] === va && pz.tray[i][1] === vb) || (pz.tray[i][0] === vb && pz.tray[i][1] === va));
      const i = left.splice(k, 1)[0];
      placed.push({ d: i, a, b, flip: !(pz.tray[i][0] === va && pz.tray[i][1] === vb) });
    });
    state.placed = placed; state.done = true; state.gaveUp = true; active = -1;
    ZG.stats.record("domino-" + level, n, false);
    save(); ZG.close("dlg-stats"); render();
  };
  window.addEventListener("resize", () => { if (pz) { layout(); render(); } });
  load();
  ZG.onNewDay(D.launch, () => n - 1, load);
  setInterval(() => ($("countdown").textContent = ZG.countdown()), 1000);
  window.__domino = { get pz() { return pz; }, values, ruleState };
})();
