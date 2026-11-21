(() => {
  "use strict";
  const D = ZG.mini, $ = (id) => document.getElementById(id);
  const KEY = "zg-mini";
  let n, pz, state, cur = 0, dir = "A", timer;

  function load() {
    n = ZG.dayIndex(D.launch) + 1;
    pz = D.puzzles[D.order[(n - 1) % D.order.length]];
    const saved = ZG.store.get(KEY, null);
    state = saved && saved.n === n ? saved : { n, fill: Array(25).fill(""), revealed: [], wrong: [], secs: 0, done: false, checks: 0 };
    cur = [...pz.grid].findIndex((c) => c !== "#"); dir = "A";
    document.querySelector(".zg-title span").textContent = ZG.puzzleTitle(n);
    buildGrid(); render();
  }
  const save = () => ZG.store.set(KEY, state);
  const entryAt = (cell, d) => pz.entries.find((e) => e.dir === d && e.cells.includes(cell));
  const curEntry = () => entryAt(cur, dir) || entryAt(cur, dir === "A" ? "D" : "A");
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  function buildGrid() {
    const g = $("grid"); g.innerHTML = "";
    const nums = {}; pz.entries.forEach((e) => (nums[e.cells[0]] = e.n));
    for (let i = 0; i < 25; i++) {
      const c = document.createElement("div");
      c.className = "m-cell" + (pz.grid[i] === "#" ? " block" : "");
      c.dataset.i = i; c.setAttribute("role", "gridcell");
      if (nums[i]) { const s = document.createElement("span"); s.className = "num"; s.textContent = nums[i]; c.append(s); }
      const t = document.createElement("span"); t.className = "ch"; c.append(t);
      if (pz.grid[i] !== "#") c.onclick = () => { if (state.done) return; if (i === cur) dir = dir === "A" ? "D" : "A"; cur = i; if (!entryAt(cur, dir)) dir = dir === "A" ? "D" : "A"; render(); };
      g.append(c);
    }
    ["A", "D"].forEach((d) => {
      const ol = $(d === "A" ? "across" : "down"); ol.innerHTML = "";
      pz.entries.filter((e) => e.dir === d).forEach((e) => {
        const li = document.createElement("li"); li.innerHTML = "<b></b><span></span>";
        li.querySelector("b").textContent = e.n; li.querySelector("span").textContent = e.clue;
        li.onclick = () => { if (state.done) return; dir = d; cur = e.cells.find((c) => !state.fill[c]) ?? e.cells[0]; render(); };
        li.dataset.key = d + e.n; ol.append(li);
      });
    });
  }

  function render() {
    const e = curEntry();
    document.querySelectorAll(".m-cell").forEach((c) => {
      const i = +c.dataset.i; if (pz.grid[i] === "#") return;
      c.querySelector(".ch").textContent = state.fill[i];
      c.className = "m-cell" + (!state.done && e && e.cells.includes(i) ? " word" : "") + (!state.done && i === cur ? " cur" : "") + (state.wrong.includes(i) ? " wrong" : "") + (state.revealed.includes(i) ? " revealed" : "") + (state.done ? " done" : "");
    });
    $("clue").innerHTML = e ? `<b>${e.n}${e.dir}</b>` : "";
    if (e) $("clue").append(document.createTextNode(e.clue));
    document.querySelectorAll(".m-lists li").forEach((li) => {
      const en = pz.entries.find((x) => x.dir + x.n === li.dataset.key);
      li.classList.toggle("on", e && en === e);
      li.classList.toggle("full", en.cells.every((c) => state.fill[c]));
    });
    $("timer").textContent = fmt(state.secs);
    $("check").disabled = $("reveal").disabled = state.done;
  }

  function advance() {
    const e = curEntry(); if (!e) return;
    const k = e.cells.indexOf(cur);
    const next = e.cells.slice(k + 1).find((c) => !state.fill[c]);
    if (next !== undefined) cur = next;
    else if (k < e.cells.length - 1) cur = e.cells[k + 1];
    else jump(1);
  }
  function jump(step) {
    const list = [...pz.entries.filter((x) => x.dir === "A"), ...pz.entries.filter((x) => x.dir === "D")];
    let idx = list.indexOf(curEntry());
    for (let t = 0; t < list.length; t++) {
      idx = (idx + step + list.length) % list.length;
      const x = list[idx];
      if (x.cells.some((c) => !state.fill[c]) || t === list.length - 1) { dir = x.dir; cur = x.cells.find((c) => !state.fill[c]) ?? x.cells[0]; return; }
    }
  }

  function onKey(k) {
    if (state.done) return;
    startTimer();
    if (k === "enter") { jump(1); return render(); }
    if (k === "back") {
      if (state.fill[cur]) state.fill[cur] = "";
      else { const e = curEntry(); const i = e.cells.indexOf(cur); if (i > 0) { cur = e.cells[i - 1]; state.fill[cur] = ""; } }
      state.wrong = state.wrong.filter((c) => c !== cur);
      save(); return render();
    }
    if (state.revealed.includes(cur)) { advance(); return render(); }
    state.fill[cur] = k.toUpperCase();
    state.wrong = state.wrong.filter((c) => c !== cur);
    advance(); save(); render(); checkDone();
  }

  function checkDone() {
    const cells = [...pz.grid].map((c, i) => [c, i]).filter(([c]) => c !== "#");
    if (cells.some(([, i]) => !state.fill[i])) return;
    if (cells.every(([c, i]) => state.fill[i] === c)) {
      state.done = true; stopTimer(); save(); render();
      ZG.stats.record("mini", n, true, state.secs);
      ZG.toast(`Solved in ${fmt(state.secs)}!`, 2200);
      setTimeout(showStats, 1600);
    } else ZG.toast("Not quite. Keep trying, or use Check");
  }

  function startTimer() { if (timer || state.done) return; timer = setInterval(() => { if (document.hidden || ZG.modalOpen()) return; state.secs++; $("timer").textContent = fmt(state.secs); if (state.secs % 5 === 0) save(); }, 1000); }
  function stopTimer() { clearInterval(timer); timer = null; }

  function showStats() {
    const s = ZG.stats.load("mini", n);
    $("result").innerHTML = state.done ? `<h2>You solved it!</h2><div class="big">${fmt(state.secs)}</div><p class="zg-small">${state.revealed.length ? "With some help from Reveal" : "No help needed"}</p><div class="zg-btns"><button class="zg-btn primary" id="share">Share result</button></div>` : "";
    if (state.done) $("share").onclick = () => ZG.share(`Mini #${n} solved in ${fmt(state.secs)}${state.revealed.length ? " (with reveals)" : ""}\n${location.origin}/games/mini/`);
    $("stats").innerHTML = ZG.statsHTML(s);
    ZG.open("dlg-stats");
  }

  ZG.setup({ name: "Mini", helpKey: "zg-mini-help", stats: showStats });
  ZG.keyboard($("keyboard"), onKey, { enterLabel: "Next" });
  document.addEventListener("keydown", (e) => {
    if (ZG.modalOpen() || state.done) return;
    const moves = { ArrowLeft: [-1, "A"], ArrowRight: [1, "A"], ArrowUp: [-5, "D"], ArrowDown: [5, "D"] };
    if (moves[e.key]) {
      e.preventDefault();
      const [d, nd] = moves[e.key];
      if (dir !== nd && entryAt(cur, nd)) { dir = nd; return render(); }
      let i = cur + d;
      while (i >= 0 && i < 25 && pz.grid[i] === "#" && (nd === "D" || Math.floor(i / 5) === Math.floor(cur / 5))) i += d;
      if (i >= 0 && i < 25 && pz.grid[i] !== "#" && (nd === "D" || Math.floor(i / 5) === Math.floor(cur / 5))) cur = i;
      render();
    } else if (e.key === "Tab") { e.preventDefault(); jump(e.shiftKey ? -1 : 1); render(); }
  });
  $("prev").onclick = () => { if (!state.done) { jump(-1); render(); } };
  $("next").onclick = () => { if (!state.done) { jump(1); render(); } };
  $("check").onclick = () => { state.wrong = [...pz.grid].map((c, i) => i).filter((i) => pz.grid[i] !== "#" && state.fill[i] && state.fill[i] !== pz.grid[i]); save(); render(); ZG.toast(state.wrong.length ? `${state.wrong.length} square${state.wrong.length > 1 ? "s" : ""} to fix` : "Everything so far is correct"); };
  $("reveal").onclick = () => { const e = curEntry(); startTimer(); e.cells.forEach((c) => { if (state.fill[c] !== pz.grid[c]) { state.fill[c] = pz.grid[c]; state.revealed.push(c); } }); state.wrong = state.wrong.filter((c) => !e.cells.includes(c)); save(); render(); checkDone(); };
  load();
  if (state.done) render();
  ZG.onNewDay(D.launch, () => n - 1, () => { stopTimer(); load(); });
  setInterval(() => ($("countdown").textContent = ZG.countdown()), 1000);
  window.__mini = { get pz() { return pz; } };
})();
