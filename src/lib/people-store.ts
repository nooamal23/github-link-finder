// Store for admin members (instructors + students), courses, and board members.
// Hydrated from the real backend when VITE_API_URL is set; falls back to an
// empty in-memory + localStorage store when running as a static demo.

import { useSyncExternalStore, useEffect } from "react";
import { HAS_API, apiFetch } from "./api";

export type Role = "instructor" | "student";

export type CourseLevel = "beginner" | "intermediate" | "advanced" | "all";
export type CourseType = "quran" | "fiqh" | "training" | "summer";
export type CourseAudience = "children" | "women" | "men";

// Day of the week: JS Date.getDay() convention. 0=الأحد ... 6=السبت
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const LEVEL_LABEL: Record<CourseLevel, string> = {
  beginner: "مبتدئ",
  intermediate: "متوسط",
  advanced: "متقدم",
  all: "كل المستويات",
};

export const TYPE_LABEL: Record<CourseType, string> = {
  quran: "تحفيظ وتجويد",
  fiqh: "فقه وشريعة",
  training: "تكوين معلمين",
  summer: "دورة صيفية",
};

export const AUDIENCE_LABEL: Record<CourseAudience, string> = {
  children: "أطفال",
  women: "نساء",
  men: "رجال",
};

export const ALLOWED_AUDIENCE: Record<CourseType, CourseAudience[]> = {
  quran: ["children", "women", "men"],
  fiqh: ["women", "men"],
  training: ["women", "men"],
  summer: ["children", "women", "men"],
};

export const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 6, label: "السبت" },
  { value: 0, label: "الأحد" },
  { value: 1, label: "الاثنين" },
  { value: 2, label: "الثلاثاء" },
  { value: 3, label: "الأربعاء" },
  { value: 4, label: "الخميس" },
  { value: 5, label: "الجمعة" },
];

export type CourseLite = {
  id: string;
  title: string;
  endDate: string; // ISO yyyy-mm-dd
  startDate?: string;
  level?: CourseLevel;
  type?: CourseType;
  audience?: CourseAudience;
  days?: Weekday[];
  timeFrom?: string;
  timeTo?: string;
  instructorId?: string;
  capacity?: number;
};

export type BoardPosition = "president" | "vice_president" | "secretary" | "treasurer" | "member";

export const POSITION_LABEL: Record<BoardPosition, string> = {
  president: "رئيس",
  vice_president: "نائب الرئيس",
  secretary: "كاتب عام",
  treasurer: "أمين مال",
  member: "عضو",
};

export type Person = {
  id: string;
  role: Role;
  fullName: string;
  username: string;
  password: string;
  birthDate: string;
  phone: string;
  photoUrl?: string;
  courseIds: string[];
};

export type BoardMember = {
  id: string;
  fullName: string;
  birthDate: string;
  phone: string;
  position: BoardPosition;
  photoUrl?: string;
  orderIndex?: number;
};

type State = {
  courses: CourseLite[];
  people: Person[];
  boardMembers: BoardMember[];
};

const KEY = "sh_people_store_v6";

const EMPTY_STATE: State = { courses: [], people: [], boardMembers: [] };

// ---- Category mapping (backend enum → frontend audience/type heuristic) ----
type BackendCategory = "children" | "women" | "men" | "training" | "summer";

function categoryToAudience(cat: BackendCategory): CourseAudience {
  if (cat === "training") return "men";
  if (cat === "summer") return "children";
  return cat;
}

function categoryToType(cat: BackendCategory): CourseType {
  if (cat === "training") return "training";
  if (cat === "summer") return "summer";
  return "quran";
}

function audienceTypeToCategory(audience?: CourseAudience, type?: CourseType): BackendCategory {
  if (type === "summer") return "summer";
  if (type === "training") return "training";
  return audience ?? "children";
}

// ---- Persistence + subscribe ----
function loadCache(): State {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      courses: parsed.courses ?? [],
      people: parsed.people ?? [],
      boardMembers: parsed.boardMembers ?? [],
    };
  } catch {
    return EMPTY_STATE;
  }
}

