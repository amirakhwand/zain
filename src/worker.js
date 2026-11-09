// Zainle Worker: serves the game (public/) and keeps simple, anonymous daily
// visit counts in a Durable Object (SQLite). No names, IPs or cookies are
// stored: each browser has a random id kept in its own localStorage.
//
//   POST /api/event  {vid, day, kind}   kind: visit | start | win | giveup
//   GET  /api/stats                      daily totals as JSON (?format=csv)
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
  }

  record(day, vid, kind) {
    this.sql.exec(
      `INSERT INTO events (day, vid, kind, n) VALUES (?, ?, ?, 1)
       ON CONFLICT (day, vid, kind) DO UPDATE SET n = n + 1`, day, vid, kind);
    if (kind === "visit") {
      this.sql.exec(`INSERT INTO visitors (vid, first_day) VALUES (?, ?) ON CONFLICT (vid) DO NOTHING`, vid, day);
    }
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
