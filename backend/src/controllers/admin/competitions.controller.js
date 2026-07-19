import { z } from "zod";
import { prisma } from "../../db/prisma.js";

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

export async function list(_req, res, next) {
  try {
    const rows = await prisma.competition.findMany({
      orderBy: [{ year: "desc" }, { name: "asc" }],
    });
    res.json(rows);
  } catch (e) { next(e); }
}

export async function create(req, res, next) {
  try {
    const c = competitionSchema.parse(req.body);
    const created = await prisma.competition.create({ data: c });
    res.status(201).json(created);
  } catch (e) { next(e); }
}

export async function update(req, res, next) {
  try {
    const patch = competitionSchema.partial().parse(req.body);
    const updated = await prisma.competition.update({
      where: { id: req.params.id }, data: patch,
    });
    res.json(updated);
  } catch (e) { next(e); }
}

export async function remove(req, res, next) {
  try {
    await prisma.competition.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
}