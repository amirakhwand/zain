(() => {
  "use strict";
  const D = ZG.threads, $ = (id) => document.getElementById(id);
  const R = D.rows, C = D.cols, KEY = "zg-threads", EXTRA = new Set(D.words.split(" "));
  let n, day, state, path = [], dragging = false, moved = false, size = 50;
  const COLORS = ["var(--g3)", "var(--g2)", "var(--g1)", "var(--g4)"];

  const adj = (a, b) => a !== b && Math.abs(Math.floor(a / C) - Math.floor(b / C)) <= 1 && Math.abs((a % C) - (b % C)) <= 1;
  const wordOf = (p) => p.map((i) => day.grid[i]).join("");

  function load() {
    n = ZG.dayIndex(D.launch) + 1;
    day = D.days[(n - 1) % D.days.length];
    const saved = ZG.store.get(KEY, null);
    state = saved && saved.n === n ? saved : { n, found: [], extras: [], hints: 0, hinted: null, done: false };
    path = [];
    document.querySelector(".zg-title span").textContent = ZG.puzzleTitle(n);
    $("clue").textContent = day.clue;
    $("ntotal").textContent = day.words.length;
    layout(); render();
  }
  const save = () => ZG.store.set(KEY, state);

  function layout() {
    const w = Math.min(document.querySelector(".zg-wrap").clientWidth, 420);
    const h = document.querySelector(".zg-main").clientHeight - 210;
    size = Math.max(36, Math.min(Math.floor(w / C), Math.floor(h / R), 62));
    const g = $("grid");
    g.style.width = size * C + "px"; g.style.height = size * R + "px";
    g.querySelectorAll(".t-cell").forEach((e) => e.remove());
    for (let i = 0; i < R * C; i++) {
      const d = document.createElement("div");
      d.className = "t-cell"; d.dataset.i = i; d.textContent = day.grid[i];
      const pad = size * 0.09;
      Object.assign(d.style, { left: (i % C) * size + pad + "px", top: Math.floor(i / C) * size + pad + "px", width: size - pad * 2 + "px", height: size - pad * 2 + "px", fontSize: size * 0.42 + "px" });
      g.append(d);
    }
  }

  function render(popWord) {
    const foundCells = new Map();
    state.found.forEach((w) => { const e = day.words.find((x) => x[0] === w); e[1].forEach((c) => foundCells.set(c, w)); });
    const hintCells = new Set(state.hinted && !state.found.includes(state.hinted) ? day.words.find((x) => x[0] === state.hinted)[1] : []);
    document.querySelectorAll(".t-cell").forEach((d) => {
      const i = +d.dataset.i;
      d.className = "t-cell" + (foundCells.has(i) ? " found" : path.includes(i) ? " sel" : "") + (hintCells.has(i) ? " hint" : "") + (popWord && foundCells.get(i) === popWord ? " pop" : "");
      d.style.background = foundCells.has(i) ? COLORS[state.found.indexOf(foundCells.get(i)) % COLORS.length] : "";
    });
    const center = (i) => [(i % C) * size + size / 2, Math.floor(i / C) * size + size / 2];
    const line = (p, color, width) => p.length > 1 ? `<polyline points="${p.map((i) => center(i).join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>` : "";
    $("lines").innerHTML = state.found.map((w, k) => line(day.words.find((x) => x[0] === w)[1], COLORS[k % COLORS.length], size * 0.28)).join("") + line(path, "var(--grey)", size * 0.22);
    $("lines").setAttribute("viewBox", `0 0 ${size * C} ${size * R}`);
    // letters sit above the lines
    $("grid").append(...document.querySelectorAll(".t-cell"));
    $("word").textContent = wordOf(path);
    $("nfound").textContent = state.found.length;
    const earned = Math.floor(state.extras.length / 3) - state.hints;
    const canHint = !state.done && (earned > 0) && !(state.hinted && !state.found.includes(state.hinted));
    $("hint").disabled = !canHint;
    $("meter").style.width = state.done ? "0" : ((state.extras.length % 3) / 3) * 100 + "%";
  }

  function submit() {
    const w = wordOf(path), p = path;
    path = [];
    if (w.length < 4) { if (w.length > 1) ZG.toast("Too short"); return render(); }
    const theme = day.words.find((x) => x[0] === w && x[1].join() === p.join());
    if (theme) {
      if (state.found.includes(w)) { ZG.toast("Already found"); return render(); }
      state.found.push(w);
      ZG.toast(["Nice!", "Great find!", "Got it!", "Brilliant!"][state.found.length % 4]);
      if (state.found.length === day.words.length) finish();
      save(); return render(w);
    }
    if (day.words.some((x) => x[0] === w)) { ZG.toast("Right word, different letters"); return render(); }
    if (EXTRA.has(w.toLowerCase())) {
      if (state.extras.includes(w)) ZG.toast("Already found");
      else { state.extras.push(w); ZG.toast(state.extras.length % 3 === 0 ? "Hint unlocked!" : "Real word, not a theme word"); save(); }
    } else { ZG.toast("Not in word list"); ZG.shake($("word")); }
    render();
  }

  function finish() {
    state.done = true;
    ZG.stats.record("threads", n, true, state.hints);
    setTimeout(() => ZG.toast("Board complete!", 2000), 900);
    setTimeout(showStats, 2200);
  }

  function cellAt(e) {
    const r = $("grid").getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const c = Math.floor(x / size), row = Math.floor(y / size);
    if (c < 0 || c >= C || row < 0 || row >= R) return -1;
    // ignore the outer corners so diagonal drags don't clip neighbours
    const dx = x - (c * size + size / 2), dy = y - (row * size + size / 2);
    return Math.hypot(dx, dy) <= size * 0.48 ? row * C + c : -1;
  }
  const isFound = (i) => state.found.some((w) => day.words.find((x) => x[0] === w)[1].includes(i));

  function down(e) {
    if (state.done) return;
    const i = cellAt(e); if (i < 0 || isFound(i)) return;
    e.preventDefault();
    dragging = true; moved = false;
    if (path.length && path[path.length - 1] === i) { dragging = false; return submit(); } // tap last again
    const k = path.indexOf(i);
    if (k >= 0) path = path.slice(0, k + 1);
    else if (path.length && adj(path[path.length - 1], i)) path.push(i);
    else path = [i];
    render();
  }
  function move(e) {
    if (!dragging) return;
    const i = cellAt(e); if (i < 0 || isFound(i)) return;
    const last = path[path.length - 1];
    if (i === last) return;
    if (path.length > 1 && i === path[path.length - 2]) { path.pop(); moved = true; return render(); } // drag back
    if (!path.includes(i) && adj(last, i)) { path.push(i); moved = true; render(); }
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    if (moved && path.length > 1) submit();
  }

  function showStats() {
    const s = ZG.stats.load("threads", n);
    $("result").innerHTML = state.done ? `<h2>Board complete!</h2><p>${day.clue}: ${day.words.map((x) => x[0]).join(", ")}</p><p class="zg-small">Hints used: ${state.hints}</p><div class="zg-btns"><button class="zg-btn primary" id="share">Share result</button></div>` : "";
    if (state.done) $("share").onclick = () => ZG.share(`Threads #${n}\n"${day.clue}"\n${"🧵".repeat(day.words.length)}${state.hints ? " 💡" + state.hints : ""}\n${location.origin}/games/threads/`);
    $("stats").innerHTML = ZG.statsHTML(s);
    ZG.open("dlg-stats");
  }

  ZG.setup({ name: "Threads", helpKey: "zg-threads-help", stats: showStats });
  const g = $("grid");
  g.addEventListener("pointerdown", down);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  $("hint").onclick = () => {
    const left = day.words.filter((x) => !state.found.includes(x[0]));
    if (!left.length) return;
    state.hints++; state.hinted = left[0][0]; save(); render();
    ZG.toast("Outlined one theme word");
  };
  window.addEventListener("resize", () => { if (day) { layout(); render(); } });
  load();
  ZG.onNewDay(D.launch, () => n - 1, load);
  setInterval(() => ($("countdown").textContent = ZG.countdown()), 1000);
  window.__threads = { get day() { return day; }, get size() { return size; } };
})();
