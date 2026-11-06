(() => {
  "use strict";

  // ---------- Data ----------
  const TARGET = window.ZAIN_WORDS.target; // "zain"
  const COMMON = new Set(window.ZAIN_WORDS.common.split(" "));
  const VALID = new Set([...COMMON, ...window.ZAIN_WORDS.extra.split(" "), TARGET]);
  COMMON.add(TARGET);
  const P = window.ZAIN_PUZZLES;
  const PRACTICE = P.unlimited.split(" ");

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const diffCount = (a, b) => { let n = 0; for (let i = 0; i < 4; i++) if (a[i] !== b[i]) n++; return n; };
  const up = (w) => w.toUpperCase();

  function neighbours(word, set) {
    const out = [];
    for (let i = 0; i < 4; i++)
      for (let c = 97; c <= 122; c++) {
        const n = word.slice(0, i) + String.fromCharCode(c) + word.slice(i + 1);
        if (n !== word && set.has(n)) out.push(n);
      }
    return out;
  }
  // Shortest route from `from` to ZAIN, preferring common words.
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

  // Puzzle number follows the player's local date, like Wordle.
  function localDayIndex(d = new Date()) {
    const [y, m, dd] = P.launch.split("-").map(Number);
    const today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.max(0, Math.round((today - Date.UTC(y, m - 1, dd)) / 86400000));
  }
  function puzzleAt(i) {
    const [start, par] = P.days[i % P.days.length];
    return { n: i + 1, start, par };
  }
  const dailyPuzzle = () => puzzleAt(localDayIndex());

  // ---------- State ----------
  let mode = "daily";
  let game;        // { n, start, par, ladder: [start, ...], done, gaveUp }
  let typed = "";  // letters typed into the active row
  let animateLast = false;

  function newDaily() {
    const p = dailyPuzzle();
    const saved = store.get("zainle-daily", null);
    if (saved && saved.n === p.n) return saved;
    return { ...p, ladder: [p.start], done: false, gaveUp: false };
  }
  function newPractice() {
    const start = PRACTICE[Math.floor(Math.random() * PRACTICE.length)];
    return { n: null, start, par: shortestPath(start).length - 1, ladder: [start], done: false, gaveUp: false };
  }
  const save = () => store.set(mode === "daily" ? "zainle-daily" : "zainle-practice", game);
  const current = () => game.ladder[game.ladder.length - 1];
  const steps = () => game.ladder.length - 1;

  // ---------- Rendering ----------
  function makeRow(word, cls, opts = {}) {
    const r = document.createElement("div");
    r.className = "row " + cls;
    for (let i = 0; i < 4; i++) {
      const t = document.createElement("div");
      const ch = word[i] || "";
      t.className = "tile";
      t.textContent = ch;
      if (opts.typing && ch) t.classList.add("filled");
      if (opts.scored) {
        t.classList.add(ch === TARGET[i] ? "g" : "done");
        if (opts.reveal) { t.classList.add("reveal"); t.style.animationDelay = `${i * 0.12}s`; }
      }
      r.appendChild(t);
    }
    return r;
  }

  function render() {
    const board = $("board");
    board.innerHTML = "";
    game.ladder.forEach((w, i) => {
      const last = i === game.ladder.length - 1;
      if (i === 0) board.appendChild(makeRow(w, "start", { scored: true }));
      else board.appendChild(makeRow(w, "", { scored: true, reveal: last && animateLast }));
    });
    if (game.gaveUp) {
      (shortestPath(current()) || []).slice(1).forEach((w) => board.appendChild(makeRow(w, "answer", { scored: true })));
    } else if (!game.done) {
      const r = makeRow(typed, "input", { typing: true });
      r.id = "input-row";
      board.appendChild(r);
    }
    animateLast = false;

    $("title").textContent = mode === "daily" ? `#${game.n}: ${up(game.start)}` : `Practice: ${up(game.start)}`;
    $("link-mode").textContent = mode === "daily" ? "Practice" : "Daily";
    const wrap = $("board-wrap");
    wrap.scrollTop = wrap.scrollHeight;
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
  const modalOpen = () => !!document.querySelector("dialog[open]");

  // ---------- Input (Wordle-style) ----------
  function typeLetter(ch) {
    if (game.done || typed.length >= 4) return;
    typed += ch;
    render();
  }
  function backspace() {
    if (game.done || !typed) return;
    typed = typed.slice(0, -1);
    render();
  }
  function submit() {
    if (game.done) return;
    if (typed.length < 4) { shake(); return toast("Not enough letters"); }
    const word = typed;
    const d = diffCount(word, current());
    // 1) Is it a real word at all?
    if (!VALID.has(word)) { shake(); return toast("Not in word list"); }
    // 2) It's a real word, but the move breaks the rules.
    if (d === 0) { shake(); return toast(`You're already on ${up(word)}. Change one letter`); }
    if (d > 1) { shake(); return toast(`${up(word)} changes ${d} letters. Only change one`); }
    game.ladder.push(word);
    typed = "";
    animateLast = true;
    if (word === TARGET) finish(false);
    save();
    render();
    if (game.done) {
      setTimeout(() => {
        const r = $("board").lastElementChild;
        if (r) r.classList.add("win");
        toast(steps() <= game.par ? "Par! Perfect 🎉" : `Made it in ${steps()}!`, 2000);
        if (isBirthday()) confetti();
      }, 650);
      setTimeout(openStats, 2200);
    }
  }

  function giveUp() {
    if (game.done) return;
    if (!confirm("Show the answer? This ends the game as a loss.")) return;
    finish(true);
    save();
    render();
    $("dlg-stats").close();
    setTimeout(openStats, 600);
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
    if (s.lastSolved !== null && s.lastSolved < dailyPuzzle().n - 1) s.streak = 0;
    return s;
  }

  function shareText() {
    const head = mode === "daily" ? `Zainle #${game.n}` : "Zainle Practice";
    const score = game.gaveUp ? "X" : `${steps()}/${game.par}`;
    const star = !game.gaveUp && steps() <= game.par ? " ⭐" : "";
    const grid = game.ladder.map((w) => [...w].map((c, i) => (c === TARGET[i] ? "🟩" : "⬛")).join(""));
    return [`${head} ${score}${star}`, `${up(game.start)} → ZAIN`, "", ...grid, "", location.origin + "/"].join("\n");
  }
  async function share() {
    const text = shareText();
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast("Copied results to clipboard"); }
    } catch { /* cancelled */ }
  }

  function openStats() {
    const s = loadStats();
    $("st-played").textContent = s.played;
    $("st-par").textContent = s.dist[0] || 0;
    $("st-streak").textContent = s.streak;
    $("st-max").textContent = s.maxStreak;

    const dist = $("dist");
    dist.innerHTML = "";
    const max = Math.max(1, ...Object.values(s.dist));
    const mine = mode === "daily" && game.done && !game.gaveUp ? Math.min(steps() - game.par, 5) : -1;
    ["Par", "+1", "+2", "+3", "+4", "+5"].forEach((label, i) => {
      const n = s.dist[i] || 0;
      const r = document.createElement("div");
      r.className = "bar-row";
      r.innerHTML = `<span>${label}</span><div class="bar-fill${i === mine ? " me" : ""}" style="width:${Math.max(7, (n / max) * 100)}%">${n}</div>`;
      dist.appendChild(r);
    });

    $("result").classList.toggle("hidden", !game.done);
    if (game.done) {
      const over = steps() - game.par;
      $("result-title").textContent = game.gaveUp ? "Here's the way" : over <= 0 ? "Perfect!" : "You reached ZAIN!";
      $("result-sub").textContent = game.gaveUp ? "Better luck next time." : `${steps()} steps · par ${game.par}`;
      const best = shortestPath(game.start);
      $("result-path").innerHTML =
        game.ladder.map(up).join(" → ") +
        (game.gaveUp || over > 0 ? `<div class="opt">Shortest: ${best.map(up).join(" → ")}</div>` : "");
      $("btn-new").classList.toggle("hidden", mode !== "practice");
      $("zain-gif").classList.toggle("hidden", game.gaveUp);
    }
    $("countdown-wrap").classList.toggle("hidden", mode !== "daily");
    $("giveup-wrap").classList.toggle("hidden", game.done);
    $("dlg-stats").showModal();
  }

  function openYesterday() {
    const i = localDayIndex() - 1;
    if (i < 0) {
      $("y-title").textContent = "Yesterday's answer";
      $("y-path").innerHTML = `<span class="small">Today is the very first Zainle!</span>`;
    } else {
      const p = puzzleAt(i);
      $("y-title").textContent = `#${p.n}: ${up(p.start)}`;
      $("y-path").innerHTML = shortestPath(p.start).map(up).join(" → ") + `<div class="opt">Par ${p.par}</div>`;
    }
    $("dlg-yesterday").showModal();
  }

  const nextMidnight = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  // Switch to the new daily word the moment the date changes (12:00 AM local).
  function checkNewDay() {
    if (mode !== "daily" || game.n === dailyPuzzle().n) return;
    game = newDaily();
    typed = "";
    const stats = $("dlg-stats");
    if (stats.open) stats.close();
    render();
    toast("A new word is here!", 2200);
  }

  // ---------- Birthday ----------
  // Shown only on this date (player's local calendar); it disappears on its own at midnight.
  const BIRTHDAY = "2026-11-06";
  const localDate = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const isBirthday = () => localDate() === BIRTHDAY;
  function updateBirthday() {
    $("bday").classList.toggle("hidden", !isBirthday());
  }

  let confettiRunning = false;
  function confetti(count = 180) {
    if (confettiRunning || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = $("confetti");
    const ctx = cv.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ["#e2558b", "#f2a93b", "#3f9f62", "#4a8fe0", "#9b5de5", "#ffd23f"];
    const parts = Array.from({ length: count }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.3,
      y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 4,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    const start = performance.now();
    confettiRunning = true;
    (function frame(t) {
      const elapsed = t - start;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.35; p.vx *= 0.99; p.vy *= 0.99;
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - elapsed / 4000);
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        ctx.restore();
      }
      if (elapsed < 4000) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, innerWidth, innerHeight); confettiRunning = false; }
    })(start);
  }

  function tickCountdown() {
    const now = new Date();
    const s = Math.max(0, Math.ceil((nextMidnight(now) - now) / 1000));
    const pad = (x) => String(x).padStart(2, "0");
    $("countdown").textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    checkNewDay();
    updateBirthday();
  }

  // A timer aimed exactly at midnight (re-armed each day), so the switch
  // doesn't wait for the next once-a-second tick.
  function armMidnightTimer() {
    const ms = nextMidnight() - new Date() + 50;
    setTimeout(() => { tickCountdown(); armMidnightTimer(); }, Math.min(ms, 2147483647));
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
        if (k === "⌫") b.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"/></svg>`;
        else b.textContent = k === "↵" ? "Enter" : k;
        b.setAttribute("aria-label", k === "↵" ? "Enter" : k === "⌫" ? "Backspace" : k);
        b.dataset.key = k;
        // Mouse / desktop only. Touch is handled on the keyboard container below.
        b.addEventListener("click", (e) => { e.currentTarget.blur(); pressKey(k); });
        rowEl.appendChild(b);
      }
      kb.appendChild(rowEl);
    });

    // Touch: act the instant a finger lands and cancel the browser's default
    // for every touch on the keyboard. With touchstart cancelled, iOS can't
    // treat fast repeated taps (e.g. on Backspace) as a double-tap zoom.
    kb.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const key = e.target.closest(".key");
      if (!key) return;
      key.classList.add("pressed");
      setTimeout(() => key.classList.remove("pressed"), 120);
      pressKey(key.dataset.key);
    }, { passive: false });
    kb.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
    kb.addEventListener("touchend", (e) => e.preventDefault(), { passive: false });
  }
  function pressKey(k) {
    if (k === "↵") submit();
    else if (k === "⌫") backspace();
    else typeLetter(k);
  }

  function setMode(m) {
    mode = m;
    if (m === "daily") game = newDaily();
    else {
      const saved = store.get("zainle-practice", null);
      game = saved && !saved.done ? saved : newPractice();
    }
    typed = "";
    render();
  }

  const on = (id, fn) => $(id).addEventListener("click", (e) => { e.preventDefault(); fn(); });

  // Page-wide guard: a second tap within 350ms is a double-tap; cancel it so
  // iOS Safari can't zoom (taps on buttons/links still fire their clicks).
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 350 && !e.target.closest("a, button, dialog")) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
  // Block pinch/double-tap "gesture" zoom events on older iOS.
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("dblclick", (e) => e.preventDefault());
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || modalOpen()) return;
    if (e.key === "Enter") { e.preventDefault(); submit(); }
    else if (e.key === "Backspace") backspace();
    else if (/^[a-z]$/i.test(e.key)) typeLetter(e.key.toLowerCase());
  });
  document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));
  on("link-help", () => $("dlg-help").showModal());
  on("link-about", () => $("dlg-about").showModal());
  on("link-stats", openStats);
  on("link-yesterday", openYesterday);
  on("link-mode", () => setMode(mode === "daily" ? "practice" : "daily"));
  on("link-giveup", giveUp);
  on("btn-share", share);
  on("btn-new", () => { game = newPractice(); save(); typed = ""; $("dlg-stats").close(); render(); });

  // ---------- Light / dark mode ----------
  const darkQuery = matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => (document.documentElement.dataset.theme || (darkQuery.matches ? "dark" : "light")) === "dark";
  const syncThemeColor = () => document.querySelector('meta[name="theme-color"]').setAttribute("content", isDark() ? "#1e1d24" : "#ffffff");
  on("btn-theme", () => {
    const next = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set("zainle-theme", next);
    syncThemeColor();
  });
  darkQuery.addEventListener("change", syncThemeColor);
  syncThemeColor();

  $("bday").addEventListener("click", () => confetti());
  buildKeyboard();
  setMode("daily");
  setInterval(tickCountdown, 1000);
  tickCountdown();
  armMidnightTimer();
  // Phones pause background tabs, so re-check whenever the game comes back.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tickCountdown(); });
  window.addEventListener("focus", tickCountdown);
  window.addEventListener("pageshow", tickCountdown);
  // Fetch the win GIF in the background so it's ready the moment someone wins.
  setTimeout(() => { new Image().src = $("zain-gif").getAttribute("src"); }, 2500);
  updateBirthday();
  if (isBirthday()) setTimeout(() => confetti(220), 400);
  if (!store.get("zainle-seen-help", false)) { $("dlg-help").showModal(); store.set("zainle-seen-help", true); }

  window.__zainle = { shortestPath, dailyPuzzle, get game() { return game; } };
})();
