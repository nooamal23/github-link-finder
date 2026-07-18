import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, X, Pencil, Trash2, Archive } from "lucide-react";
import { formatArabicDate } from "@/lib/utils";
import { confirmToast } from "@/lib/confirm-toast";
import { useLiveSearch } from "@/lib/use-live-search";
import { SearchBox, NoResults } from "@/components/ui/search-box";
import { PersonFormDialog } from "@/components/admin/person-form-dialog";



import {
  usePeopleStore,
  peopleActions,
  splitCourses,
  type Person,
  type Role,
} from "@/lib/people-store";

export function PeopleAdmin({ role }: { role: Role }) {
  const { people, courses } = usePeopleStore();
  const list = people.filter((p) => p.role === role);
  const { query, setQuery, filtered } = useLiveSearch(list, [
    (p) => p.fullName,
    (p) => p.username,
    (p) => p.phone,
  ]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);


  const title = role === "instructor" ? "المعلمون" : "التلاميذ";
  const singular = role === "instructor" ? "معلم" : "تلميذ";
  const desc =
    role === "instructor"
      ? "إدارة المعلمين والمعلمات ومسؤولياتهم على الدورات."
      : "إدارة التلاميذ وتسجيلهم في الدورات.";

  function openAdd() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(p: Person) {
    setEditing(p);
    setOpen(true);
  }

  function remove(p: Person) {
    confirmToast({
      message: `حذف ${p.fullName}؟`,
      description: "لا يمكن التراجع عن هذا الإجراء.",
      onConfirm: () => {
        peopleActions.remove(p.id);
        toast.success(`تم حذف ${p.fullName}`);
      },
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" /> إضافة {singular}
        </button>
      </header>

      <SearchBox
        value={query}
        onChange={setQuery}
        placeholder={`ابحث عن ${singular} (الاسم، المعرف، الهاتف)...`}
      />

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          لا يوجد {singular} حاليا. اضغط "إضافة {singular}" للبدء.
        </div>
      ) : filtered.length === 0 ? (
        <NoResults />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((p) => {
            const { active, archived } = splitCourses(p, courses);
            return (
              <article key={p.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex items-start gap-4">
                  <Avatar name={p.fullName} url={p.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-display text-base font-bold text-foreground">{p.fullName}</h3>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>@{p.username}</span>
                        </div>

                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded-md border border-border bg-background p-1.5 text-foreground hover:bg-secondary"
                          title="تعديل"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => remove(p)}
                          className="rounded-md border border-destructive/30 bg-background p-1.5 text-destructive hover:bg-destructive/10"
                          title="حذف"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <Row label="تاريخ الولادة" value={formatArabicDate(p.birthDate)} />

                      <Row label="الهاتف" value={p.phone || "—"} />
                    </dl>
                  </div>
                </div>

                <div className="mt-4 space-y-2 border-t border-border pt-3">
                  <CoursePills label="الدورات الحالية" items={active.map((c) => c.title)} tone="active" />
                  {archived.length > 0 && (
                    <CoursePills
                      label="الأرشيف"
                      items={archived.map((c) => c.title)}
                      tone="archived"
                      icon={<Archive className="h-3 w-3" />}
                    />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-3 py-4 sm:items-center sm:px-4 sm:py-8">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-elevated sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="min-w-0 truncate font-display text-lg font-bold">
                {editing ? `تعديل ${singular}` : `إضافة ${singular} جديد`}
              </h2>
              <button onClick={() => setOpen(false)} className="shrink-0 rounded-md p-1 hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submit} className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
              <Field className="sm:col-span-2" label="الاسم الكامل" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} required />
              <Field label="المعرف (اسم المستخدم)" value={form.username} onChange={(v) => setForm({ ...form, username: v })} required />
              <Field label="تاريخ الولادة" type="date" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} required />
              <div className="min-w-0">
                <label className="mb-1.5 block text-sm font-semibold">رقم الهاتف</label>
                <input
                  type="tel"
                  value={form.phone}
                  required
                  placeholder="مثال: 20 123 456"
                  onChange={(e) => { setForm({ ...form, phone: e.target.value }); if (phoneError) setPhoneError(null); }}
                  className={`block w-full max-w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 ${phoneError ? "border-destructive focus:ring-destructive/30" : "border-input focus:border-ring focus:ring-ring/30"}`}
                />
                {phoneError && <p className="mt-1.5 text-xs font-medium text-destructive">{phoneError}</p>}
              </div>

              {role === "student" ? (
                <div className="min-w-0">
                  <label className="mb-1.5 block text-sm font-semibold">كلمة العبور</label>
                  <input
                    type="text"
                    value={form.birthDate}
                    readOnly
                    disabled
                    placeholder="YYYY-MM-DD"
                    className="block w-full max-w-full cursor-not-allowed rounded-lg border border-input bg-muted px-3 py-2.5 text-sm text-muted-foreground"
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    كلمة العبور تُطابق دوماً تاريخ الولادة.
                  </p>
                </div>
              ) : (
                <Field
                  label="كلمة العبور (افتراضيا: تاريخ الولادة)"
                  value={form.passwordOverride}
                  onChange={(v) => setForm({ ...form, passwordOverride: v })}
                  placeholder={form.birthDate || "YYYY-MM-DD"}
                />
              )}
              <div className="min-w-0 sm:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold">الصورة الشخصية (اختياري)</label>
                <div className="flex flex-wrap items-center gap-3">
                  {form.photoUrl ? (
                    <img src={form.photoUrl} alt="preview" className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-primary/20" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-muted-foreground ring-2 ring-primary/20">
                      لا صورة
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
                      <span>اختر صورتك</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            setForm((f) => ({ ...f, photoUrl: String(reader.result) }));
                            toast.success("تم اختيار الصورة");
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    <div className="text-xs text-muted-foreground">
                      {form.photoUrl ? "تم اختيار صورة" : "لا يوجد لك صورة"}
                    </div>
                    {form.photoUrl && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, photoUrl: "" })}
                        className="self-start rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-secondary"
                      >
                        إزالة الصورة
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="min-w-0 sm:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold">
                  الدورات (اختياري) — يمكن اختيار أكثر من دورة
                </label>
                <div className="grid max-h-40 grid-cols-[minmax(0,1fr)] gap-1.5 overflow-y-auto rounded-lg border border-input bg-background p-2 sm:grid-cols-2">
                  {courses.map((c) => (
                    <label key={c.id} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-secondary">
                      <input
                        type="checkbox"
                        checked={form.courseIds.includes(c.id)}
                        onChange={() => toggleCourse(c.id)}
                        className="h-4 w-4 shrink-0"
                      />
                      <span className="min-w-0 flex-1 truncate">{c.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">حتى {formatArabicDate(c.endDate)}</span>

                    </label>
                  ))}
                  {courses.length === 0 && (
                    <div className="text-xs text-muted-foreground">لا توجد دورات بعد.</div>
                  )}
                </div>
              </div>

              <button type="submit" className="sm:col-span-2 mt-2 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                {editing ? "حفظ التغييرات" : "إضافة"}
              </button>
            </form>
          </div>
        </div>
      )}
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

function Avatar({ name, url }: { name: string; url?: string }) {
  if (url) {
    return <img src={url} alt={name} className="h-14 w-14 rounded-full object-cover ring-2 ring-primary/20" />;
  }
  const initial = name?.trim().charAt(0) || "?";
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-lg font-bold text-primary ring-2 ring-primary/20">
      {initial}
    </div>
  );
}

function CoursePills({
  label,
  items,
  tone,
  icon,
}: {
  label: string;
  items: string[];
  tone: "active" | "archived";
  icon?: React.ReactNode;
}) {
  const pillClass =
    tone === "active"
      ? "bg-primary/10 text-primary"
      : "bg-muted text-muted-foreground line-through";
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
        {icon} {label}
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">—</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((t) => (
            <span
              key={t}
              title={t}
              className={`inline-block max-w-full whitespace-normal break-words rounded-2xl px-2.5 py-1 text-xs font-medium leading-snug ${pillClass}`}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, required, className, type = "text", placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  className?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className={`min-w-0 ${className ?? ""}`}>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      {type === "date" ? (
        <ArabicDateInput value={value} onChange={onChange} required={required} placeholder={placeholder} />
      ) : (
        <input
          type={type}
          value={value}
          required={required}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full max-w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      )}
    </div>
  );
}
