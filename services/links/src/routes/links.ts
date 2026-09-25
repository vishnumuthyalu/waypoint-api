import { Router } from "express";
import { customAlphabet } from "nanoid";
import { prisma } from "../db";
import { invalidate } from "../cache";

const router = Router();
const genCode = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 7);

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";

router.post("/links", async (req, res, next) => {
  const { originalUrl, customCode, expiresAt } = req.body;
  const attempts = customCode ? 1 : 3;
  for (let i = 0; i < attempts; i++) {
    const code = customCode ?? genCode();
    try {
      const link = await prisma.link.create({
        data: { code, originalUrl, expiresAt: expiresAt ? new Date(expiresAt) : null },
      });
      await invalidate(code); // clears a cached "missing" entry
      return res.status(201).json(link);
    } catch (err) {
      if (!isUniqueViolation(err)) return next(err);
      if (customCode) {
        return res.status(409).json({ error: "Conflict", message: "Code already in use" });
      }
    }
  }
  next(new Error("Could not generate a unique code"));
});

router.get("/links", async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const [data, total] = await Promise.all([
      prisma.link.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.link.count(),
    ]);
    res.json({ data, page, limit, total });
  } catch (err) {
    next(err);
  }
});

router.get("/links/:code", async (req, res, next) => {
  try {
    const link = await prisma.link.findUnique({ where: { code: req.params.code } });
    if (!link) return res.status(404).json({ error: "NotFound", message: "Unknown code" });
    res.json(link);
  } catch (err) {
    next(err);
  }
});

router.delete("/links/:code", async (req, res, next) => {
  try {
    const { count } = await prisma.link.deleteMany({ where: { code: req.params.code } });
    if (count === 0) return res.status(404).json({ error: "NotFound", message: "Unknown code" });
    await invalidate(req.params.code);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;