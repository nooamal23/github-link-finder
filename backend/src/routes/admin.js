import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { signFinanceToken, requireFinanceUnlock } from "../middleware/finance.js";

export const adminRouter = Router();


// ---------- USERS ----------
adminRouter.get("/users", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, username: true, fullName: true, role: true,
        phone: true, birthDate: true, photoUrl: true,
        isActive: true, createdAt: true,
        enrollments: { select: { courseId: true } },
        coursesTaught: { select: { id: true } },
      },
    });
    res.json(users.map(u => ({
      ...u,
      birthDate: u.birthDate ? u.birthDate.toISOString().slice(0, 10) : null,
      courseIds: [
        ...u.enrollments.map(e => e.courseId),
        ...u.coursesTaught.map(c => c.id),
      ],
      enrollments: undefined,
      coursesTaught: undefined,
    })));
  } catch (e) { next(e); }
});

const createUserSchema = z.object({
  username: z.string().min(2),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: z.enum(["admin", "instructor", "student"]),
  phone: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});

adminRouter.post("/users", async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const user = await prisma.user.create({
      data: {
        username: data.username,
        passwordHash: await bcrypt.hash(data.password, 10),
        fullName: data.fullName,
        role: data.role,
        phone: data.phone || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        photoUrl: data.photoUrl || null,
      },
      select: {
        id: true, username: true, fullName: true, role: true,
        phone: true, birthDate: true, photoUrl: true,
        isActive: true, createdAt: true,
      },
    });
    res.status(201).json({
      ...user,
      birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
    });
  } catch (e) { next(e); }
});

adminRouter.put("/users/:id", async (req, res, next) => {
  try {
    const patch = z.object({
      fullName: z.string().min(2).optional(),
      phone: z.string().optional().nullable(),
      role: z.enum(["admin", "instructor", "student"]).optional(),
      isActive: z.boolean().optional(),
      username: z.string().min(2).optional(),
      birthDate: z.string().optional().nullable(),
      photoUrl: z.string().optional().nullable(),
    }).parse(req.body);
    const data = { ...patch };
    if (patch.birthDate !== undefined) {
      data.birthDate = patch.birthDate ? new Date(patch.birthDate) : null;
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: {
        id: true, username: true, fullName: true, role: true,
        phone: true, birthDate: true, photoUrl: true,
        isActive: true, createdAt: true,
      },
    });
    res.json({
      ...user,
      birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
    });
  } catch (e) { next(e); }
});

