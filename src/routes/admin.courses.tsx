import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, X, Pencil, Trash2, Eye, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { formatArabicDateRange } from "@/lib/utils";
import { ArabicDateInput } from "@/components/ui/arabic-date-input";
import { confirmToast } from "@/lib/confirm-toast";
import { useLiveSearch } from "@/lib/use-live-search";
import { SearchBox, NoResults } from "@/components/ui/search-box";


import {
  usePeopleStore,
  peopleActions,
  countSessions,
  isCourseActive,
  LEVEL_LABEL,
  TYPE_LABEL,
  AUDIENCE_LABEL,
  ALLOWED_AUDIENCE,
  WEEKDAYS,
  type CourseLite,
  type CourseLevel,
  type CourseType,
  type CourseAudience,
  type Weekday,
} from "@/lib/people-store";

export const Route = createFileRoute("/admin/courses")({
  component: CoursesAdminPage,
});

type FormState = {
  title: string;
  type: CourseType;
  audience: CourseAudience;
  level: CourseLevel;
  startDate: string;
  endDate: string;
  days: Weekday[];
  timeFrom: string;
  timeTo: string;
  instructorId: string;
  capacity: number;
};

const EMPTY_FORM: FormState = {
  title: "",
  type: "quran",
  audience: "children",
  level: "beginner",
  startDate: "",
  endDate: "",
  days: [],
  timeFrom: "",
  timeTo: "",
  instructorId: "",
  capacity: 25,
};

