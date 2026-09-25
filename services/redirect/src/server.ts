import express from "express";
import Redis from "ioredis";

const PORT = Number(process.env.PORT ?? 3000);
const LINKS_URL = process.env.LINKS_URL ?? "http://localhost:3001";
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
const CACHE_TTL_SECONDS = 300;
const MISSING_TTL_SECONDS = 30;

type CachedLink = { originalUrl: string; expiresAt: string | null };

const app = express();
app.set("trust proxy", true);

// health routes go before /:code so they aren't treated as short codes
app.get("/healthz", (_req, res) => {
  res.send("ok");
});
app.get("/readyz", async (_req, res) => {
  try {
    await redis.ping();
    res.send("ready");
  } catch {
    res.status(503).send("redis unavailable");
  }
});

async function lookup(code: string): Promise<CachedLink | null> {
  const key = `link:${code}`;
  const cached = await redis.get(key);
  if (cached) return cached === "missing" ? null : (JSON.parse(cached) as CachedLink);

  const r = await fetch(`${LINKS_URL}/links/${encodeURIComponent(code)}`, {
    signal: AbortSignal.timeout(2000),
  });
  if (r.status === 404) {
    await redis.set(key, "missing", "EX", MISSING_TTL_SECONDS); // stops repeated misses hitting the DB
    return null;
  }
  if (!r.ok) throw new Error(`links-service returned ${r.status}`);
  const body = (await r.json()) as CachedLink;
  const link: CachedLink = { originalUrl: body.originalUrl, expiresAt: body.expiresAt ?? null };
  await redis.set(key, JSON.stringify(link), "EX", CACHE_TTL_SECONDS);
  return link;
}

app.get("/:code", async (req, res, next) => {
  try {
    const { code } = req.params;
    const link = await lookup(code);
    if (!link) return res.status(404).json({ error: "NotFound", message: "Unknown code" });
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return res.status(410).json({ error: "Gone", message: "Link has expired" });
    }

    // fire-and-forget: the redirect never waits on analytics
    redis
      .xadd(
        "clicks", "MAXLEN", "~", "1000000", "*",
        "code", code,
        "ts", Date.now().toString(),
        "referrer", req.get("referer") ?? "",
        "ua", req.get("user-agent") ?? ""
      )
      .catch((err) => console.error("failed to publish click", err));

    res.redirect(302, link.originalUrl);
  } catch (err) {
    next(err);
  }
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(502).json({ error: "UpstreamError", message: err.message });
});

app.listen(PORT, () => console.log(`redirect-service on :${PORT}`));