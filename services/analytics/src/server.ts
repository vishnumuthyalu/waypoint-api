import express from "express";
import Redis from "ioredis";
import { Pool } from "pg";

const PORT = Number(process.env.PORT ?? 3000);
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
const db = new Pool({ connectionString: process.env.DATABASE_URL });
const STREAM = "clicks";
const GROUP = "analytics";
const CONSUMER = process.env.HOSTNAME ?? "analytics-local";

type StreamEntry = [id: string, fields: string[]];

async function init() {
  await db.query("CREATE SCHEMA IF NOT EXISTS analytics");
  await db.query(`CREATE TABLE IF NOT EXISTS analytics.click_events (
    id BIGSERIAL PRIMARY KEY,
    stream_id TEXT UNIQUE NOT NULL,
    code TEXT NOT NULL,
    clicked_at TIMESTAMPTZ NOT NULL,
    referrer TEXT,
    user_agent TEXT
  )`);
  await db.query(
    "CREATE INDEX IF NOT EXISTS click_events_code_time ON analytics.click_events (code, clicked_at)"
  );
  try {
    // "0" = also read events published before this group existed
    await redis.xgroup("CREATE", STREAM, GROUP, "0", "MKSTREAM");
  } catch (err) {
    if (!String(err).includes("BUSYGROUP")) throw err; // group already exists
  }
}

async function saveBatch(entries: StreamEntry[]) {
  const values: unknown[] = [];
  const rows = entries.map(([id, fields], i) => {
    const f: Record<string, string> = {};
    for (let j = 0; j < fields.length; j += 2) f[fields[j]] = fields[j + 1];
    values.push(id, f.code, new Date(Number(f.ts)), f.referrer || null, f.ua || null);
    const b = i * 5;
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`;
  });
  await db.query(
    `INSERT INTO analytics.click_events (stream_id, code, clicked_at, referrer, user_agent)
     VALUES ${rows.join(", ")} ON CONFLICT (stream_id) DO NOTHING`,
    values
  );
}

async function consume() {
  const reader = redis.duplicate(); // blocking reads get their own connection
  let cursor = "0"; // first replay our own unacknowledged events, then switch to new ones
  for (;;) {
    const res = (await reader.xreadgroup(
      "GROUP", GROUP, CONSUMER, "COUNT", 200, "BLOCK", 5000, "STREAMS", STREAM, cursor
    )) as unknown as [string, StreamEntry[]][] | null;
    if (!res) continue; // timed out with nothing new
    const entries = res[0][1];
    if (entries.length === 0) {
      cursor = ">";
      continue;
    }
    await saveBatch(entries);
    await redis.xack(STREAM, GROUP, ...entries.map(([id]) => id));
  }
}

const app = express();
app.get("/healthz", (_req, res) => {
  res.send("ok");
});
app.get("/readyz", async (_req, res) => {
  try {
    await Promise.all([db.query("SELECT 1"), redis.ping()]);
    res.send("ready");
  } catch {
    res.status(503).send("not ready");
  }
});

app.get("/stats/:code", async (req, res, next) => {
  try {
    const { code } = req.params;
    const [total, daily, referrers] = await Promise.all([
      db.query("SELECT COUNT(*)::int AS n FROM analytics.click_events WHERE code = $1", [code]),
      db.query(
        `SELECT to_char(date_trunc('day', clicked_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS clicks
         FROM analytics.click_events
         WHERE code = $1 AND clicked_at > now() - interval '7 days'
         GROUP BY 1 ORDER BY 1`,
        [code]
      ),
      db.query(
        `SELECT COALESCE(referrer, 'direct') AS referrer, COUNT(*)::int AS clicks
         FROM analytics.click_events WHERE code = $1
         GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
        [code]
      ),
    ]);
    res.json({
      code,
      totalClicks: total.rows[0].n,
      last7Days: daily.rows,
      topReferrers: referrers.rows,
    });
  } catch (err) {
    next(err);
  }
});

init()
  .then(() => {
    app.listen(PORT, () => console.log(`analytics-service on :${PORT}`));
    consume().catch((err) => {
      console.error("consumer crashed", err);
      process.exit(1); // let Docker/Kubernetes restart us
    });
  })
  .catch((err) => {
    console.error("init failed", err);
    process.exit(1);
  });