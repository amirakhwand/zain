(() => {
  "use strict";
  const D = ZG.quads, $ = (id) => document.getElementById(id);
  const KEY = "zg-quads", MAX = 4;
  let n, puzzle, state, sel = new Set();

  function load() {
    n = ZG.dayIndex(D.launch) + 1;
    puzzle = D.puzzles[D.order[(n - 1) % D.order.length]];
    const saved = ZG.store.get(KEY, null);
    if (saved && saved.n === n) state = saved;
    else {
      const words = puzzle.flatMap((g) => g[1]);
      for (let i = words.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [words[i], words[j]] = [words[j], words[i]]; }
      state = { n, order: words, solved: [], guesses: [], mistakes: 0, done: false, won: false };
    }
    sel = new Set();
    document.querySelector(".zg-title span").textContent = ZG.puzzleTitle(n);
    render();
  }
  const save = () => ZG.store.set(KEY, state);
  const groupOf = (w) => puzzle.findIndex((g) => g[1].includes(w));

  function render() {
    const grid = $("grid");
    grid.innerHTML = "";
    const shown = state.done ? [0, 1, 2, 3].sort((a, b) => (state.solved.includes(a) ? state.solved.indexOf(a) : 9 + a) - (state.solved.includes(b) ? state.solved.indexOf(b) : 9 + b)) : state.solved;
    shown.forEach((gi) => {
      const g = puzzle[gi], el = document.createElement("div");
      el.className = "q-solved c" + gi;
      el.innerHTML = "<b></b><span></span>";
      el.querySelector("b").textContent = g[0];
      el.querySelector("span").textContent = g[1].join(", ");
      grid.append(el);
    });
    if (!state.done) {
      state.order.filter((w) => !state.solved.includes(groupOf(w))).forEach((w) => {
        const b = document.createElement("button");
        b.className = "q-tile" + (sel.has(w) ? " sel" : "") + (w.length >= 12 ? " l12" : w.length >= 10 ? " l10" : w.length >= 8 ? " l8" : "");
        b.textContent = w; b.setAttribute("aria-pressed", sel.has(w));
        b.onclick = () => { if (sel.has(w)) sel.delete(w); else if (sel.size < 4) sel.add(w); render(); };
        grid.append(b);
      });
    }
    fit();
    $("mistakes").innerHTML = state.done ? "" : "Mistakes remaining: " + Array.from({ length: MAX }, (_, i) => `<span class="q-dot ${i < state.mistakes ? "used" : ""}"></span>`).join("");
    $("submit").disabled = sel.size !== 4;
    $("deselect").disabled = !sel.size;
    $("controls").classList.toggle("hidden", state.done);
    $("after").classList.toggle("hidden", !state.done);
  }

  // Shrink a tile's text until the word fits on one line.
  function fit() {
    document.querySelectorAll(".q-tile").forEach((b) => {
      b.style.fontSize = "";
      let size = parseFloat(getComputedStyle(b).fontSize);
      while (b.scrollWidth > b.clientWidth && size > 7) { size -= 0.5; b.style.fontSize = size + "px"; }
    });
  }
  window.addEventListener("resize", () => fit());

  function submit() {
    if (sel.size !== 4 || state.done) return;
    const guess = [...sel].sort();
    if (state.guesses.some((g) => g.join() === guess.join())) return ZG.toast("Already guessed!");
    state.guesses.push(guess);
    const groups = guess.map(groupOf);
    const counts = {}; groups.forEach((g) => (counts[g] = (counts[g] || 0) + 1));
    const best = Math.max(...Object.values(counts));
    if (best === 4) {
      state.solved.push(groups[0]); sel = new Set();
      if (state.solved.length === 4) finish(true);
    } else {
      state.mistakes++;
      ZG.shake($("grid"));
      ZG.toast(best === 3 ? "One away…" : "Not quite");
      if (state.mistakes >= MAX) finish(false);
    }
    save(); render();
  }

  function finish(won) {
    state.done = true; state.won = won; sel = new Set();
    ZG.stats.record("quads", n, won);
    setTimeout(() => ZG.toast(won ? (state.mistakes === 0 ? "Perfect!" : "Solved!") : "Next time!"), 300);
    setTimeout(showStats, 1600);
  }

  function shareText() {
    const sq = ["🟨", "🟩", "🟦", "🟪"];
    return `Quads #${n}\n${state.guesses.map((g) => g.map((w) => sq[groupOf(w)]).join("")).join("\n")}\n${location.origin}/games/quads/`;
  }

  function showStats() {
    $("result").innerHTML = state.done ? `<h2>${state.won ? (state.mistakes === 0 ? "Perfect!" : "Solved!") : "So close"}</h2><p>${state.won ? `Mistakes: ${state.mistakes}` : "Here are the groups."}</p><div class="zg-btns"><button class="zg-btn primary" id="share">Share result</button></div>` : "";
    if (state.done) $("share").onclick = () => ZG.share(shareText());
    $("stats").innerHTML = ZG.statsHTML(ZG.stats.load("quads", n));
    ZG.open("dlg-stats");
  }

  ZG.setup({ name: "Quads", helpKey: "zg-quads-help", stats: showStats });
  $("submit").onclick = submit;
  $("deselect").onclick = () => { sel = new Set(); render(); };
  $("shuffle").onclick = () => { const o = state.order; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } save(); render(); };
  $("results").onclick = showStats;
  load();
  ZG.onNewDay(D.launch, () => n - 1, load);
  setInterval(() => ($("countdown").textContent = ZG.countdown()), 1000);
  window.__quads = { get puzzle() { return puzzle; } };
})();