function CoursesAdminPage() {
  const { courses, people } = usePeopleStore();
  const instructors = people.filter((p) => p.role === "instructor");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CourseLite | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [viewing, setViewing] = useState<CourseLite | null>(null);

  const instructorById = useMemo(() => new Map(instructors.map((i) => [i.id, i])), [instructors]);

  const { query, setQuery, filtered: visibleCourses } = useLiveSearch(courses, [
    (c) => c.title,
    (c) => (c.instructorId ? instructorById.get(c.instructorId)?.fullName ?? "" : ""),
  ]);


  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(c: CourseLite) {
    setEditing(c);
    setForm({
      title: c.title,
      type: c.type ?? "quran",
      audience: c.audience ?? "children",
      level: c.level ?? "beginner",
      startDate: c.startDate ?? "",
      endDate: c.endDate ?? "",
      days: c.days ?? [],
      timeFrom: c.timeFrom ?? "",
      timeTo: c.timeTo ?? "",
      instructorId: c.instructorId ?? "",
      capacity: c.capacity ?? 25,
    });
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ALLOWED_AUDIENCE[form.type].includes(form.audience)) {
      alert("الفئة المستهدفة غير متاحة لهذا النوع من الدورات.");
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      alert("تاريخ النهاية يجب أن يكون بعد تاريخ البداية.");
      return;
    }
    const payload = {
      title: form.title,
      type: form.type,
      audience: form.audience,
      level: form.level,
      startDate: form.startDate,
      endDate: form.endDate,
      days: form.days,
      timeFrom: form.timeFrom,
      timeTo: form.timeTo,
      instructorId: form.instructorId || undefined,
      capacity: Number(form.capacity) || 25,
    };
    if (editing) peopleActions.updateCourse(editing.id, payload);
    else peopleActions.addCourse(payload);
    setOpen(false);
  }

  function remove(c: CourseLite) {
    confirmToast({
      message: `حذف الدورة "${c.title}"؟`,
      description: "سيتم إلغاء تسجيل جميع المرسمين بها.",
      onConfirm: () => {
        peopleActions.removeCourse(c.id);
        toast.success(`تم حذف الدورة "${c.title}"`);
      },
    });
  }

  function toggleDay(d: Weekday) {
    setForm((f) => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort(),
    }));
  }

  function onTypeChange(type: CourseType) {
    const allowed = ALLOWED_AUDIENCE[type];
    setForm((f) => ({
      ...f,
      type,
      audience: allowed.includes(f.audience) ? f.audience : allowed[0],
    }));
  }

  const totalSessions = countSessions(form.startDate, form.endDate, form.days);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">الدورات</h1>
          <p className="mt-1 text-sm text-muted-foreground">إنشاء وإدارة الدورات مع التفاصيل الكاملة.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> دورة جديدة
        </button>
      </header>

      <SearchBox value={query} onChange={setQuery} placeholder="ابحث عن دورة أو معلم..." />

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          لا توجد دورات حاليا. اضغط "دورة جديدة" للبدء.
        </div>
      ) : visibleCourses.length === 0 ? (
        <NoResults />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleCourses.map((c) => {
            const enrolled = people.filter((p) => p.role === "student" && p.courseIds.includes(c.id)).length;
            const instructor = c.instructorId ? instructorById.get(c.instructorId) : undefined;
            const active = isCourseActive(c);
            const sessions = countSessions(c.startDate, c.endDate, c.days);
            const cap = c.capacity ?? 25;
            const pct = cap > 0 ? Math.min(100, Math.round((enrolled / cap) * 100)) : 0;
            return (
              <article key={c.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {c.type && (
                      <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                        {TYPE_LABEL[c.type]}
                      </span>
                    )}
                    {c.audience && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {AUDIENCE_LABEL[c.audience]}
                      </span>
                    )}
                    {c.level && (
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                        {LEVEL_LABEL[c.level]}
                      </span>
                    )}
                    {!active && (
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                        أرشيف
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setViewing(c)}
                      className="rounded-md border border-border bg-background p-1.5 hover:bg-secondary"
                      title="مشاهدة"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => openEdit(c)}
                      className="rounded-md border border-border bg-background p-1.5 hover:bg-secondary"
                      title="تعديل"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(c)}
                      className="rounded-md border border-destructive/30 bg-background p-1.5 text-destructive hover:bg-destructive/10"
                      title="حذف"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="mt-3 font-display text-lg font-bold">{c.title}</h3>

                <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <Row label="التاريخ" value={formatArabicDateRange(c.startDate ?? "", c.endDate ?? "")} />

                  <Row label="الأيام" value={c.days && c.days.length > 0 ? c.days.map((d) => WEEKDAYS.find((w) => w.value === d)?.label).join("، ") : "—"} />
                  <Row label="التوقيت" value={c.timeFrom && c.timeTo ? `${c.timeFrom} — ${c.timeTo}` : "—"} />
                  <Row label="عدد الحصص" value={sessions > 0 ? String(sessions) : "—"} />
                  <Row label="المعلم" value={instructor ? instructor.fullName : "غير محدد"} />
                </dl>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{enrolled}/{cap} مسجّل</span>
                    <span className="font-semibold text-primary">{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 py-8">
          <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-elevated">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">{editing ? "تعديل الدورة" : "دورة جديدة"}</h2>
              <button onClick={() => setOpen(false)} className="rounded-md p-1 hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field className="sm:col-span-2" label="عنوان الدورة" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />

              <div>
                <label className="mb-1.5 block text-sm font-semibold">نوع الدورة</label>
                <select
                  value={form.type}
                  onChange={(e) => onTypeChange(e.target.value as CourseType)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                >
                  {Object.entries(TYPE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">الفئة المستهدفة</label>
                <select
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value as CourseAudience })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                >
                  {ALLOWED_AUDIENCE[form.type].map((a) => (
                    <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold">المستوى</label>
                <select
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value as CourseLevel })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                >
                  {Object.entries(LEVEL_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              <Field label="تاريخ البداية" type="date" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} required />
              <Field label="تاريخ النهاية" type="date" value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} required />

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold">أيام الدورة في الأسبوع</label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => {
                    const on = form.days.includes(d.value);
                    return (
                      <button
                        type="button"
                        key={d.value}
                        onClick={() => toggleDay(d.value)}
                        className={`rounded-lg border px-3 py-1.5 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"}`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {form.days.length > 0 ? `${form.days.length} يوم/أيام في الأسبوع` : "لم يتم اختيار أي يوم بعد"}
                </div>
              </div>

              <Field label="من الساعة" type="time" value={form.timeFrom} onChange={(v) => setForm({ ...form, timeFrom: v })} required />
              <Field label="إلى الساعة" type="time" value={form.timeTo} onChange={(v) => setForm({ ...form, timeTo: v })} required />

              <div className="sm:col-span-2 rounded-lg border border-dashed border-border bg-muted/40 p-3 text-sm">
                <span className="font-semibold">عدد الحصص الجملي: </span>
                <span className="text-primary font-bold">{totalSessions}</span>
                <span className="mr-2 text-xs text-muted-foreground">
                  (يُحسب تلقائيا من التاريخ والأيام المختارة)
                </span>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">المعلم المسؤول</label>
                <select
                  value={form.instructorId}
                  onChange={(e) => setForm({ ...form, instructorId: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                >
                  <option value="">— اختر معلما —</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>{i.fullName}</option>
                  ))}
                </select>
                {instructors.length === 0 && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    لا يوجد معلمون بعد. أضف معلمين من قسم "المعلمون".
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">الطاقة الاستيعابية</label>
                <input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                />
              </div>

              <button
                type="submit"
                className="sm:col-span-2 mt-2 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                {editing ? "حفظ التغييرات" : "إنشاء الدورة"}
              </button>
            </form>
          </div>
        </div>
      )}

      {viewing && (
        <ViewCourseModal
          course={viewing}
          onClose={() => setViewing(null)}
          onChangeInstructor={() => {
            setViewing(null);
            openEdit(viewing);
          }}
        />
      )}
    </div>
  );
}

function ViewCourseModal({
  course,
  onClose,
  onChangeInstructor,
}: {
  course: CourseLite;
  onClose: () => void;
  onChangeInstructor: () => void;
}) {
  const { people } = usePeopleStore();
  const instructor = course.instructorId ? people.find((p) => p.id === course.instructorId) : undefined;
  const students = people.filter((p) => p.role === "student" && p.courseIds.includes(course.id));
  const availableStudents = people.filter(
    (p) => p.role === "student" && !p.courseIds.includes(course.id),
  );
  const [addOpen, setAddOpen] = useState(false);
  const [pickId, setPickId] = useState("");

  function unenroll(studentId: string, name: string) {
    confirmToast({
      message: `حذف ${name} من هذه الدورة؟`,
      onConfirm: () => {
        peopleActions.unenroll(course.id, studentId);
        toast.success(`تم حذف ${name} من الدورة`);
      },
    });
  }

  function enroll() {
    if (!pickId) return;
    const s = availableStudents.find((p) => p.id === pickId);
    peopleActions.enroll(course.id, pickId);
    setPickId("");
    setAddOpen(false);
    if (s) toast.success(`تمت إضافة ${s.fullName} إلى الدورة`);
  }



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 px-4 py-8">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-elevated">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{course.title}</h2>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">المعلم المسؤول</div>
              <div className="font-semibold">{instructor?.fullName ?? "غير محدد"}</div>
            </div>
            <button
              onClick={onChangeInstructor}
              className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-secondary"
              title="تعديل المعلم"
            >
              <Pencil className="h-3.5 w-3.5" /> تغيير
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">
              المرسّمون <span className="text-muted-foreground">({students.length})</span>
            </div>
            <button
              onClick={() => setAddOpen((v) => !v)}
              disabled={availableStudents.length === 0}
              className="flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              title={availableStudents.length === 0 ? "لا يوجد تلاميذ متاحون للإضافة" : "إضافة تلميذ"}
            >
              <UserPlus className="h-3.5 w-3.5" /> إضافة تلميذ
            </button>
          </div>

          {addOpen && (
            <div className="mb-3 rounded-lg border border-border bg-background p-3">
              {availableStudents.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  كل التلاميذ المسجلين موجودون في هذه الدورة. أضف تلاميذ جددا من قسم "التلاميذ".
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-xs font-semibold">اختر تلميذا</label>
                    <select
                      value={pickId}
                      onChange={(e) => setPickId(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">— اختر من القائمة —</option>
                      {availableStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.fullName} (@{s.username})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={enroll}
                    disabled={!pickId}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    إضافة
                  </button>
                </div>
              )}
            </div>
          )}

          {students.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              لا يوجد مرسّمون بعد.
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {students.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{s.fullName}</div>
                    <div className="truncate text-xs text-muted-foreground">@{s.username}</div>
                  </div>
                  <button
                    onClick={() => unenroll(s.id, s.fullName)}
                    className="flex items-center gap-1 rounded-md border border-destructive/30 bg-background px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                    title="حذف من الدورة"
                  >
                    <UserMinus className="h-3.5 w-3.5" /> حذف
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="text-foreground/80">{value}</dd>
    </div>
  );
}

function Field({
  label, value, onChange, required, className, type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  className?: string;
  type?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      {type === "date" ? (
        <ArabicDateInput value={value} onChange={onChange} required={required} />
      ) : (
        <input
          type={type}
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      )}
    </div>
  );
}
