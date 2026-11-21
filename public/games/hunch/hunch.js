(() => {
  "use strict";
  const D = ZG.hunch, $ = (id) => document.getElementById(id);
  const VALID = new Set([...D.days, ...D.valid.split(" ")]);
  const KEY = "zg-hunch";
  let n, answer, state, typed = "", busy = false;

  // Colors for one guess, handling repeated letters correctly.
  function score(guess, ans) {
    const res = Array(5).fill("x"), left = {};
    for (let i = 0; i < 5; i++) { if (guess[i] === ans[i]) res[i] = "g"; else left[ans[i]] = (left[ans[i]] || 0) + 1; }
    for (let i = 0; i < 5; i++) if (res[i] !== "g" && left[guess[i]] > 0) { res[i] = "y"; left[guess[i]]--; }
    return res.join("");
  }

  function load() {
    n = ZG.dayIndex(D.launch) + 1;
    answer = D.days[(n - 1) % D.days.length];
    const saved = ZG.store.get(KEY, null);
    state = saved && saved.n === n ? saved : { n, guesses: [], done: false, won: false };
    typed = "";
    document.querySelector(".zg-title span").textContent = ZG.puzzleTitle(n);
    render();
  }
  const save = () => ZG.store.set(KEY, state);

  function render(flipRow = -1) {
    const board = $("board");
    board.innerHTML = "";
    for (let r = 0; r < 6; r++) {
      const row = document.createElement("div"); row.className = "h-row";
      const g = state.guesses[r], cur = r === state.guesses.length && !state.done;
      const colors = g ? score(g, answer) : "";
      for (let c = 0; c < 5; c++) {
        const t = document.createElement("div"); t.className = "h-tile";
        const ch = g ? g[c] : cur ? typed[c] || "" : "";
        t.textContent = ch;
        if (g) { t.classList.add(colors[c]); if (r === flipRow) { t.classList.add("flip"); t.style.animationDelay = c * 0.12 + "s"; } }
        else if (ch) t.classList.add("filled");
        row.append(t);
      }
      if (cur) row.id = "cur";
      board.append(row);
    }
    // keyboard colors: best known state per letter
    const best = {};
    const rank = { x: 1, y: 2, g: 3 };
    state.guesses.forEach((g) => { const s = score(g, answer); [...g].forEach((ch, i) => { if (!best[ch] || rank[s[i]] > rank[best[ch]]) best[ch] = s[i]; }); });
    document.querySelectorAll(".zg-key").forEach((k) => { k.classList.remove("g", "y", "x"); if (best[k.dataset.key]) k.classList.add(best[k.dataset.key]); });
  }

  async function onKey(k) {
    if (state.done || busy) return;
    if (k === "back") { typed = typed.slice(0, -1); return render(); }
    if (k !== "enter") { if (typed.length < 5) { typed += k; render(); } return; }
    if (typed.length < 5) { ZG.shake($("cur")); return ZG.toast("Not enough letters"); }
    const guess = typed;
    if (!VALID.has(guess)) {
      busy = true;
      const t = setTimeout(() => ZG.toast("Checking dictionary…", 4000), 250);
      const ok = await ZG.inDictionary(guess);
      clearTimeout(t); busy = false;
      if (typed !== guess) return;
      if (!ok) { ZG.shake($("cur")); return ZG.toast("Not in word list"); }
      document.getElementById("zg-toast").classList.remove("show");
      VALID.add(guess);
    }
    state.guesses.push(guess); typed = "";
    const won = guess === answer;
    if (won || state.guesses.length === 6) {
      state.done = true; state.won = won;
      ZG.stats.record("hunch", n, won, won ? state.guesses.length : "x");
    }
    save(); render(state.guesses.length - 1);
    if (state.done) {
      setTimeout(() => {
        if (won) { document.querySelectorAll(".h-row")[state.guesses.length - 1].classList.add("win"); ZG.toast(["Genius!", "Magnificent!", "Impressive!", "Splendid!", "Great!", "Phew!"][state.guesses.length - 1]); }
        else ZG.toast(answer.toUpperCase(), 4000);
      }, 700);
      setTimeout(showStats, 2200);
    }
  }

  function shareText() {
    const grid = state.guesses.map((g) => [...score(g, answer)].map((c) => ({ g: "🟩", y: "🟨", x: "⬛" })[c]).join("")).join("\n");
    return `Hunch #${n} ${state.won ? state.guesses.length : "X"}/6\n\n${grid}\n\n${location.origin}/games/hunch/`;
  }

  function showStats() {
    const s = ZG.stats.load("hunch", n);
    const res = $("result");
    if (state.done) {
      res.innerHTML = `<h2>${state.won ? "You got it!" : "Out of guesses"}</h2><p>The word was <b>${answer.toUpperCase()}</b>.</p><div class="zg-btns"><button class="zg-btn primary" id="share">Share result</button></div>`;
      $("share").onclick = () => ZG.share(shareText());
    } else res.innerHTML = "";
    $("stats").innerHTML = ZG.statsHTML(s);
    const max = Math.max(1, ...[1, 2, 3, 4, 5, 6].map((i) => s.dist[i] || 0));
    $("dist").innerHTML = [1, 2, 3, 4, 5, 6].map((i) => `<div><span>${i}</span><i class="${state.won && state.guesses.length === i ? "me" : ""}" style="width:${Math.max(8, ((s.dist[i] || 0) / max) * 100)}%">${s.dist[i] || 0}</i></div>`).join("");
    ZG.open("dlg-stats");
  }

  ZG.setup({ name: "Hunch", sub: "", helpKey: "zg-hunch-help", stats: showStats });
  ZG.keyboard($("keyboard"), onKey);
  load();
  ZG.onNewDay(D.launch, () => n - 1, load);
  setInterval(() => ($("countdown").textContent = ZG.countdown()), 1000);
  window.__hunch = { get answer() { return answer; }, score };
})();
