import { Router } from "express";
import { customAlphabet } from "nanoid";
import { prisma } from "../db";

const router = Router();
const genCode = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 7);

router.post("/links", async (req, res, next) => {
  try {
    const { originalUrl, customCode, expiresAt } = req.body;
    const code = customCode ?? genCode();

    const existing = await prisma.link.findUnique({ where: { code } });
    if (existing) {
      return res.status(409).json({ error: "Conflict", message: "Code already in use" });
    }

    const link = await prisma.link.create({
      data: { code, originalUrl, expiresAt: expiresAt ? new Date(expiresAt) : null },
    });
    res.status(201).json(link);
  } catch (err) {
    next(err);
  }
});

router.get("/links", async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const [data, total] = await Promise.all([
      prisma.link.findMany({ skip: (page - 1) * limit, take: limit }),
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
    const link = await prisma.link.findUnique({ where: { code: req.params.code } });
    if (!link) return res.status(404).json({ error: "NotFound", message: "Unknown code" });
    await prisma.link.delete({ where: { code: req.params.code } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get("/:code", async (req, res, next) => {
  try {
    const link = await prisma.link.findUnique({ where: { code: req.params.code } });
    if (!link) return res.status(404).json({ error: "NotFound", message: "Unknown code" });
    if (link.expiresAt && link.expiresAt < new Date()) {
      return res.status(410).json({ error: "Gone", message: "Link has expired" });
    }
    await prisma.link.update({ where: { code: link.code }, data: { clicks: { increment: 1 } } });
    res.redirect(302, link.originalUrl);
  } catch (err) {
    next(err);
  }
});

export default router;