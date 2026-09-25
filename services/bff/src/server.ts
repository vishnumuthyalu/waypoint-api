import express from "express";

const PORT = Number(process.env.PORT ?? 3000);
const LINKS_URL = process.env.LINKS_URL ?? "http://localhost:3001";
const ANALYTICS_URL = process.env.ANALYTICS_URL ?? "http://localhost:3002";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";

type Link = { code: string; [key: string]: unknown };

const call = (url: string, init: RequestInit = {}) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(2000) });

const withShortUrl = (link: Link) => ({ ...link, shortUrl: `${PUBLIC_BASE_URL}/${link.code}` });

const app = express();
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.send("ok");
});
app.get("/readyz", async (_req, res) => {
  try {
    const r = await call(`${LINKS_URL}/healthz`);
    res.status(r.ok ? 200 : 503).send(r.ok ? "ready" : "links unavailable");
  } catch {
    res.status(503).send("links unavailable");
  }
});

app.post("/api/links", async (req, res, next) => {
  try {
    const r = await call(`${LINKS_URL}/links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const body = (await r.json()) as Link;
    res.status(r.status).json(r.ok ? withShortUrl(body) : body);
  } catch (err) {
    next(err);
  }
});

app.get("/api/links", async (req, res, next) => {
  try {
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    const r = await call(`${LINKS_URL}/links${qs ? `?${qs}` : ""}`);
    const body = (await r.json()) as { data?: Link[] };
    if (r.ok && body.data) body.data = body.data.map(withShortUrl);
    res.status(r.status).json(body);
  } catch (err) {
    next(err);
  }
});

app.delete("/api/links/:code", async (req, res, next) => {
  try {
    const r = await call(`${LINKS_URL}/links/${encodeURIComponent(req.params.code)}`, { method: "DELETE" });
    if (r.status === 204) return res.status(204).end();
    res.status(r.status).json(await r.json());
  } catch (err) {
    next(err);
  }
});

// one call for the whole dashboard view: link metadata + analytics, fetched in parallel
app.get("/api/dashboard/links/:code", async (req, res, next) => {
  try {
    const code = encodeURIComponent(req.params.code);
    const [linkRes, statsRes] = await Promise.allSettled([
      call(`${LINKS_URL}/links/${code}`),
      call(`${ANALYTICS_URL}/stats/${code}`),
    ]);
    if (linkRes.status === "rejected") throw linkRes.reason;
    if (linkRes.value.status === 404) {
      return res.status(404).json({ error: "NotFound", message: "Unknown code" });
    }
    if (!linkRes.value.ok) throw new Error(`links-service returned ${linkRes.value.status}`);

    const link = (await linkRes.value.json()) as Link;
    const analytics =
      statsRes.status === "fulfilled" && statsRes.value.ok
        ? await statsRes.value.json()
        : { unavailable: true };
    res.json({ ...withShortUrl(link), analytics });
  } catch (err) {
    next(err);
  }
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(502).json({ error: "UpstreamError", message: err.message });
});

app.listen(PORT, () => console.log(`dashboard-bff on :${PORT}`));