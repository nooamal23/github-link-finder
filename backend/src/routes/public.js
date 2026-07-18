import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

export const publicRouter = Router();

// ---- Simple in-memory rate limiter for public write endpoints ----
// Not distributed, not persistent — good enough as basic anti-spam.
const rateBuckets = new Map(); // key -> [timestamps]
function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const key =
      (req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()) ||
      req.ip ||
      "unknown";
    const now = Date.now();
    const arr = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      return res
        .status(429)
        .json({ error: "طلبات كثيرة جداً، يرجى المحاولة لاحقاً." });
    }
    arr.push(now);
    rateBuckets.set(key, arr);
    next();
  };
}

const PHONE_REGEX = /^(\+?216)?[2345789]\d{7}$/;
const registrationRequestSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  ageCategory: z.enum(["child", "adult"]),
  phone: z
    .string()
    .transform((s) => s.replace(/[\s\-().]/g, ""))
    .refine((s) => PHONE_REGEX.test(s), "invalid Tunisian phone number"),
});

// POST /api/public/registration-requests — visitor form submission
publicRouter.post(
  "/registration-requests",
  rateLimit({ windowMs: 60_000, max: 5 }),
  async (req, res, next) => {
    try {
      const data = registrationRequestSchema.parse(req.body);
      await prisma.registrationRequest.create({
        data: {
          fullName: data.fullName,
          ageCategory: data.ageCategory,
          phone: data.phone,
        },
        select: { id: true },
      });
      res.status(201).json({ ok: true });
    } catch (e) {
      if (e?.issues) return res.status(400).json({ error: "بيانات غير صالحة" });
      next(e);
    }
  },
);


// GET /api/public/courses
publicRouter.get("/courses", async (_req, res, next) => {
  try {
    const courses = await prisma.course.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: "desc" },
      include: {
        instructor: { select: { fullName: true } },
        _count: { select: { enrollments: true } },
      },
    });
    res.json(
      courses.map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        level: c.level,
        schedule: c.schedule,
        capacity: c.capacity,
        instructor: c.instructor?.fullName ?? null,
        enrolled: c._count.enrollments,
        startDate: c.startDate ? c.startDate.toISOString().slice(0, 10) : null,
        endDate: c.endDate ? c.endDate.toISOString().slice(0, 10) : null,
      }))
    );
  } catch (e) { next(e); }
});

// GET /api/public/news
publicRouter.get("/news", async (_req, res, next) => {
  try {
    const rows = await prisma.news.findMany({
      orderBy: { publishedAt: "desc" },
      take: 50,
    });
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/public/competitions
publicRouter.get("/competitions", async (_req, res, next) => {
  try {
    const rows = await prisma.competition.findMany({
      orderBy: [{ year: "desc" }, { name: "asc" }],
    });
    res.json(
      rows.map((c) => ({
        ...c,
        passRate:
          c.participants > 0 ? Math.round((c.passed / c.participants) * 100) : 0,
      }))
    );
  } catch (e) { next(e); }
});

// GET /api/public/gallery
publicRouter.get("/gallery", async (_req, res, next) => {
  try {
    const rows = await prisma.gallery.findMany({
      orderBy: { id: "desc" },
      take: 60,
    });
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/public/board
publicRouter.get("/board", async (_req, res, next) => {
  try {
    const rows = await prisma.boardMember.findMany({
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      select: {
        id: true, fullName: true, position: true, photoUrl: true, orderIndex: true,
      },
    });
    res.json(rows);
  } catch (e) { next(e); }
});
