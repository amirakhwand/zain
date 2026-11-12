// Zainle Worker: serves the game (public/) and keeps simple, anonymous daily
// visit counts in a Durable Object (SQLite). No names, IPs or cookies are
// stored: each browser has a random id kept in its own localStorage.
//
//   POST /api/event  {vid, day, kind}   kind: visit | start | win | giveup
//   GET  /api/stats                      daily totals as JSON (?format=csv)
//   GET  /api/word?w=xxxx                is it in Merriam-Webster's Collegiate?
//        (needs the MW_API_KEY secret; answers are cached so each word is
//        looked up once)
import { DurableObject } from "cloudflare:workers";

const KINDS = new Set(["visit", "start", "win", "giveup"]);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const VID_RE = /^[a-zA-Z0-9-]{8,64}$/;

export class Stats extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS events (
      day TEXT NOT NULL, vid TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, vid, kind))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS visitors (vid TEXT PRIMARY KEY, first_day TEXT NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS words (word TEXT PRIMARY KEY, ok INTEGER NOT NULL, checked INTEGER NOT NULL)`);
  }

  record(day, vid, kind) {
    this.sql.exec(
      `INSERT INTO events (day, vid, kind, n) VALUES (?, ?, ?, 1)
       ON CONFLICT (day, vid, kind) DO UPDATE SET n = n + 1`, day, vid, kind);
    if (kind === "visit") {
      this.sql.exec(`INSERT INTO visitors (vid, first_day) VALUES (?, ?) ON CONFLICT (vid) DO NOTHING`, vid, day);
    }
  }

  cachedWord(word) {
    const r = this.sql.exec(`SELECT ok, checked FROM words WHERE word = ?`, word).toArray()[0];
    if (!r) return null;
    // Keep "yes" forever; re-check a "no" after 30 days in case the dictionary adds it.
    if (!r.ok && Date.now() - r.checked > 30 * 86400000) return null;
    return !!r.ok;
  }
  saveWord(word, ok) {
    this.sql.exec(`INSERT INTO words (word, ok, checked) VALUES (?, ?, ?)
      ON CONFLICT (word) DO UPDATE SET ok = excluded.ok, checked = excluded.checked`, word, ok ? 1 : 0, Date.now());
  }

  daily() {
    return this.sql.exec(`
      SELECT e.day AS date,
        COUNT(DISTINCT CASE WHEN e.kind = 'visit'  THEN e.vid END) AS visitors,
        COUNT(DISTINCT CASE WHEN e.kind = 'visit' AND v.first_day = e.day THEN e.vid END) AS new_visitors,
        SUM(CASE WHEN e.kind = 'visit' THEN e.n ELSE 0 END) AS page_views,
        COUNT(DISTINCT CASE WHEN e.kind = 'start'  THEN e.vid END) AS players,
        COUNT(DISTINCT CASE WHEN e.kind = 'win'    THEN e.vid END) AS solved,
        COUNT(DISTINCT CASE WHEN e.kind = 'giveup' THEN e.vid END) AS gave_up
      FROM events e LEFT JOIN visitors v ON v.vid = e.vid
      GROUP BY e.day ORDER BY e.day`).toArray();
  }
}

// Merriam-Webster Collegiate Dictionary API (dictionaryapi.com).
// A word counts if an entry lists it as a headword or inflection (its
// "stems"), excluding abbreviations, symbols and capitalized proper nouns.
async function inMerriamWebster(word, key) {
  const res = await fetch(
    `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word)}?key=${encodeURIComponent(key)}`,
    { cf: { cacheTtl: 86400 } });
  if (!res.ok) throw new Error("MW " + res.status);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("MW bad response");
  // No match: MW returns an array of suggestion strings.
  return data.some((e) => {
    if (!e || typeof e !== "object" || !e.meta) return false;
    const fl = (e.fl || "").toLowerCase();
    if (fl.includes("abbreviation") || fl.includes("symbol")) return false;
    const id = String(e.meta.id || "").split(":")[0];
    if (id && id[0] !== id[0].toLowerCase()) return false; // proper noun
    return (e.meta.stems || []).some((s) => s === word);
  });
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "no-store" },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const stats = () => env.STATS.get(env.STATS.idFromName("global"));

    if (url.pathname === "/api/event" && request.method === "POST") {
      let e;
      try { e = JSON.parse(await request.text()); } catch { return json({ error: "bad json" }, 400); }
      const { vid, day, kind } = e || {};
      if (!VID_RE.test(vid || "") || !DAY_RE.test(day || "") || !KINDS.has(kind)) return json({ error: "bad event" }, 400);
      // Accept only dates within a day or so of now (players' local dates vary by time zone).
      const diff = Math.abs(Date.parse(day + "T12:00:00Z") - Date.now());
      if (!(diff < 2 * 86400000)) return json({ error: "bad day" }, 400);
      await stats().record(day, vid, kind);
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/api/word" && request.method === "GET") {
      const w = (url.searchParams.get("w") || "").toLowerCase();
      if (!/^[a-z]{4}$/.test(w)) return json({ word: w, ok: false }, 400);
      const cached = await stats().cachedWord(w);
      if (cached !== null) return json({ word: w, ok: cached, source: "merriam-webster" });
      if (!env.MW_API_KEY) return json({ word: w, ok: false, source: "none" });
      let ok;
      try { ok = await inMerriamWebster(w, env.MW_API_KEY); }
      catch { return json({ word: w, ok: false, source: "error" }, 502); }
      await stats().saveWord(w, ok);
      return json({ word: w, ok, source: "merriam-webster" });
    }

    if (url.pathname === "/api/stats" && request.method === "GET") {
      const rows = await stats().daily();
      if (url.searchParams.get("format") === "csv") {
        const cols = ["date", "visitors", "new_visitors", "page_views", "players", "solved", "gave_up"];
        const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => r[c] ?? 0).join(","))].join("\n") + "\n";
        return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "access-control-allow-origin": "*", "cache-control": "no-store" } });
      }
      return json({ generated: new Date().toISOString(), days: rows });
    }

    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
