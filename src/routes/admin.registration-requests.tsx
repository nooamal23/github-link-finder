import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, RefreshCw, UserPlus, Phone, Calendar, Baby, User } from "lucide-react";
import { ArabicDateInput } from "@/components/ui/arabic-date-input";
import { confirmToast } from "@/lib/confirm-toast";
import { noticeToast } from "@/lib/notice-toast";
import { formatArabicDate } from "@/lib/utils";
import { isValidTunisianPhone, TUNISIA_PHONE_MESSAGE } from "@/lib/phone";
import {
  AGE_CATEGORY_LABEL,
  listRegistrationRequests,
  resolveRegistrationRequest,
  type RegistrationRequest,
} from "@/lib/registration-requests";
import { peopleActions, usePeopleStore, isUsernameTaken } from "@/lib/people-store";

export const Route = createFileRoute("/admin/registration-requests")({
  head: () => ({
    meta: [
      { title: "طلبات التسجيل — فضاء الإدارة" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegistrationRequestsAdmin,
});

function RegistrationRequestsAdmin() {
  const [items, setItems] = useState<RegistrationRequest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<RegistrationRequest | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const rows = await listRegistrationRequests("pending");
      setItems(rows);
    } catch (e) {
      noticeToast({
        variant: "error",
        title: "تعذّر تحميل الطلبات",
        message: (e as Error).message,
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); }, []);

  function onReject(r: RegistrationRequest) {
    confirmToast({
      message: "هل أنت متأكد من رفض هذا الطلب؟",
      description: "سيتم حذفه من القائمة.",
      confirmLabel: "تأكيد الرفض",
      onConfirm: async () => {
        try {
          await resolveRegistrationRequest(r.id, "reject");
          setItems((cur) => (cur ?? []).filter((x) => x.id !== r.id));
          toast.success("تم رفض الطلب");
        } catch (e) {
          noticeToast({
            variant: "error",
            title: "تعذّر رفض الطلب",
            message: (e as Error).message,
          });
        }
      },
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">طلبات التسجيل</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            مراجعة الطلبات الواردة من الزوار والموافقة عليها أو رفضها.
          </p>
        </div>
        <button
          onClick={reload}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          تحديث
        </button>
      </header>

      {loading && items === null ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          جاري تحميل الطلبات...
        </div>
      ) : (items ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          لا توجد طلبات معلّقة حالياً.
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {(items ?? []).map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-soft"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-foreground">
                    {r.fullName}
                  </h3>
                  <dl className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      {r.ageCategory === "child" ? (
                        <Baby className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <User className="h-3.5 w-3.5 text-primary" />
                      )}
                      <span>الفئة: {AGE_CATEGORY_LABEL[r.ageCategory]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      <span dir="ltr">{r.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span>
                        {formatArabicDate(r.createdAt.slice(0, 10))}
                      </span>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                <button
                  onClick={() => onReject(r)}
                  className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-background px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" /> رفض
                </button>
                <button
                  onClick={() => setApproving(r)}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-soft hover:opacity-90"
                >
                  <Check className="h-4 w-4" /> موافق
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {approving && (
        <ApproveStudentDialog
          request={approving}
          onClose={() => setApproving(null)}
          onDone={(id) => {
            setItems((cur) => (cur ?? []).filter((x) => x.id !== id));
            setApproving(null);
          }}
        />
      )}
    </div>
  );
}

// ---- Approve dialog: pre-filled add-student form ----
// Mirrors the add-student flow in people-admin.tsx (same peopleActions.add call,
// same student rules: password locked to birth date). Kept as a separate dialog
// so the approval flow is self-contained.
function ApproveStudentDialog({
  request,
  onClose,
  onDone,
}: {
  request: RegistrationRequest;
  onClose: () => void;
  onDone: (requestId: string) => void;
}) {
  const { courses } = usePeopleStore();
  const [fullName, setFullName] = useState(request.fullName);
  const [username, setUsername] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState(request.phone);
  const [photoUrl, setPhotoUrl] = useState("");
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleCourse(id: string) {
    setCourseIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const uname = username.trim();
    if (!uname || !fullName.trim() || !birthDate) return;
    if (isUsernameTaken(uname)) {
      noticeToast({
        variant: "warning",
        title: "معرّف مستخدم مكرّر",
        message: "هذا المعرّف مستعمل بالفعل.",
        description:
          "يوجد شخص آخر بنفس اسم المستخدم. يرجى إضافة الاسم الثلاثي (مثلاً: ahmed.ben.salah).",
      });
      return;
    }
    if (!isValidTunisianPhone(phone)) {
      setPhoneError(TUNISIA_PHONE_MESSAGE);
      noticeToast({
        variant: "warning",
        title: "رقم هاتف غير صحيح",
        message: TUNISIA_PHONE_MESSAGE,
      });
      return;
    }
    setPhoneError(null);
    setSaving(true);
    try {
      await peopleActions.add({
        role: "student",
        fullName: fullName.trim(),
        username: uname,
        birthDate,
        password: birthDate,
        phone,
        photoUrl: photoUrl || undefined,
        courseIds,
      });
      // Only mark resolved after the student account was created successfully.
      await resolveRegistrationRequest(request.id, "approve");
      toast.success(`تمت الموافقة على طلب ${fullName.trim()}`);
      onDone(request.id);
    } catch (e) {
      noticeToast({
        variant: "error",
        title: "تعذّر إتمام الموافقة",
        message: (e as Error).message,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-3 py-4 sm:items-center sm:px-4 sm:py-8">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-elevated sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate font-display text-lg font-bold">
            الموافقة على الطلب — إنشاء حساب تلميذ
          </h2>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1 hover:bg-secondary"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          تم استيراد الاسم ورقم الهاتف من الطلب. أكمل بقية البيانات لإنشاء الحساب.
        </p>

        <form
          onSubmit={submit}
          className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2"
        >
          <div className="min-w-0 sm:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold">الاسم الكامل</label>
            <input
              type="text"
              value={fullName}
              required
              onChange={(e) => setFullName(e.target.value)}
              className="block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-sm font-semibold">المعرف (اسم المستخدم)</label>
            <input
              type="text"
              value={username}
              required
              onChange={(e) => setUsername(e.target.value)}
              className="block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-sm font-semibold">تاريخ الولادة</label>
            <ArabicDateInput value={birthDate} onChange={setBirthDate} required />
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-sm font-semibold">رقم الهاتف</label>
            <input
              type="tel"
              value={phone}
              required
              onChange={(e) => {
                setPhone(e.target.value);
                if (phoneError) setPhoneError(null);
              }}
              className={`block w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 ${
                phoneError
                  ? "border-destructive focus:ring-destructive/30"
                  : "border-input focus:border-ring focus:ring-ring/30"
              }`}
            />
            {phoneError && (
              <p className="mt-1.5 text-xs font-medium text-destructive">{phoneError}</p>
            )}
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-sm font-semibold">كلمة العبور</label>
            <input
              type="text"
              value={birthDate}
              readOnly
              disabled
              placeholder="YYYY-MM-DD"
              className="block w-full cursor-not-allowed rounded-lg border border-input bg-muted px-3 py-2.5 text-sm text-muted-foreground"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              كلمة العبور تُطابق دوماً تاريخ الولادة.
            </p>
          </div>

          <div className="min-w-0 sm:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold">الصورة الشخصية (اختياري)</label>
            <div className="flex flex-wrap items-center gap-3">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt="preview"
                  className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-muted-foreground ring-2 ring-primary/20">
                  لا صورة
                </div>
              )}
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
                <span>اختر صورة</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setPhotoUrl(String(reader.result));
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => setPhotoUrl("")}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-secondary"
                >
                  إزالة
                </button>
              )}
            </div>
          </div>

          <div className="min-w-0 sm:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold">
              الدورات (اختياري)
            </label>
            <div className="grid max-h-40 grid-cols-[minmax(0,1fr)] gap-1.5 overflow-y-auto rounded-lg border border-input bg-background p-2 sm:grid-cols-2">
              {courses.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-secondary"
                >
                  <input
                    type="checkbox"
                    checked={courseIds.includes(c.id)}
                    onChange={() => toggleCourse(c.id)}
                    className="h-4 w-4"
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
            className="sm:col-span-2 mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {saving ? "جاري الحفظ..." : "إنشاء الحساب واعتماد الطلب"}
          </button>
        </form>
      </div>
    </div>
  );
}
