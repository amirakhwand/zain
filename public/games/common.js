// Shared helpers for the Zainle games: header, theme, daily puzzle number,
// storage, toasts, dialogs, stats, sharing, keyboard and visit counting.
(() => {
  "use strict";
  const ZG = (window.ZG = window.ZG || {});
  const $ = (s, el = document) => el.querySelector(s);

  // Theme (shared with Zainle via the same storage key)
  try { const t = localStorage.getItem("zainle-theme"); if (t) document.documentElement.dataset.theme = JSON.parse(t); } catch {}

  ZG.store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  ZG.localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // Puzzle index for today in the player's own time zone (0 = launch day).
  ZG.dayIndex = (launch, d = new Date()) => {
    const [y, m, dd] = launch.split("-").map(Number);
    return Math.max(0, Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(y, m - 1, dd)) / 86400000));
  };

  let toastTimer;
  ZG.toast = (msg, ms = 1700) => {
    const t = $("#zg-toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), ms);
  };
  ZG.shake = (el) => { if (!el) return; el.classList.remove("zg-shake"); void el.offsetWidth; el.classList.add("zg-shake"); };
  ZG.open = (id) => { const d = document.getElementById(id); if (d && !d.open) d.showModal(); };
  ZG.close = (id) => { const d = document.getElementById(id); if (d && d.open) d.close(); };
  ZG.modalOpen = () => !!document.querySelector("dialog[open]");

  const ICONS = {
    help: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 17a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm1.6-6.3c-.7.5-.9.8-.9 1.6v.4h-2v-.5c0-1.4.5-2.1 1.5-2.8.8-.6 1.2-.9 1.2-1.6 0-.8-.6-1.3-1.5-1.3-.9 0-1.5.5-1.6 1.4H8.3C8.4 7.6 9.9 6.3 12 6.3c2.1 0 3.6 1.2 3.6 3 0 1.4-.8 2.1-2 3.4z"/></svg>',
    stats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 20V10h3v10H4zm6.5 0V4h3v16h-3zM17 20v-7h3v7h-3z"/></svg>',
    moon: '<svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-4.4 2.26 5.4 5.4 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>',
    sun: '<svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM2 13h2a1 1 0 0 0 0-2H2a1 1 0 0 0 0 2zm18 0h2a1 1 0 0 0 0-2h-2a1 1 0 0 0 0 2zM11 2v2a1 1 0 0 0 2 0V2a1 1 0 0 0-2 0zm0 18v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-2 0zM5.99 4.58a1 1 0 0 0-1.41 1.41l1.06 1.06a1 1 0 0 0 1.41-1.41L5.99 4.58zm12.37 12.37a1 1 0 0 0-1.41 1.41l1.06 1.06a1 1 0 0 0 1.41-1.41l-1.06-1.06zm1.06-10.96a1 1 0 0 0-1.41-1.41l-1.06 1.06a1 1 0 0 0 1.41 1.41l1.06-1.06zM7.05 18.36a1 1 0 0 0-1.41-1.41l-1.06 1.06a1 1 0 0 0 1.41 1.41l1.06-1.06z"/></svg>',
  };

  // Builds the header, toast, and wires dialogs. opts: {name, sub, help, stats}
  ZG.setup = (opts) => {
    const bar = document.createElement("header");
    bar.className = "zg-bar";
    bar.innerHTML = `
      <a class="zg-back" href="/" aria-label="All Zainle games"><span aria-hidden="true">‹</span><span class="zg-mark">Z</span><span class="zg-word">Games</span></a>
      <div class="zg-title"><b></b><span></span></div>
      <div class="zg-tools">
        <button class="zg-icon" id="zg-btn-help" aria-label="How to play">${ICONS.help}</button>
        <button class="zg-icon" id="zg-btn-stats" aria-label="Statistics">${ICONS.stats}</button>
        <button class="zg-icon zg-theme" id="zg-btn-theme" aria-label="Switch light or dark mode">${ICONS.moon}${ICONS.sun}</button>
      </div>`;
    bar.querySelector(".zg-title b").textContent = opts.name;
    bar.querySelector(".zg-title span").textContent = opts.sub || "";
    document.body.prepend(bar);
    const toast = document.createElement("div");
    toast.className = "zg-toast"; toast.id = "zg-toast"; toast.setAttribute("role", "status");
    document.body.append(toast);

    document.querySelectorAll("dialog").forEach((d) => {
      d.classList.add("zg-modal");
      if (!d.querySelector(".zg-close")) { const b = document.createElement("button"); b.className = "zg-close"; b.setAttribute("aria-label", "Close"); b.textContent = "×"; d.prepend(b); }
      d.querySelector(".zg-close").addEventListener("click", () => d.close());
      d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    });
    $("#zg-btn-help").onclick = () => ZG.open("dlg-help");
    $("#zg-btn-stats").onclick = () => (opts.stats ? opts.stats() : ZG.open("dlg-stats"));
    const dark = matchMedia("(prefers-color-scheme: dark)");
    const isDark = () => (document.documentElement.dataset.theme || (dark.matches ? "dark" : "light")) === "dark";
    $("#zg-btn-theme").onclick = () => { const n = isDark() ? "light" : "dark"; document.documentElement.dataset.theme = n; ZG.store.set("zainle-theme", n); };
    if (opts.helpKey && !ZG.store.get(opts.helpKey, false)) { ZG.open("dlg-help"); ZG.store.set(opts.helpKey, true); }
    ZG.track("visit");
  };

  ZG.puzzleTitle = (n) => `Puzzle #${n}`;

  // Seconds until local midnight, as hh:mm:ss
  ZG.countdown = () => {
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const s = Math.max(0, Math.ceil((next - now) / 1000)), p = (x) => String(x).padStart(2, "0");
    return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
  };
  // Reload the page's puzzle when the date changes (incl. after a paused tab).
  ZG.onNewDay = (launch, current, cb) => {
    const check = () => { if (ZG.dayIndex(launch) !== current()) cb(); };
    setInterval(check, 1000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
    window.addEventListener("focus", check);
  };

  // Per-game stats: {played, wins, streak, max, last, lastWin}
  ZG.stats = {
    load(game, n) {
      const s = ZG.store.get("zg-stats-" + game, { played: 0, wins: 0, streak: 0, max: 0, last: null, lastWin: null, dist: {} });
      if (s.lastWin !== null && n !== undefined && s.lastWin < n - 1) s.streak = 0;
      return s;
    },
    record(game, n, won, bucket) {
      const s = ZG.stats.load(game, n);
      if (s.last === n) return s;
      s.played++; s.last = n;
      if (won) { s.wins++; s.streak = s.lastWin === n - 1 ? s.streak + 1 : 1; s.max = Math.max(s.max, s.streak); s.lastWin = n; }
      else s.streak = 0;
      if (bucket !== undefined) s.dist[bucket] = (s.dist[bucket] || 0) + 1;
      ZG.store.set("zg-stats-" + game, s);
      return s;
    },
  };
  ZG.statsHTML = (s) => `<div class="zg-stats"><div><b>${s.played}</b><span>Played</span></div><div><b>${s.played ? Math.round((s.wins / s.played) * 100) : 0}</b><span>Win %</span></div><div><b>${s.streak}</b><span>Streak</span></div><div><b>${s.max}</b><span>Max streak</span></div></div>`;

  ZG.share = async (text) => {
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); ZG.toast("Copied results to clipboard"); }
    } catch {}
  };

  // Anonymous visit counting (same endpoint as Zainle; off on localhost)
  ZG.track = (kind) => {
    if (!location.protocol.startsWith("http") || /^(localhost|127\.|\[::1\])/.test(location.hostname)) return;
    let vid;
    try { vid = localStorage.getItem("zainle-vid"); if (!vid) { vid = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); localStorage.setItem("zainle-vid", vid); } } catch { vid = "anon-" + Math.random().toString(36).slice(2, 12); }
    const body = JSON.stringify({ vid, day: ZG.localDate(), kind });
    try { if (!(navigator.sendBeacon && navigator.sendBeacon("/api/event", body))) fetch("/api/event", { method: "POST", body, keepalive: true }).catch(() => {}); } catch {}
  };

  // On-screen QWERTY keyboard. onKey(k) gets a letter, "enter" or "back".
  ZG.keyboard = (el, onKey, opts = {}) => {
    const rows = opts.rows || ["qwertyuiop", "asdfghjkl", "↵zxcvbnm⌫"];
    el.classList.add("zg-keyboard");
    rows.forEach((r) => {
      const row = document.createElement("div"); row.className = "zg-kb-row";
      for (const k of r) {
        const b = document.createElement("button");
        b.className = "zg-key" + (k === "↵" || k === "⌫" ? " wide" : "");
        b.dataset.key = k === "↵" ? "enter" : k === "⌫" ? "back" : k;
        b.textContent = k === "↵" ? (opts.enterLabel || "Enter") : k === "⌫" ? "⌫" : k;
        b.setAttribute("aria-label", k === "↵" ? "Enter" : k === "⌫" ? "Backspace" : k);
        b.addEventListener("click", (e) => { e.currentTarget.blur(); onKey(b.dataset.key); });
        row.append(b);
      }
      el.append(row);
    });
    // Respond on touch immediately and stop iOS double-tap zoom.
    el.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const k = e.target.closest(".zg-key"); if (!k) return;
      k.classList.add("pressed"); setTimeout(() => k.classList.remove("pressed"), 120);
      onKey(k.dataset.key);
    }, { passive: false });
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || ZG.modalOpen()) return;
      if (e.key === "Enter") { e.preventDefault(); onKey("enter"); }
      else if (e.key === "Backspace") onKey("back");
      else if (/^[a-z]$/i.test(e.key)) onKey(e.key.toLowerCase());
    });
  };

  // Merriam-Webster fallback for word games (see /api/word in the Worker).
  const mwCache = ZG.store.get("zainle-mw", {});
  ZG.inDictionary = async (word) => {
    if (word in mwCache) return mwCache[word];
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
      const j = await (await fetch("/api/word?w=" + word, { signal: ctl.signal })).json();
      clearTimeout(t);
      if (j.source === "merriam-webster") { mwCache[word] = !!j.ok; ZG.store.set("zainle-mw", mwCache); }
      return !!j.ok;
    } catch { return false; }
  };
})();
