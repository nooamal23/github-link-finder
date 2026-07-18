import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

export const instructorRouter = Router();

instructorRouter.get("/courses", async (req, res, next) => {
  try {
    const courses = await prisma.course.findMany({
      where: { instructorId: req.user.sub },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { enrollments: true } } },
    });
    res.json(
      courses.map((c) => ({ ...c, enrolled: c._count.enrollments }))
    );
  } catch (e) { next(e); }
});

instructorRouter.get("/courses/:id/students", async (req, res, next) => {
  try {
    const rows = await prisma.enrollment.findMany({
      where: { courseId: req.params.id },
      include: { student: { select: { id: true, fullName: true, phone: true } } },
      orderBy: { student: { fullName: "asc" } },
    });
    res.json(rows.map((r) => r.student));
  } catch (e) { next(e); }
});

const attendanceSchema = z.object({
  courseId: z.string().uuid(),
  sessionDate: z.string(),
  entries: z.array(
    z.object({
      studentId: z.string().uuid(),
      present: z.boolean(),
      note: z.string().optional(),
    })
  ),
});

instructorRouter.post("/attendance", async (req, res, next) => {
  try {
    const data = attendanceSchema.parse(req.body);
    const sessionDate = new Date(data.sessionDate);
    await prisma.$transaction(
      data.entries.map((e) =>
        prisma.attendance.upsert({
          where: {
            courseId_studentId_sessionDate: {
              courseId: data.courseId,
              studentId: e.studentId,
              sessionDate,
            },
          },
          update: { present: e.present, note: e.note || null },
          create: {
            courseId: data.courseId,
            studentId: e.studentId,
            sessionDate,
            present: e.present,
            note: e.note || null,
          },
        })
      )
    );
    res.json({ ok: true, count: data.entries.length });
  } catch (e) { next(e); }
});

const evalSchema = z.object({
  courseId: z.string().uuid(),
  studentId: z.string().uuid(),
  label: z.string().min(1),
  score: z.number(),
  maxScore: z.number().default(20),
});

instructorRouter.post("/evaluations", async (req, res, next) => {
  try {
    const e = evalSchema.parse(req.body);
    const created = await prisma.evaluation.create({
      data: {
        courseId: e.courseId,
        studentId: e.studentId,
        label: e.label,
        score: e.score,
        maxScore: e.maxScore,
      },
    });
    res.status(201).json(created);
  } catch (err) { next(err); }
});
