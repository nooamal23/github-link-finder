import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, CheckCircle2 } from "lucide-react";
import { PageHero } from "./courses";
import { isValidTunisianPhone, TUNISIA_PHONE_MESSAGE } from "@/lib/phone";
import { noticeToast } from "@/lib/notice-toast";
import {
  submitRegistrationRequest,
  type AgeCategory,
} from "@/lib/registration-requests";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "طلب تسجيل — فرع سيدي الهاني" },
      {
        name: "description",
        content:
          "أرسل طلب تسجيل مبدئي في دورات فرع سيدي الهاني، وستتواصل معك الإدارة قريبا.",
      },
      { property: "og:title", content: "طلب تسجيل — فرع سيدي الهاني" },
      {
        property: "og:description",
        content:
          "أرسل طلب تسجيل مبدئي في دورات فرع سيدي الهاني، وستتواصل معك الإدارة قريبا.",
      },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [ageCategory, setAgeCategory] = useState<AgeCategory | "">("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const nameValid = fullName.trim().length >= 2;
  const phoneValid = isValidTunisianPhone(phone);
  const canSubmit = nameValid && phoneValid && ageCategory !== "" && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneValid) {
      setPhoneError(TUNISIA_PHONE_MESSAGE);
      return;
    }
    if (!nameValid || ageCategory === "") return;
    setSubmitting(true);
    try {
      await submitRegistrationRequest({
        fullName: fullName.trim(),
        ageCategory: ageCategory as AgeCategory,
        phone,
      });
      setDone(true);
      setFullName("");
      setAgeCategory("");
      setPhone("");
    } catch (err) {
      noticeToast({
        variant: "error",
        title: "تعذّر إرسال الطلب",
        message: (err as Error).message || "حدث خطأ غير متوقع، يرجى المحاولة مجدداً.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHero
        title="طلب تسجيل جديد"
        desc="أرسل طلبك مبدئياً عبر هذا النموذج، وستتواصل معك الإدارة قريباً لاستكمال التسجيل حضورياً بمقر الفرع."
      />

      <section className="container-page py-12">
        <div className="mx-auto max-w-xl">
          {done ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center shadow-soft">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-foreground">
                تم إرسال طلبك بنجاح
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                ستتواصل معك الإدارة قريباً على الرقم الذي أدخلته لاستكمال التسجيل.
              </p>
              <button
                onClick={() => setDone(false)}
                className="mt-5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                إرسال طلب آخر
              </button>
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8"
            >
              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  minLength={2}
                  placeholder="مثال: أحمد بن سالم"
                  className="block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  الفئة العمرية
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["child", "adult"] as const).map((val) => {
                    const label = val === "child" ? "طفل" : "كبير";
                    const active = ageCategory === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAgeCategory(val)}
                        className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-soft"
                            : "border-border bg-background text-foreground hover:bg-secondary"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  value={phone}
                  required
                  placeholder="مثال: 20 123 456"
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
                  <p className="mt-1.5 text-xs font-medium text-destructive">
                    {phoneError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4" />
                {submitting ? "جاري الإرسال..." : "إرسال طلب التسجيل"}
              </button>

              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                التسجيل النهائي يتم حضورياً بمقر الفرع بعد التواصل معك من قبل الإدارة.
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
