(() => {
  "use strict";

  // ---------- Data ----------
  const TARGET = window.ZAIN_WORDS.target; // "zain"
  const COMMON = new Set(window.ZAIN_WORDS.common.split(" "));
  const VALID = new Set([...COMMON, ...window.ZAIN_WORDS.extra.split(" "), TARGET]);
  COMMON.add(TARGET);
  const P = window.ZAIN_PUZZLES;
  const UNLIMITED = P.unlimited.split(" ");
  const MAX_HINTS = 3;

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const diffCount = (a, b) => { let n = 0; for (let i = 0; i < 4; i++) if (a[i] !== b[i]) n++; return n; };
  const diffIndex = (a, b) => { for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return i; return -1; };

  function neighbours(word, set) {
    const out = [];
    for (let i = 0; i < 4; i++)
      for (let c = 97; c <= 122; c++) {
        const n = word.slice(0, i) + String.fromCharCode(c) + word.slice(i + 1);
        if (n !== word && set.has(n)) out.push(n);
      }
    return out;
  }
  // Shortest path from `from` to ZAIN. Prefers common words.
  function shortestPath(from) {
    for (const set of [COMMON, VALID]) {
      const prev = new Map([[from, null]]);
      const q = [from];
      for (let i = 0; i < q.length; i++) {
        const w = q[i];
        if (w === TARGET) {
          const path = [];
          for (let x = w; x !== null; x = prev.get(x)) path.unshift(x);
          return path;
        }
        for (const n of neighbours(w, set)) if (!prev.has(n)) { prev.set(n, w); q.push(n); }
      }
    }
    return null;
  }

  // Puzzle number is based on the player's local date, like other daily games.
  function localDayIndex(d = new Date()) {
    const [y, m, dd] = P.launch.split("-").map(Number);
    const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.max(0, Math.round((today - Date.UTC(y, m - 1, dd)) / 86400000));
  }
  function dailyPuzzle() {
    const i = localDayIndex();
    const [start, par] = P.days[i % P.days.length];
    return { n: i + 1, start, par };
  }

  // ---------- State ----------
  let mode = "daily";
  let game; // { n, start, par, ladder: [], hints, done, gaveUp }
  let input = [];   // letters being edited
  let cursor = 0;
  let hintWord = null;

  function newDaily() {
    const p = dailyPuzzle();
    const saved = store.get("zainle-daily", null);
    if (saved && saved.n === p.n) return saved;
    return { ...p, ladder: [p.start], hints: 0, done: false, gaveUp: false };
  }
  function newUnlimited() {
    const start = UNLIMITED[Math.floor(Math.random() * UNLIMITED.length)];
    return { n: null, start, par: shortestPath(start).length - 1, ladder: [start], hints: 0, done: false, gaveUp: false };
  }
  function save() {
    if (mode === "daily") store.set("zainle-daily", game);
    else store.set("zainle-unlimited", game);
  }
  const current = () => game.ladder[game.ladder.length - 1];
  const steps = () => game.ladder.length - 1;

  function resetInput() {
    input = current().split("");
    cursor = 0;
    hintWord = null;
  }

  // ---------- Rendering ----------
  function tile(ch, cls = "") {
    const t = document.createElement("div");
    t.className = "tile " + cls;
    t.textContent = ch;
    return t;
  }
  function row(word, cls, prev, num) {
    const r = document.createElement("div");
    r.className = "row " + cls;
    if (num !== undefined) { const s = document.createElement("span"); s.className = "num"; s.textContent = num; r.appendChild(s); }
    const ci = prev ? diffIndex(prev, word) : -1;
    for (let i = 0; i < 4; i++) r.appendChild(tile(word[i], i === ci ? "chg" : ""));
    return r;
  }

  function render() {
    const lad = $("ladder");
    lad.innerHTML = "";
    game.ladder.forEach((w, i) => {
      const isWin = game.done && !game.gaveUp && w === TARGET;
      const cls = isWin ? "win" : i === 0 ? "start past" : "past";
      lad.appendChild(row(w, cls, game.ladder[i - 1], i === 0 ? undefined : i));
    });

    if (game.gaveUp) {
      // Show the optimal route from where the player stopped.
      const path = shortestPath(current()) || [];
      path.slice(1).forEach((w, i, arr) => lad.appendChild(row(w, "past hint" + (w === TARGET ? " win" : ""), i ? arr[i - 1] : current())));
    } else if (!game.done) {
      const r = document.createElement("div");
      r.className = "row input";
      r.id = "input-row";
      const cur = current();
      input.forEach((ch, i) => {
        const t = tile(ch, (ch !== cur[i] ? "chg " : "") + (i === cursor ? "cursor" : ""));
        t.addEventListener("click", () => { cursor = i; render(); });
        r.appendChild(t);
      });
      lad.appendChild(r);
      const g = document.createElement("div");
      g.className = "gap";
      g.textContent = "⋮";
      lad.appendChild(g);
      lad.appendChild(row(TARGET, "target"));
    }

    $("steps").textContent = steps();
    $("par").textContent = game.par;
    $("puzzle-label").textContent = mode === "daily" ? `Puzzle #${game.n}` : "Unlimited";
    $("btn-undo").disabled = game.done || steps() === 0;
    $("btn-hint").disabled = game.done || game.hints >= MAX_HINTS;
    $("btn-hint").textContent = `💡 Hint (${MAX_HINTS - game.hints})`;
    $("btn-giveup").classList.toggle("hidden", game.done);
    $("btn-new").classList.toggle("hidden", !(mode === "unlimited" && game.done));
    $("btn-undo").classList.toggle("hidden", game.done);
    $("btn-hint").classList.toggle("hidden", game.done);

    // Keep the newest row in view.
    const inputRow = $("input-row") || lad.lastElementChild;
    if (inputRow) inputRow.scrollIntoView({ block: "nearest" });
  }

  let toastTimer;
  function toast(msg, ms = 1600) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), ms);
  }
  function shake() {
    const r = $("input-row");
    if (!r) return;
    r.classList.remove("shake");
    void r.offsetWidth;
    r.classList.add("shake");
  }

  // ---------- Input ----------
  function typeLetter(ch) {
    if (game.done) return;
    input[cursor] = ch;
    if (cursor < 3) cursor++;
    render();
  }
  function backspace() {
    if (game.done) return;
    const cur = current();
    if (input[cursor] === cur[cursor] && cursor > 0) cursor--;
    input[cursor] = cur[cursor];
    render();
  }
  function moveCursor(d) {
    cursor = Math.min(3, Math.max(0, cursor + d));
    render();
  }

  function submit() {
    if (game.done) return;
    const word = input.join("");
    const cur = current();
    const d = diffCount(word, cur);
    if (d === 0) { shake(); return toast("Change one letter"); }
    if (d > 1) { shake(); return toast("Only change one letter at a time"); }
    if (!VALID.has(word)) { shake(); return toast("Not in word list"); }
    if (game.ladder.includes(word)) { shake(); return toast("Already used that word"); }
    game.ladder.push(word);
    if (word === TARGET) finish(false);
    resetInput();
    save();
    render();
    if (game.done) setTimeout(() => openStats(), 900);
  }

  function undo() {
    if (game.done || steps() === 0) return;
    game.ladder.pop();
    resetInput();
    save();
    render();
  }

  function hint() {
    if (game.done || game.hints >= MAX_HINTS) return;
    const path = shortestPath(current());
    if (!path) return toast("No route from here. Try undo");
    game.hints++;
    hintWord = path[1];
    input = hintWord.split("");
    cursor = diffIndex(current(), hintWord);
    save();
    render();
    toast(`Try ${hintWord.toUpperCase()}`);
  }

  function giveUp() {
    if (game.done) return;
    if (!confirm("Show the answer? This counts as a loss.")) return;
    finish(true);
    save();
    render();
    setTimeout(() => openStats(), 500);
  }

  // ---------- End of game & stats ----------
  function finish(gaveUp) {
    game.done = true;
    game.gaveUp = gaveUp;
    if (mode !== "daily") return;
    const s = loadStats();
    if (s.lastPlayed === game.n) return;
    s.played++;
    if (!gaveUp) {
      s.solved++;
      s.streak = s.lastSolved === game.n - 1 ? s.streak + 1 : 1;
      s.maxStreak = Math.max(s.maxStreak, s.streak);
      s.lastSolved = game.n;
      const over = Math.min(steps() - game.par, 5);
      s.dist[over] = (s.dist[over] || 0) + 1;
    } else {
      s.streak = 0;
    }
    s.lastPlayed = game.n;
    store.set("zainle-stats", s);
  }
  function loadStats() {
    const s = store.get("zainle-stats", { played: 0, solved: 0, streak: 0, maxStreak: 0, dist: {}, lastPlayed: null, lastSolved: null });
    // Break a streak if yesterday was missed.
    if (s.lastSolved !== null && s.lastSolved < dailyPuzzle().n - 1) s.streak = 0;
    return s;
  }

  function verdict() {
    const over = steps() - game.par;
    if (game.gaveUp) return "Better luck tomorrow!";
    if (over <= 0) return game.hints ? "Par! (with a little help)" : "Perfect, you hit par! ⭐";
    if (over === 1) return "So close: 1 over par.";
    return `${over} over par.`;
  }

  function shareText() {
    const head = mode === "daily" ? `Zainle #${game.n}` : "Zainle Unlimited";
    const score = game.gaveUp ? "X" : `${steps()}/${game.par}`;
    const star = !game.gaveUp && steps() <= game.par ? " ⭐" : "";
    const hints = game.hints ? ` 💡${game.hints}` : "";
    const lines = [`${head} ${score}${star}${hints}`, game.start.toUpperCase()];
    for (let i = 1; i < game.ladder.length; i++) {
      const ci = diffIndex(game.ladder[i - 1], game.ladder[i]);
      const isWin = game.ladder[i] === TARGET;
      lines.push(isWin ? "🟩🟩🟩🟩" : [0, 1, 2, 3].map((j) => (j === ci ? "🟪" : "⬜")).join(""));
    }
    lines.push(location.origin + location.pathname);
    return lines.join("\n");
  }

  async function share() {
    const text = shareText();
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast("Copied to clipboard!"); }
    } catch { /* user cancelled */ }
  }

  function openStats() {
    const s = loadStats();
    $("st-played").textContent = s.played;
    $("st-solved").textContent = s.played ? Math.round((s.solved / s.played) * 100) : 0;
    $("st-par").textContent = s.dist[0] || 0;
    $("st-streak").textContent = s.streak;
    $("st-max").textContent = s.maxStreak;

    const dist = $("dist");
    dist.innerHTML = "";
    const max = Math.max(1, ...Object.values(s.dist));
    const mine = mode === "daily" && game.done && !game.gaveUp ? Math.min(steps() - game.par, 5) : -1;
    ["Par", "+1", "+2", "+3", "+4", "+5+"].forEach((label, i) => {
      const n = s.dist[i] || 0;
      const r = document.createElement("div");
      r.className = "bar-row";
      r.innerHTML = `<span>${label}</span><div class="bar-fill${i === mine ? " me" : ""}" style="width:${Math.max(8, (n / max) * 100)}%">${n}</div>`;
      dist.appendChild(r);
    });

    const res = $("result");
    res.classList.toggle("hidden", !game.done);
    if (game.done) {
      $("result-title").textContent = game.gaveUp ? "Here's the way to ZAIN" : "You reached ZAIN!";
      $("result-sub").textContent = `${game.gaveUp ? "" : steps() + " steps · par " + game.par + " · "}${verdict()}`;
      const best = shortestPath(game.start);
      $("result-path").innerHTML =
        game.ladder.map((w) => w.toUpperCase()).join(" → ") +
        (game.gaveUp || steps() > game.par ? `<div class="opt">Shortest: ${best.map((w) => w.toUpperCase()).join(" → ")}</div>` : "");
      $("btn-share").classList.toggle("hidden", game.gaveUp && mode !== "daily");
    }
    $("countdown-wrap").classList.toggle("hidden", mode !== "daily");
    $("dlg-stats").showModal();
  }

  function tickCountdown() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const s = Math.max(0, Math.floor((next - now) / 1000));
    const pad = (x) => String(x).padStart(2, "0");
    $("countdown").textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    // Roll over to the new puzzle at midnight.
    if (mode === "daily" && dailyPuzzle().n !== game.n) { game = newDaily(); resetInput(); render(); }
  }

  // ---------- Setup ----------
  function buildKeyboard() {
    const kb = $("keyboard");
    ["qwertyuiop", "asdfghjkl", "↵zxcvbnm⌫"].forEach((r) => {
      const rowEl = document.createElement("div");
      rowEl.className = "kb-row";
      for (const k of r) {
        const b = document.createElement("button");
        b.className = "key" + (k === "↵" || k === "⌫" ? " wide" : "");
        b.textContent = k === "↵" ? "Enter" : k;
        b.setAttribute("aria-label", k === "↵" ? "Enter" : k === "⌫" ? "Backspace" : k);
        b.addEventListener("click", () => (k === "↵" ? submit() : k === "⌫" ? backspace() : typeLetter(k)));
        rowEl.appendChild(b);
      }
      kb.appendChild(rowEl);
    });
  }

  function setMode(m) {
    mode = m;
    document.querySelectorAll(".mode").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === m);
      b.setAttribute("aria-selected", b.dataset.mode === m);
    });
    if (m === "daily") game = newDaily();
    else {
      const saved = store.get("zainle-unlimited", null);
      game = saved && !saved.done ? saved : newUnlimited();
    }
    resetInput();
    render();
  }

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector("dialog[open]")) return;
    if (e.key === "Enter") { e.preventDefault(); submit(); }
    else if (e.key === "Backspace") backspace();
    else if (e.key === "ArrowLeft") moveCursor(-1);
    else if (e.key === "ArrowRight") moveCursor(1);
    else if (/^[a-z]$/i.test(e.key)) typeLetter(e.key.toLowerCase());
  });
  document.querySelectorAll(".mode").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));
  $("btn-help").addEventListener("click", () => $("dlg-help").showModal());
  $("btn-stats").addEventListener("click", () => openStats());
  $("btn-undo").addEventListener("click", undo);
  $("btn-hint").addEventListener("click", hint);
  $("btn-giveup").addEventListener("click", giveUp);
  $("btn-new").addEventListener("click", () => { game = newUnlimited(); save(); resetInput(); render(); });
  $("btn-share").addEventListener("click", share);

  buildKeyboard();
  setMode("daily");
  setInterval(tickCountdown, 1000);
  tickCountdown();
  if (!store.get("zainle-seen-help", false)) { $("dlg-help").showModal(); store.set("zainle-seen-help", true); }

  // Small hook for automated tests.
  window.__zainle = { shortestPath, dailyPuzzle, get game() { return game; } };
})();
