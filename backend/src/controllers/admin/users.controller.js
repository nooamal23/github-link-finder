import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";

const createUserSchema = z.object({
  username: z.string().min(2),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: z.enum(["admin", "instructor", "student"]),
  phone: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  role: z.enum(["admin", "instructor", "student"]).optional(),
  isActive: z.boolean().optional(),
  username: z.string().min(2).optional(),
  birthDate: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});

export async function list(_req, res, next) {
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
}

export async function create(req, res, next) {
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
}

export async function update(req, res, next) {
  try {
    const patch = updateUserSchema.parse(req.body);
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
}

export async function remove(req, res, next) {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
}

export async function resetPassword(req, res, next) {
  try {
    const password = z.string().min(6).parse(req.body.password);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
}