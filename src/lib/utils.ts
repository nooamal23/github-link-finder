import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AR_DATE = new Intl.DateTimeFormat("ar-TN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Format an ISO date (YYYY-MM-DD) to Arabic, e.g. "5 سبتمبر 2025". */
export function formatArabicDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return AR_DATE.format(d);
}

/** Format an ISO date range to Arabic, e.g. "5 سبتمبر 2025 → 10 أكتوبر 2025". */
export function formatArabicDateRange(startIso: string, endIso: string): string {
  if (!startIso || !endIso) return "—";
  return `${formatArabicDate(startIso)} → ${formatArabicDate(endIso)}`;
}

