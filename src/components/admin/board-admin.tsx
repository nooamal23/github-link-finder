import { useState } from "react";
import { toast } from "sonner";
import { noticeToast } from "@/lib/notice-toast";
import { UserPlus, X, Pencil, Trash2 } from "lucide-react";
import { formatArabicDate } from "@/lib/utils";
import { ArabicDateInput } from "@/components/ui/arabic-date-input";
import { confirmToast } from "@/lib/confirm-toast";
import { isValidTunisianPhone, TUNISIA_PHONE_MESSAGE } from "@/lib/phone";



import {
  usePeopleStore,
  boardActions,
  POSITION_LABEL,
  type BoardMember,
  type BoardPosition,
} from "@/lib/people-store";

type FormState = {
  fullName: string;
  birthDate: string;
  phone: string;
  position: BoardPosition;
  photoUrl: string;
};

const EMPTY_FORM: FormState = {
  fullName: "",
  birthDate: "1970-01-01",
  phone: "",
  position: "president",
  photoUrl: "",
};

export function BoardAdmin() {
  const { boardMembers } = usePeopleStore();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BoardMember | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [phoneError, setPhoneError] = useState<string | null>(null);


  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(m: BoardMember) {
    setEditing(m);
    setForm({
      fullName: m.fullName,
      birthDate: m.birthDate,
      phone: m.phone,
      position: m.position,
      photoUrl: m.photoUrl || "",
    });
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.phone && !isValidTunisianPhone(form.phone)) {
      setPhoneError(TUNISIA_PHONE_MESSAGE);
      noticeToast({
        variant: "warning",
        title: "رقم هاتف غير صحيح",
        message: TUNISIA_PHONE_MESSAGE,
      });
      return;
    }
    setPhoneError(null);
    const payload = {
      fullName: form.fullName,
      birthDate: form.birthDate,
      phone: form.phone,
      position: form.position,
      photoUrl: form.photoUrl || undefined,
    };
    if (editing) {
      boardActions.update(editing.id, payload);
      toast.success(`تم حفظ التغييرات على ${payload.fullName} بنجاح`);
    } else {
      boardActions.add(payload);
      toast.success(`تمت إضافة ${payload.fullName} بنجاح`);
    }
    setOpen(false);
  }


  function remove(m: BoardMember) {
    confirmToast({
      message: `حذف ${m.fullName}؟`,
      description: "لا يمكن التراجع عن هذا الإجراء.",
      onConfirm: () => {
        boardActions.remove(m.id);
        toast.success(`تم حذف ${m.fullName}`);
      },
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">الهيئة التسييرية للفرع</h1>
          <p className="mt-1 text-sm text-muted-foreground">إدارة أعضاء الهيئة التسييرية للفرع وصفاتهم.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" /> إضافة عضو
        </button>
      </header>

      {boardMembers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          لا يوجد أعضاء حاليا. اضغط "إضافة عضو" للبدء.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {boardMembers.map((m) => (
            <article key={m.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-start gap-4">
                <Avatar name={m.fullName} url={m.photoUrl} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-bold text-foreground">{m.fullName}</h3>
                      <div className="mt-0.5">
                        <span className="rounded-full bg-gold-faint px-2 py-0.5 text-[11px] font-semibold text-gold">
                          {POSITION_LABEL[m.position]}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openEdit(m)}
                        className="rounded-md border border-border bg-background p-1.5 text-foreground hover:bg-secondary"
                        title="تعديل"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(m)}
                        className="rounded-md border border-destructive/30 bg-background p-1.5 text-destructive hover:bg-destructive/10"
                        title="حذف"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <Row label="تاريخ الولادة" value={formatArabicDate(m.birthDate)} />
                    <Row label="الهاتف" value={m.phone || "—"} />
                  </dl>

                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-3 py-4 sm:items-center sm:px-4 sm:py-8">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-elevated sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="min-w-0 truncate font-display text-lg font-bold">
                {editing ? "تعديل عضو" : "إضافة عضو جديد"}
              </h2>
              <button onClick={() => setOpen(false)} className="shrink-0 rounded-md p-1 hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submit} className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
              <Field className="sm:col-span-2" label="الاسم الكامل" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} required />
              <Field label="تاريخ الولادة" type="date" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} required />
              <div className="min-w-0">
                <label className="mb-1.5 block text-sm font-semibold">رقم الهاتف</label>
                <input
                  type="tel"
                  value={form.phone}
                  placeholder="مثال: 20 123 456"
                  onChange={(e) => { setForm({ ...form, phone: e.target.value }); if (phoneError) setPhoneError(null); }}
                  className={`block w-full max-w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 ${phoneError ? "border-destructive focus:ring-destructive/30" : "border-input focus:border-ring focus:ring-ring/30"}`}
                />
                {phoneError && <p className="mt-1.5 text-xs font-medium text-destructive">{phoneError}</p>}
              </div>

              <div className="min-w-0 sm:col-span-2">
                <label className="mb-1.5 block text-sm font-semibold">الصفة داخل الهيئة</label>
                <select
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value as BoardPosition })}
                  className="block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  {(Object.keys(POSITION_LABEL) as BoardPosition[]).map((k) => (
                    <option key={k} value={k}>{POSITION_LABEL[k]}</option>
                  ))}
                </select>
              </div>
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