adminRouter.delete("/users/:id", async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

adminRouter.post("/users/:id/reset-password", async (req, res, next) => {
  try {
    const password = z.string().min(6).parse(req.body.password);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------- COURSES ----------
const courseSchema = z.object({
  title: z.string().min(2),
  category: z.enum(["children", "women", "men", "training", "summer"]),
  level: z.string().min(1),
  schedule: z.string().min(1),
  capacity: z.number().int().positive().default(25),
  instructorId: z.string().uuid().nullable().optional(),
  seasonId: z.number().int().nullable().optional(),
  isPublished: z.boolean().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const courseListSelect = {
  id: true, title: true, category: true, level: true, schedule: true,
  capacity: true, instructorId: true, seasonId: true, isPublished: true,
  startDate: true, endDate: true, createdAt: true,
  instructor: { select: { fullName: true } },
  _count: { select: { enrollments: true } },
  enrollments: { select: { studentId: true } },
};

function serializeCourse(c) {
  return {
    id: c.id,
    title: c.title,
    category: c.category,
    level: c.level,
    schedule: c.schedule,
    capacity: c.capacity,
    instructorId: c.instructorId,
    seasonId: c.seasonId,
    isPublished: c.isPublished,
    startDate: c.startDate ? c.startDate.toISOString().slice(0, 10) : null,
    endDate: c.endDate ? c.endDate.toISOString().slice(0, 10) : null,
    instructorName: c.instructor?.fullName ?? null,
    enrolled: c._count?.enrollments ?? 0,
    studentIds: c.enrollments?.map(e => e.studentId) ?? [],
  };
}

adminRouter.get("/courses", async (_req, res, next) => {
  try {
    const rows = await prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      select: courseListSelect,
    });
    res.json(rows.map(serializeCourse));
  } catch (e) { next(e); }
});

adminRouter.post("/courses", async (req, res, next) => {
  try {
    const c = courseSchema.parse(req.body);
    const course = await prisma.course.create({
      data: {
        title: c.title,
        category: c.category,
        level: c.level,
        schedule: c.schedule,
        capacity: c.capacity,
        instructorId: c.instructorId ?? null,
        seasonId: c.seasonId ?? null,
        isPublished: c.isPublished ?? true,
        startDate: c.startDate ? new Date(c.startDate) : null,
        endDate: c.endDate ? new Date(c.endDate) : null,
      },
      select: courseListSelect,
    });
    res.status(201).json(serializeCourse(course));
  } catch (e) { next(e); }
});

adminRouter.put("/courses/:id", async (req, res, next) => {
  try {
    const patch = courseSchema.partial().parse(req.body);
    const data = { ...patch };
    if (patch.startDate !== undefined) data.startDate = patch.startDate ? new Date(patch.startDate) : null;
    if (patch.endDate !== undefined) data.endDate = patch.endDate ? new Date(patch.endDate) : null;
    const course = await prisma.course.update({
      where: { id: req.params.id },
      data,
      select: courseListSelect,
    });
    res.json(serializeCourse(course));
  } catch (e) { next(e); }
});

adminRouter.delete("/courses/:id", async (req, res, next) => {
  try {
    await prisma.course.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

adminRouter.post("/courses/:id/enroll", async (req, res, next) => {
  try {
    const studentId = z.string().uuid().parse(req.body.studentId);
    const enrollment = await prisma.enrollment.upsert({
      where: { courseId_studentId: { courseId: req.params.id, studentId } },
      update: {},
      create: { courseId: req.params.id, studentId },
    });
    res.json(enrollment);
  } catch (e) { next(e); }
});

adminRouter.post("/courses/:id/unenroll", async (req, res, next) => {
  try {
    const studentId = z.string().uuid().parse(req.body.studentId);
    await prisma.enrollment.deleteMany({
      where: { courseId: req.params.id, studentId },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------- NEWS ----------
const newsSchema = z.object({
  title: z.string().min(2),
  excerpt: z.string().min(2),
  body: z.string().min(2),
  tag: z.string().min(1),
  dateGregorian: z.string().min(1),
  dateHijri: z.string().min(1),
});

adminRouter.get("/news", async (_req, res, next) => {
  try {
    const rows = await prisma.news.findMany({ orderBy: { publishedAt: "desc" } });
    res.json(rows);
  } catch (e) { next(e); }
});

adminRouter.post("/news", async (req, res, next) => {
  try {
    const n = newsSchema.parse(req.body);
    const created = await prisma.news.create({ data: n });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

adminRouter.put("/news/:id", async (req, res, next) => {
  try {
    const patch = newsSchema.partial().parse(req.body);
    const updated = await prisma.news.update({ where: { id: req.params.id }, data: patch });
    res.json(updated);
  } catch (e) { next(e); }
});

adminRouter.delete("/news/:id", async (req, res, next) => {
  try {
    await prisma.news.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------- COMPETITIONS ----------
const competitionSchema = z.object({
  name: z.string().min(1),
  level: z.string().min(1),
  year: z.number().int(),
  participants: z.number().int().nonnegative().default(0),
  passed: z.number().int().nonnegative().default(0),
  topThree: z.array(z.object({
    rank: z.number().int(),
    name: z.string(),
    category: z.string(),
  })).default([]),
});

adminRouter.get("/competitions", async (_req, res, next) => {
  try {
    const rows = await prisma.competition.findMany({
      orderBy: [{ year: "desc" }, { name: "asc" }],
    });
    res.json(rows);
  } catch (e) { next(e); }
});

adminRouter.post("/competitions", async (req, res, next) => {
  try {
    const c = competitionSchema.parse(req.body);
    const created = await prisma.competition.create({ data: c });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

adminRouter.put("/competitions/:id", async (req, res, next) => {
  try {
    const patch = competitionSchema.partial().parse(req.body);
    const updated = await prisma.competition.update({
      where: { id: req.params.id }, data: patch,
    });
    res.json(updated);
  } catch (e) { next(e); }
});

adminRouter.delete("/competitions/:id", async (req, res, next) => {
  try {
    await prisma.competition.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------- GALLERY ----------
const gallerySchema = z.object({
  title: z.string().min(1),
  date: z.string().min(1),
  url: z.string().url(),
});

adminRouter.get("/gallery", async (_req, res, next) => {
  try {
    const rows = await prisma.gallery.findMany({ orderBy: { id: "desc" } });
    res.json(rows);
  } catch (e) { next(e); }
});

adminRouter.post("/gallery", async (req, res, next) => {
  try {
    const g = gallerySchema.parse(req.body);
    const created = await prisma.gallery.create({ data: g });
    res.status(201).json(created);
  } catch (e) { next(e); }
});

adminRouter.put("/gallery/:id", async (req, res, next) => {
  try {
    const patch = gallerySchema.partial().parse(req.body);
    const updated = await prisma.gallery.update({ where: { id: req.params.id }, data: patch });
    res.json(updated);
  } catch (e) { next(e); }
});

adminRouter.delete("/gallery/:id", async (req, res, next) => {
  try {
    await prisma.gallery.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------- BOARD MEMBERS ----------
const boardSchema = z.object({
  fullName: z.string().min(2),
  birthDate: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  position: z.enum(["president", "vice_president", "secretary", "treasurer", "member"]),
  photoUrl: z.string().optional().nullable(),
  orderIndex: z.number().int().optional(),
});

function serializeBoard(b) {
  return {
    ...b,
    birthDate: b.birthDate ? b.birthDate.toISOString().slice(0, 10) : null,
  };
}

adminRouter.get("/board", async (_req, res, next) => {
  try {
    const rows = await prisma.boardMember.findMany({
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    });
    res.json(rows.map(serializeBoard));
  } catch (e) { next(e); }
});

adminRouter.post("/board", async (req, res, next) => {
  try {
    const b = boardSchema.parse(req.body);
    const data = { ...b, birthDate: b.birthDate ? new Date(b.birthDate) : null };
    const created = await prisma.boardMember.create({ data });
    res.status(201).json(serializeBoard(created));
  } catch (e) { next(e); }
});

adminRouter.put("/board/:id", async (req, res, next) => {
  try {
    const patch = boardSchema.partial().parse(req.body);
    const data = { ...patch };
    if (patch.birthDate !== undefined) data.birthDate = patch.birthDate ? new Date(patch.birthDate) : null;
    const updated = await prisma.boardMember.update({ where: { id: req.params.id }, data });
    res.json(serializeBoard(updated));
  } catch (e) { next(e); }
});

adminRouter.delete("/board/:id", async (req, res, next) => {
  try {
    await prisma.boardMember.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------- FINANCE ----------
// Second factor: a hashed password (bcrypt) stored in FINANCE_PASSWORD_HASH.
// POST /finance/unlock exchanges the password for a scoped short-lived token.
// All other /finance* routes require BOTH the admin JWT (already enforced in
// index.js) AND that scoped token via the X-Finance-Token header.
const unlockSchema = z.object({ password: z.string().min(1) });

adminRouter.post("/finance/unlock", async (req, res, next) => {
  try {
    const { password } = unlockSchema.parse(req.body);
    const hash = process.env.FINANCE_PASSWORD_HASH;
    if (!hash) {
      return res.status(500).json({
        error:
          "FINANCE_PASSWORD_HASH غير مضبوط على الخادم. اضبطه في backend/.env قبل الاستخدام.",
      });
    }
    const ok = await bcrypt.compare(password, hash);
    if (!ok) return res.status(401).json({ error: "كلمة السر غير صحيحة" });
    const token = signFinanceToken(req.user.sub);
    res.json({ token, expiresIn: 15 * 60 });
  } catch (e) { next(e); }
});

const financeSchema = z.object({
  kind: z.enum(["income", "expense"]),
  category: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().optional().nullable(),
  entryDate: z.string().optional().nullable(),
});

const financeSelect = {
  id: true, kind: true, category: true, amount: true,
  description: true, entryDate: true, createdById: true, createdAt: true,
  createdBy: { select: { fullName: true } },
};

function serializeFinance(f) {
  return {
    id: f.id,
    kind: f.kind,
    category: f.category,
    amount: Number(f.amount),
    description: f.description,
    entryDate: f.entryDate ? f.entryDate.toISOString().slice(0, 10) : null,
    createdById: f.createdById,
    createdByName: f.createdBy?.fullName ?? null,
    createdAt: f.createdAt,
  };
}

// All data routes below are gated by requireFinanceUnlock — the admin JWT
// alone is NOT enough to read or modify finance rows.
adminRouter.use("/finance", requireFinanceUnlock);


adminRouter.get("/finance", async (_req, res, next) => {
  try {
    const rows = await prisma.financeEntry.findMany({
      orderBy: [{ entryDate: "desc" }, { id: "desc" }],
      select: financeSelect,
    });
    res.json(rows.map(serializeFinance));
  } catch (e) { next(e); }
});

adminRouter.post("/finance", async (req, res, next) => {
  try {
    const f = financeSchema.parse(req.body);
    const entry = await prisma.financeEntry.create({
      data: {
        kind: f.kind,
        category: f.category,
        amount: f.amount,
        description: f.description || null,
        entryDate: f.entryDate ? new Date(f.entryDate) : new Date(),
        createdById: req.user.sub,
      },
      select: financeSelect,
    });
    res.status(201).json(serializeFinance(entry));
  } catch (e) { next(e); }
});

adminRouter.put("/finance/:id", async (req, res, next) => {
  try {
    const patch = financeSchema.partial().parse(req.body);
    const data = { ...patch };
    if (patch.entryDate !== undefined) {
      data.entryDate = patch.entryDate ? new Date(patch.entryDate) : null;
    }
    if (patch.description !== undefined) {
      data.description = patch.description || null;
    }
    const entry = await prisma.financeEntry.update({
      where: { id: req.params.id },
      data,
      select: financeSelect,
    });
    res.json(serializeFinance(entry));
  } catch (e) { next(e); }
});

adminRouter.delete("/finance/:id", async (req, res, next) => {
  try {
    await prisma.financeEntry.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---------- STATS ----------
adminRouter.get("/stats", async (_req, res, next) => {
  try {
    const [students, instructors, courses, enrollments, enrolledStudentRows, financeAgg] = await Promise.all([
      prisma.user.count({ where: { role: "student" } }),
      prisma.user.count({ where: { role: "instructor" } }),
      prisma.course.count(),
      prisma.enrollment.count(),
      prisma.enrollment.findMany({ distinct: ["studentId"], select: { studentId: true } }),
      prisma.financeEntry.groupBy({ by: ["kind"], _sum: { amount: true } }),
    ]);
    const enrolledStudents = enrolledStudentRows.length;
    let income = 0, expense = 0;
    for (const row of financeAgg) {
      const val = Number(row._sum.amount ?? 0);
      if (row.kind === "income") income = val;
      else if (row.kind === "expense") expense = val;
    }
    res.json({
      students,
      instructors,
      courses,
      enrollments,
      enrolledStudents,
      financeIncome: income,
      financeExpense: expense,
      financeBalance: income - expense,
    });
  } catch (e) { next(e); }
});

// ---------- REGISTRATION REQUESTS ----------
const REQ_STATUSES = ["pending", "approved", "rejected"];

adminRouter.get("/registration-requests", async (req, res, next) => {
  try {
    const status = String(req.query.status ?? "pending");
    const where =
      status === "all" ? {} : REQ_STATUSES.includes(status) ? { status } : { status: "pending" };
    const rows = await prisma.registrationRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fullName: true,
        ageCategory: true,
        phone: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        resolvedById: true,
      },
    });
    res.json(rows);
  } catch (e) { next(e); }
});

const resolveSchema = z.object({ action: z.enum(["approve", "reject"]) });
adminRouter.post("/registration-requests/:id/resolve", async (req, res, next) => {
  try {
    const { action } = resolveSchema.parse(req.body);
    const row = await prisma.registrationRequest.update({
      where: { id: req.params.id },
      data: {
        status: action === "approve" ? "approved" : "rejected",
        resolvedAt: new Date(),
        resolvedById: req.user?.sub ?? null,
      },
      select: {
        id: true, fullName: true, ageCategory: true, phone: true,
        status: true, createdAt: true, resolvedAt: true, resolvedById: true,
      },
    });
    res.json(row);
  } catch (e) { next(e); }
});
