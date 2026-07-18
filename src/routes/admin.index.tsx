import { createFileRoute } from "@tanstack/react-router";
import { Users, BookOpen, GraduationCap, Wallet, TrendingUp, TrendingDown, UserCheck } from "lucide-react";
import { useFinanceStore } from "@/lib/finance-store";
import { usePeopleStore } from "@/lib/people-store";
import { useNewsStore } from "@/lib/news-store";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { stats, entries } = useFinanceStore();
  const { people, courses } = usePeopleStore();
  const { news } = useNewsStore();

  const students = stats?.students ?? people.filter((p) => p.role === "student").length;
  const instructors = stats?.instructors ?? people.filter((p) => p.role === "instructor").length;
  const coursesCount = stats?.courses ?? courses.length;
  const enrolledStudents = stats?.enrolledStudents ?? 0;
  const balance = stats?.financeBalance ??
    entries.reduce((s, e) => s + (e.kind === "income" ? e.amount : -e.amount), 0);
  const income = stats?.financeIncome ??
    entries.filter((e) => e.kind === "income").reduce((s, e) => s + e.amount, 0);
  const expense = stats?.financeExpense ??
    entries.filter((e) => e.kind === "expense").reduce((s, e) => s + e.amount, 0);

  const cards = [
    { label: "الطلبة المسجّلون في الجمعية", value: students, icon: Users, accent: "bg-primary/10 text-primary" },
    { label: "الطلبة المسجّلون في الدورات", value: enrolledStudents, icon: UserCheck, accent: "bg-accent text-accent-foreground" },
    { label: "الدورات", value: coursesCount, icon: BookOpen, accent: "bg-gold/15 text-gold-foreground" },
    { label: "المعلمون", value: instructors, icon: GraduationCap, accent: "bg-secondary text-secondary-foreground" },
    { label: "رصيد الصندوق", value: `${balance} د.ت`, icon: Wallet, accent: "bg-primary/10 text-primary" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-foreground">لوحة القيادة</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          نظرة عامة على نشاط الفرع: الدورات، الأعضاء، والمالية.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.accent}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-2xl font-bold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold">إشغال الدورات</h2>
          <ul className="mt-4 space-y-3">
            {courses.length === 0 && (
              <li className="text-sm text-muted-foreground">لا توجد دورات بعد.</li>
            )}
            {courses.map((c) => {
              const enrolled = people.filter((p) => p.role === "student" && p.courseIds.includes(c.id)).length;
              const capacity = c.capacity ?? 25;
              const pct = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;
              return (
                <li key={c.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{c.title}</span>
                    <span className="text-xs text-muted-foreground">{enrolled}/{capacity}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold">آخر الأخبار</h2>
          <ul className="mt-4 space-y-3">
            {news.length === 0 && (
              <li className="text-sm text-muted-foreground">لا توجد أخبار بعد.</li>
            )}
            {news.slice(0, 4).map((n) => (
              <li key={n.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                    {n.tag}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{n.dateGregorian}</span>
                </div>
                <div className="mt-1.5 text-sm font-semibold text-foreground">{n.title}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold">حركة الصندوق</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-primary"><TrendingUp className="h-4 w-4" /> مداخيل</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{income} د.ت</div>
          </div>
          <div className="rounded-xl bg-destructive/5 p-4">
            <div className="flex items-center gap-2 text-destructive"><TrendingDown className="h-4 w-4" /> مصاريف</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{expense} د.ت</div>
          </div>
          <div className="rounded-xl bg-gold/10 p-4">
            <div className="text-xs font-semibold text-gold-foreground">الصافي</div>
            <div className="mt-2 text-2xl font-bold text-foreground">{balance >= 0 ? "+" : ""}{balance} د.ت</div>
          </div>
        </div>
      </div>
    </div>
  );
}
