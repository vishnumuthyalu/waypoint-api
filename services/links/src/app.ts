import express from "express";
import path from "path";
import * as OpenApiValidator from "express-openapi-validator";
import linksRouter from "./routes/links";
import { prisma } from "./db";

const app = express();
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.send("ok");
});
app.get("/readyz", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.send("ready");
  } catch {
    res.status(503).send("db unavailable");
  }
});

app.use(
  OpenApiValidator.middleware({
    apiSpec: path.join(__dirname, "../spec/openapi.yaml"),
    validateRequests: true,
    validateResponses: true, // fails a test loudly if a handler returns the wrong shape
  })
);

app.use(linksRouter);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.name || "InternalError",
    message: err.message || "Something went wrong",
  });
});

export default app;