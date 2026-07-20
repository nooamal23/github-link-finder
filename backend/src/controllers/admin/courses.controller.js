import { z } from "zod";
import { prisma } from "../../db/prisma.js";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

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
  days: z.array(z.number().int().min(0).max(6)).optional(),
  timeFrom: z.string().regex(timeRegex).optional().nullable(),
  timeTo: z.string().regex(timeRegex).optional().nullable(),
});

const courseListSelect = {
  id: true, title: true, category: true, level: true, schedule: true,
  capacity: true, instructorId: true, seasonId: true, isPublished: true,
  startDate: true, endDate: true, days: true, timeFrom: true, timeTo: true,
  createdAt: true,
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
    days: c.days ?? [],
    timeFrom: c.timeFrom ?? null,
    timeTo: c.timeTo ?? null,
    instructorName: c.instructor?.fullName ?? null,
    enrolled: c._count?.enrollments ?? 0,
    studentIds: c.enrollments?.map(e => e.studentId) ?? [],
  };
}

export async function list(_req, res, next) {
  try {
    const rows = await prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      select: courseListSelect,
    });
    res.json(rows.map(serializeCourse));
  } catch (e) { next(e); }
}

export async function create(req, res, next) {
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
        days: c.days ?? [],
        timeFrom: c.timeFrom ?? null,
        timeTo: c.timeTo ?? null,
      },
      select: courseListSelect,
    });
    res.status(201).json(serializeCourse(course));
  } catch (e) { next(e); }
}

export async function update(req, res, next) {
  try {
    const patch = courseSchema.partial().parse(req.body);
    const data = { ...patch };
    if (patch.startDate !== undefined) data.startDate = patch.startDate ? new Date(patch.startDate) : null;
    if (patch.endDate !== undefined) data.endDate = patch.endDate ? new Date(patch.endDate) : null;
    if (patch.timeFrom !== undefined) data.timeFrom = patch.timeFrom || null;
    if (patch.timeTo !== undefined) data.timeTo = patch.timeTo || null;
    // days already an array; passthrough
    const course = await prisma.course.update({
      where: { id: req.params.id },
      data,
      select: courseListSelect,
    });
    res.json(serializeCourse(course));
  } catch (e) { next(e); }
}

export async function remove(req, res, next) {
  try {
    await prisma.course.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
}

export async function enroll(req, res, next) {
  try {
    const studentId = z.string().uuid().parse(req.body.studentId);
    const enrollment = await prisma.enrollment.upsert({
      where: { courseId_studentId: { courseId: req.params.id, studentId } },
      update: {},
      create: { courseId: req.params.id, studentId },
    });
    res.json(enrollment);
  } catch (e) { next(e); }
}

export async function unenroll(req, res, next) {
  try {
    const studentId = z.string().uuid().parse(req.body.studentId);
    await prisma.enrollment.deleteMany({
      where: { courseId: req.params.id, studentId },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
}