import { z } from "zod";
import { prisma } from "../../db/prisma.js";

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

export async function list(_req, res, next) {
  try {
    const rows = await prisma.boardMember.findMany({
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    });
    res.json(rows.map(serializeBoard));
  } catch (e) { next(e); }
}

export async function create(req, res, next) {
  try {
    const b = boardSchema.parse(req.body);
    const data = { ...b, birthDate: b.birthDate ? new Date(b.birthDate) : null };
    const created = await prisma.boardMember.create({ data });
    res.status(201).json(serializeBoard(created));
  } catch (e) { next(e); }
}

export async function update(req, res, next) {
  try {
    const patch = boardSchema.partial().parse(req.body);
    const data = { ...patch };
    if (patch.birthDate !== undefined) data.birthDate = patch.birthDate ? new Date(patch.birthDate) : null;
    const updated = await prisma.boardMember.update({ where: { id: req.params.id }, data });
    res.json(serializeBoard(updated));
  } catch (e) { next(e); }
}

export async function remove(req, res, next) {
  try {
    await prisma.boardMember.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
}