let state: State = loadCache();
const listeners = new Set<() => void>();

function setState(next: State) {
  state = next;
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function usePeopleStore() {
  useEffect(() => { void ensurePeopleLoaded(); }, []);
  return useSyncExternalStore(subscribe, () => state, () => state);
}

// ---- API hydration ----
let loadedOnce = false;
let inflight: Promise<void> | null = null;

export async function ensurePeopleLoaded(force = false): Promise<void> {
  if (!HAS_API) return;
  if (!force && loadedOnce) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const [users, courses, board] = await Promise.all([
        apiFetch<any[]>("/api/admin/users").catch(() => null),
        apiFetch<any[]>("/api/admin/courses").catch(() => null),
        apiFetch<any[]>("/api/admin/board").catch(() => null),
      ]);
      // If user is not admin, /admin/* returns 403 — leave cache in place.
      if (!users || !courses || !board) return;

      const people: Person[] = users
        .filter((u) => u.role === "instructor" || u.role === "student")
        .map((u) => ({
          id: u.id,
          role: u.role,
          fullName: u.fullName,
          username: u.username,
          password: "", // never returned by the API
          birthDate: u.birthDate ?? "",
          phone: u.phone ?? "",
          photoUrl: u.photoUrl ?? undefined,
          courseIds: u.courseIds ?? [],
        }));

      const localCourses: CourseLite[] = courses.map((c) => ({
        id: c.id,
        title: c.title,
        startDate: c.startDate ?? undefined,
        endDate: c.endDate ?? c.startDate ?? "2099-12-31",
        level: undefined,
        type: categoryToType(c.category),
        audience: categoryToAudience(c.category),
        days: undefined,
        timeFrom: undefined,
        timeTo: undefined,
        instructorId: c.instructorId ?? undefined,
        capacity: c.capacity,
      }));

      const boardMembers: BoardMember[] = board.map((b) => ({
        id: b.id,
        fullName: b.fullName,
        birthDate: b.birthDate ?? "",
        phone: b.phone ?? "",
        position: b.position,
        photoUrl: b.photoUrl ?? undefined,
        orderIndex: b.orderIndex,
      }));

      setState({ courses: localCourses, people, boardMembers });
      loadedOnce = true;
    } catch (err) {
      console.warn("people-store: hydration failed", err);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// ---- Public helpers ----
export function isCourseActive(c: CourseLite, today = new Date()): boolean {
  return new Date(c.endDate) >= new Date(today.toDateString());
}

export function splitCourses(person: Person, courses: CourseLite[]) {
  const map = new Map(courses.map((c) => [c.id, c]));
  const active: CourseLite[] = [];
  const archived: CourseLite[] = [];
  for (const id of person.courseIds) {
    const c = map.get(id);
    if (!c) continue;
    (isCourseActive(c) ? active : archived).push(c);
  }
  return { active, archived };
}

export function countSessions(startDate?: string, endDate?: string, days?: Weekday[]): number {
  if (!startDate || !endDate || !days || days.length === 0) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
  const set = new Set(days);
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (set.has(cur.getDay() as Weekday)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function findPersonByCredentials(username: string, password: string): Person | null {
  const u = username.trim().toLowerCase();
  return (
    state.people.find(
      (p) => p.username.trim().toLowerCase() === u && p.password === password,
    ) ?? null
  );
}

export function isUsernameTaken(username: string, excludeId?: string): boolean {
  const u = username.trim().toLowerCase();
  if (!u) return false;
  return state.people.some(
    (p) => p.id !== excludeId && p.username.trim().toLowerCase() === u,
  );
}

// ---- Actions ----
async function toastError(msg: string) {
  const { toast } = await import("sonner");
  toast.error(msg);
}

export const peopleActions = {
  async add(person: Omit<Person, "id">) {
    if (!HAS_API) {
      setState({ ...state, people: [...state.people, { ...person, id: crypto.randomUUID() }] });
      return;
    }
    try {
      await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          username: person.username,
          password: person.password || crypto.randomUUID(),
          fullName: person.fullName,
          role: person.role,
          phone: person.phone || undefined,
          birthDate: person.birthDate || undefined,
          photoUrl: person.photoUrl || undefined,
        }),
      });
    } catch (e) {
      await toastError(`تعذّر إنشاء الحساب: ${(e as Error).message}`);
      throw e;
    } finally {
      await ensurePeopleLoaded(true);
    }
  },
  async update(id: string, patch: Partial<Omit<Person, "id" | "role">>) {
    if (!HAS_API) {
      setState({ ...state, people: state.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
      return;
    }
    try {
      const body: Record<string, unknown> = {};
      if (patch.fullName !== undefined) body.fullName = patch.fullName;
      if (patch.phone !== undefined) body.phone = patch.phone;
      if (patch.username !== undefined) body.username = patch.username;
      if (patch.birthDate !== undefined) body.birthDate = patch.birthDate;
      if (patch.photoUrl !== undefined) body.photoUrl = patch.photoUrl;
      if (Object.keys(body).length > 0) {
        await apiFetch(`/api/admin/users/${id}`, { method: "PUT", body: JSON.stringify(body) });
      }
      if (patch.password) {
        await apiFetch(`/api/admin/users/${id}/reset-password`, {
          method: "POST",
          body: JSON.stringify({ password: patch.password }),
        });
      }
    } catch (e) {
      await toastError(`تعذّر تحديث الحساب: ${(e as Error).message}`);
    }
    await ensurePeopleLoaded(true);
  },
  async remove(id: string) {
    if (!HAS_API) {
      setState({ ...state, people: state.people.filter((p) => p.id !== id) });
      return;
    }
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
    } catch (e) {
      await toastError(`تعذّر حذف الحساب: ${(e as Error).message}`);
    }
    await ensurePeopleLoaded(true);
  },
  async addCourse(c: Omit<CourseLite, "id">) {
    if (!HAS_API) {
      setState({ ...state, courses: [...state.courses, { ...c, id: crypto.randomUUID() }] });
      return;
    }
    try {
      await apiFetch("/api/admin/courses", {
        method: "POST",
        body: JSON.stringify({
          title: c.title,
          category: audienceTypeToCategory(c.audience, c.type),
          level: c.level ?? "all",
          schedule: `${c.timeFrom ?? ""} - ${c.timeTo ?? ""}`.trim() || "—",
          capacity: c.capacity ?? 25,
          instructorId: c.instructorId ?? null,
          startDate: c.startDate ?? null,
          endDate: c.endDate ?? null,
          isPublished: true,
        }),
      });
    } catch (e) {
      await toastError(`تعذّر إنشاء الدورة: ${(e as Error).message}`);
    }
    await ensurePeopleLoaded(true);
  },
  async updateCourse(id: string, patch: Partial<Omit<CourseLite, "id">>) {
    if (!HAS_API) {
      setState({ ...state, courses: state.courses.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
      return;
    }
    try {
      const body: Record<string, unknown> = {};
      if (patch.title !== undefined) body.title = patch.title;
      if (patch.audience !== undefined || patch.type !== undefined) {
        const existing = state.courses.find((c) => c.id === id);
        body.category = audienceTypeToCategory(
          patch.audience ?? existing?.audience,
          patch.type ?? existing?.type,
        );
      }
      if (patch.level !== undefined) body.level = patch.level;
      if (patch.capacity !== undefined) body.capacity = patch.capacity;
      if (patch.instructorId !== undefined) body.instructorId = patch.instructorId || null;
      if (patch.startDate !== undefined) body.startDate = patch.startDate || null;
      if (patch.endDate !== undefined) body.endDate = patch.endDate || null;
      if (patch.timeFrom !== undefined || patch.timeTo !== undefined) {
        const existing = state.courses.find((c) => c.id === id);
        const from = patch.timeFrom ?? existing?.timeFrom ?? "";
        const to = patch.timeTo ?? existing?.timeTo ?? "";
        body.schedule = `${from} - ${to}`.trim() || "—";
      }
      await apiFetch(`/api/admin/courses/${id}`, { method: "PUT", body: JSON.stringify(body) });
    } catch (e) {
      await toastError(`تعذّر تحديث الدورة: ${(e as Error).message}`);
    }
    await ensurePeopleLoaded(true);
  },
  async removeCourse(id: string) {
    if (!HAS_API) {
      setState({
        ...state,
        courses: state.courses.filter((c) => c.id !== id),
        people: state.people.map((p) => ({ ...p, courseIds: p.courseIds.filter((cid) => cid !== id) })),
      });
      return;
    }
    try {
      await apiFetch(`/api/admin/courses/${id}`, { method: "DELETE" });
    } catch (e) {
      await toastError(`تعذّر حذف الدورة: ${(e as Error).message}`);
    }
    await ensurePeopleLoaded(true);
  },
  async unenroll(courseId: string, studentId: string) {
    if (!HAS_API) {
      setState({
        ...state,
        people: state.people.map((p) =>
          p.id === studentId ? { ...p, courseIds: p.courseIds.filter((c) => c !== courseId) } : p,
        ),
      });
      return;
    }
    try {
      await apiFetch(`/api/admin/courses/${courseId}/unenroll`, {
        method: "POST",
        body: JSON.stringify({ studentId }),
      });
    } catch (e) {
      await toastError(`تعذّر إلغاء التسجيل: ${(e as Error).message}`);
    }
    await ensurePeopleLoaded(true);
  },
  async enroll(courseId: string, studentId: string) {
    if (!HAS_API) {
      setState({
        ...state,
        people: state.people.map((p) =>
          p.id === studentId && !p.courseIds.includes(courseId)
            ? { ...p, courseIds: [...p.courseIds, courseId] }
            : p,
        ),
      });
      return;
    }
    try {
      await apiFetch(`/api/admin/courses/${courseId}/enroll`, {
        method: "POST",
        body: JSON.stringify({ studentId }),
      });
    } catch (e) {
      await toastError(`تعذّر التسجيل: ${(e as Error).message}`);
    }
    await ensurePeopleLoaded(true);
  },
};

export const boardActions = {
  async add(m: Omit<BoardMember, "id">) {
    if (!HAS_API) {
      setState({ ...state, boardMembers: [...state.boardMembers, { ...m, id: crypto.randomUUID() }] });
      return;
    }
    try {
      await apiFetch("/api/admin/board", {
        method: "POST",
        body: JSON.stringify({
          fullName: m.fullName,
          birthDate: m.birthDate || null,
          phone: m.phone || null,
          position: m.position,
          photoUrl: m.photoUrl || null,
          orderIndex: m.orderIndex ?? 0,
        }),
      });
    } catch (e) {
      await toastError(`تعذّر إضافة العضو: ${(e as Error).message}`);
    }
    await ensurePeopleLoaded(true);
  },
  async update(id: string, patch: Partial<Omit<BoardMember, "id">>) {
    if (!HAS_API) {
      setState({ ...state, boardMembers: state.boardMembers.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
      return;
    }
    try {
      const body: Record<string, unknown> = {};
      if (patch.fullName !== undefined) body.fullName = patch.fullName;
      if (patch.birthDate !== undefined) body.birthDate = patch.birthDate || null;
      if (patch.phone !== undefined) body.phone = patch.phone || null;
      if (patch.position !== undefined) body.position = patch.position;
      if (patch.photoUrl !== undefined) body.photoUrl = patch.photoUrl || null;
      if (patch.orderIndex !== undefined) body.orderIndex = patch.orderIndex;
      await apiFetch(`/api/admin/board/${id}`, { method: "PUT", body: JSON.stringify(body) });
    } catch (e) {
      await toastError(`تعذّر تحديث العضو: ${(e as Error).message}`);
    }
    await ensurePeopleLoaded(true);
  },
  async remove(id: string) {
    if (!HAS_API) {
      setState({ ...state, boardMembers: state.boardMembers.filter((m) => m.id !== id) });
      return;
    }
    try {
      await apiFetch(`/api/admin/board/${id}`, { method: "DELETE" });
    } catch (e) {
      await toastError(`تعذّر حذف العضو: ${(e as Error).message}`);
    }
    await ensurePeopleLoaded(true);
  },
};
