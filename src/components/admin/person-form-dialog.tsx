import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { noticeToast } from "@/lib/notice-toast";
import { ArabicDateInput } from "@/components/ui/arabic-date-input";
import { isValidTunisianPhone, TUNISIA_PHONE_MESSAGE } from "@/lib/phone";
import {
  usePeopleStore,
  peopleActions,
  isUsernameTaken,
  type Person,
  type Role,
} from "@/lib/people-store";

type FormState = {
  fullName: string;
  username: string;
  birthDate: string;
  phone: string;
  photoUrl: string;
  courseIds: string[];
  passwordOverride: string;
};

const EMPTY_FORM: FormState = {
  fullName: "",
  username: "",
  birthDate: "",
  phone: "",
  photoUrl: "",
  courseIds: [],
  passwordOverride: "",
};

function initialFormFor(
  editing: Person | null,
  prefill?: Partial<FormState>,
): FormState {
  if (editing) {
    return {
      fullName: editing.fullName,
      username: editing.username,
      birthDate: editing.birthDate,
      phone: editing.phone,
      photoUrl: editing.photoUrl || "",
      courseIds: editing.courseIds,
      passwordOverride:
        editing.password !== editing.birthDate ? editing.password : "",
    };
  }
  return { ...EMPTY_FORM, ...(prefill ?? {}) };
}

export function PersonFormDialog({
  role,
  editing,
  prefill,
  onClose,
  onCreated,
}: {
  role: Role;
  editing: Person | null;
  /** Prefill for add mode (ignored when editing). */
  prefill?: Partial<FormState>;
  onClose: () => void;
  /** Called after a successful add (not on edit, not on failure). */
  onCreated?: () => Promise<void> | void;
}) {
  const { courses } = usePeopleStore();
  const singular = role === "instructor" ? "معلم" : "تلميذ";
  const [form, setForm] = useState<FormState>(() => initialFormFor(editing, prefill));
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleCourse(id: string) {
    setForm((f) => ({
      ...f,
      courseIds: f.courseIds.includes(id)
        ? f.courseIds.filter((x) => x !== id)
        : [...f.courseIds, id],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const uname = form.username.trim();
    if (isUsernameTaken(uname, editing?.id)) {
      noticeToast({
        variant: "warning",
        title: "معرّف مستخدم مكرّر",
        message: "هذا المعرّف مستعمل بالفعل.",
        description:
          "يوجد شخص آخر بنفس اسم المستخدم. يرجى إضافة الاسم الثلاثي (مثلاً: ahmed.ben.salah) لضمان أن يكون المعرّف فريداً.",
      });
      return;
    }
    if (!isValidTunisianPhone(form.phone)) {
      setPhoneError(TUNISIA_PHONE_MESSAGE);
      noticeToast({
        variant: "warning",
        title: "رقم هاتف غير صحيح",
        message: TUNISIA_PHONE_MESSAGE,
      });
      return;
    }
    setPhoneError(null);
    const password =
      role === "student"
        ? form.birthDate
        : form.passwordOverride || form.birthDate;
    const payload = {
      role,
      fullName: form.fullName,
      username: uname,
      birthDate: form.birthDate,
      password,
      phone: form.phone,
      photoUrl: form.photoUrl || undefined,
      courseIds: form.courseIds,
    };
    setSaving(true);
    try {
      if (editing) {
        await peopleActions.update(editing.id, payload);
        if (role === "student") {
          await syncEnrollments(editing.id, editing.courseIds, form.courseIds);
        }
        toast.success(`تم حفظ التغييرات على ${payload.fullName} بنجاح`);
        onClose();
      } else {
        const newId = await peopleActions.add(payload);
        if (role === "student" && newId && form.courseIds.length > 0) {
          await syncEnrollments(newId, [], form.courseIds);
        }
        // onCreated may throw (e.g. request-delete failed); surface it but
        // don't prevent the dialog from closing since the person was created.
        try {
          await onCreated?.();
        } catch (err) {
          noticeToast({
            variant: "error",
            title: "تم إنشاء الحساب لكن حدث خطأ",
            message: (err as Error).message,
          });
        }
        toast.success(`تمت إضافة ${payload.fullName} بنجاح`);
        onClose();
      }
    } catch {
      // peopleActions already surfaced the error toast; keep the dialog open.
    } finally {
      setSaving(false);
    }
  }

  async function syncEnrollments(
    studentId: string,
    prev: string[],
    next: string[],
  ) {
    const prevSet = new Set(prev);
    const nextSet = new Set(next);
    const toEnroll = next.filter((id) => !prevSet.has(id));
    const toUnenroll = prev.filter((id) => !nextSet.has(id));
    await Promise.all([
      ...toEnroll.map((cid) => peopleActions.enroll(cid, studentId)),
      ...toUnenroll.map((cid) => peopleActions.unenroll(cid, studentId)),
    ]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-3 py-4 sm:items-center sm:px-4 sm:py-8">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-elevated sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate font-display text-lg font-bold">
            {editing ? `تعديل ${singular}` : `إضافة ${singular} جديد`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 hover:bg-secondary"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
          <div className="min-w-0 sm:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold">الاسم الكامل</label>
            <input
              type="text"
              value={form.fullName}
              required
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="block w-full max-w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1.5 block text-sm font-semibold">المعرف (اسم المستخدم)</label>
            <input
              type="text"
              value={form.username}
              required
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="block w-full max-w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1.5 block text-sm font-semibold">تاريخ الولادة</label>
            <ArabicDateInput
              value={form.birthDate}
              onChange={(v) => setForm({ ...form, birthDate: v })}
              required
            />
          </div>
          <div className="min-w-0">
            <label className="mb-1.5 block text-sm font-semibold">رقم الهاتف</label>
            <input
              type="tel"
              value={form.phone}
              required
              placeholder="مثال: 20 123 456"
              onChange={(e) => {
                setForm({ ...form, phone: e.target.value });
                if (phoneError) setPhoneError(null);
              }}
              className={`block w-full max-w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 ${
                phoneError
                  ? "border-destructive focus:ring-destructive/30"
                  : "border-input focus:border-ring focus:ring-ring/30"
              }`}
            />
            {phoneError && (
              <p className="mt-1.5 text-xs font-medium text-destructive">{phoneError}</p>
            )}
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
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-semibold">
                كلمة العبور (افتراضيا: تاريخ الولادة)
              </label>
              <input
                type="text"
                value={form.passwordOverride}
                onChange={(e) => setForm({ ...form, passwordOverride: e.target.value })}
                placeholder={form.birthDate || "YYYY-MM-DD"}
                className="block w-full max-w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>
          )}

          <div className="min-w-0 sm:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold">الصورة الشخصية (اختياري)</label>
            <div className="flex flex-wrap items-center gap-3">
              {form.photoUrl ? (
                <img
                  src={form.photoUrl}
                  alt="preview"
                  className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
                />
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
                <label
                  key={c.id}
                  className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-secondary"
                >
                  <input
                    type="checkbox"
                    checked={form.courseIds.includes(c.id)}
                    onChange={() => toggleCourse(c.id)}
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                </label>
              ))}
              {courses.length === 0 && (
                <div className="text-xs text-muted-foreground">لا توجد دورات بعد.</div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="sm:col-span-2 mt-2 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {editing ? "حفظ التغييرات" : "إضافة"}
          </button>
        </form>
      </div>
    </div>
  );
}