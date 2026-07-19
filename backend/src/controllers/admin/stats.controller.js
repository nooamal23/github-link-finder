import { prisma } from "../../db/prisma.js";

export async function get(_req, res, next) {
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
}