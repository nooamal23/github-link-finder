import { z } from "zod";
import { prisma } from "../../db/prisma.js";

const newsSchema = z.object({
  title: z.string().min(2),
  excerpt: z.string().min(2),
  body: z.string().min(2),
  tag: z.string().min(1),
  dateGregorian: z.string().min(1),
  dateHijri: z.string().min(1),
});

export async function list(_req, res, next) {
  try {
    const rows = await prisma.news.findMany({ orderBy: { publishedAt: "desc" } });
    res.json(rows);
  } catch (e) { next(e); }
}

export async function create(req, res, next) {
  try {
    const n = newsSchema.parse(req.body);
    const created = await prisma.news.create({ data: n });
    res.status(201).json(created);
  } catch (e) { next(e); }
}

export async function update(req, res, next) {
  try {
    const patch = newsSchema.partial().parse(req.body);
    const updated = await prisma.news.update({ where: { id: req.params.id }, data: patch });
    res.json(updated);
  } catch (e) { next(e); }
}

export async function remove(req, res, next) {
  try {
    await prisma.news.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
}