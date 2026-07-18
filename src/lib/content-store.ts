// Content store for competitions, gallery, and (local-only) competition announcements.
// Hydrated from the real backend when VITE_API_URL is set; announcements are still
// stored locally because they have no backend model yet.

import { useSyncExternalStore, useEffect } from "react";
import { HAS_API, apiFetch } from "./api";

export type Competition = {
  id: string;
  name: string;
  level: "محلية" | "جهوية" | "وطنية" | string;
  year: number;
  participants: number;
  passed: number;
  passRate?: number;
  topThree: { rank: number; name: string; category: string }[];
};

export type GalleryEntry = {
  id: string;
  title: string;
  date: string;
  url: string;
  imageUrl?: string;
  imageSeed?: number;
};

export type CompetitionAnnouncement = {
  id: string;
  title: string;
  level: "محلية" | "جهوية" | "وطنية";
  date: string;
  deadline?: string;
  location: string;
  description: string;
  imageUrl?: string;
};

type State = {
  competitions: Competition[];
  gallery: GalleryEntry[];
  announcements: CompetitionAnnouncement[];
};

const KEY = "sh_content_store_v2";
const EMPTY: State = { competitions: [], gallery: [], announcements: [] };

function loadCache(): State {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      competitions: parsed.competitions ?? [],
      gallery: parsed.gallery ?? [],
      announcements: parsed.announcements ?? [],
    };
  } catch {
    return EMPTY;
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

export function useContentStore() {
  useEffect(() => { void ensureContentLoaded(); }, []);
  return useSyncExternalStore(subscribe, () => state, () => state);
}

let loadedOnce = false;
let inflight: Promise<void> | null = null;

export async function ensureContentLoaded(force = false): Promise<void> {
  if (!HAS_API) return;
  if (!force && loadedOnce) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const [comps, gal] = await Promise.all([
        apiFetch<any[]>("/api/public/competitions").catch(() => null),
        apiFetch<any[]>("/api/public/gallery").catch(() => null),
      ]);
      if (comps && gal) {
        setState({
          ...state,
          competitions: comps.map((c) => ({
            id: c.id,
            name: c.name,
            level: c.level,
            year: c.year,
            participants: c.participants,
            passed: c.passed,
            passRate: c.passRate,
            topThree: Array.isArray(c.topThree) ? c.topThree : [],
          })),
          gallery: gal.map((g) => ({
            id: g.id,
            title: g.title,
            date: g.date,
            url: g.url,
            imageUrl: g.url,
          })),
        });
        loadedOnce = true;
      }
    } catch (err) {
      console.warn("content-store: hydration failed", err);
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

async function toastError(msg: string) {
  const { toast } = await import("sonner");
  toast.error(msg);
}

export const competitionsActions = {
  async add(c: Omit<Competition, "id">) {
    if (!HAS_API) {
      setState({ ...state, competitions: [{ ...c, id: crypto.randomUUID() }, ...state.competitions] });
      return;
    }
    try {
      await apiFetch("/api/admin/competitions", {
        method: "POST",
        body: JSON.stringify({
          name: c.name, level: c.level, year: c.year,
          participants: c.participants, passed: c.passed,
          topThree: c.topThree ?? [],
        }),
      });
    } catch (e) { await toastError(`تعذّر إضافة المسابقة: ${(e as Error).message}`); }
    await ensureContentLoaded(true);
  },
  async update(id: string, patch: Partial<Omit<Competition, "id">>) {
    if (!HAS_API) {
      setState({ ...state, competitions: state.competitions.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
      return;
    }
    try {
      const body: Record<string, unknown> = {};
      for (const k of ["name", "level", "year", "participants", "passed", "topThree"] as const) {
        if (patch[k] !== undefined) body[k] = patch[k];
      }
      await apiFetch(`/api/admin/competitions/${id}`, { method: "PUT", body: JSON.stringify(body) });
    } catch (e) { await toastError(`تعذّر تحديث المسابقة: ${(e as Error).message}`); }
    await ensureContentLoaded(true);
  },
  async remove(id: string) {
    if (!HAS_API) {
      setState({ ...state, competitions: state.competitions.filter((c) => c.id !== id) });
      return;
    }
    try {
      await apiFetch(`/api/admin/competitions/${id}`, { method: "DELETE" });
    } catch (e) { await toastError(`تعذّر حذف المسابقة: ${(e as Error).message}`); }
    await ensureContentLoaded(true);
  },
};

export const galleryActions = {
  async add(g: Omit<GalleryEntry, "id">) {
    const url = g.url || g.imageUrl || "";
    if (!HAS_API) {
      setState({ ...state, gallery: [{ ...g, url, id: crypto.randomUUID() }, ...state.gallery] });
      return;
    }
    try {
      await apiFetch("/api/admin/gallery", {
        method: "POST",
        body: JSON.stringify({ title: g.title, date: g.date, url }),
      });
    } catch (e) { await toastError(`تعذّر إضافة الصورة: ${(e as Error).message}`); }
    await ensureContentLoaded(true);
  },
  async update(id: string, patch: Partial<Omit<GalleryEntry, "id">>) {
    if (!HAS_API) {
      setState({ ...state, gallery: state.gallery.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
      return;
    }
    try {
      const body: Record<string, unknown> = {};
      if (patch.title !== undefined) body.title = patch.title;
      if (patch.date !== undefined) body.date = patch.date;
      if (patch.url !== undefined || patch.imageUrl !== undefined) body.url = patch.url ?? patch.imageUrl;
      await apiFetch(`/api/admin/gallery/${id}`, { method: "PUT", body: JSON.stringify(body) });
    } catch (e) { await toastError(`تعذّر تحديث الصورة: ${(e as Error).message}`); }
    await ensureContentLoaded(true);
  },
  async remove(id: string) {
    if (!HAS_API) {
      setState({ ...state, gallery: state.gallery.filter((g) => g.id !== id) });
      return;
    }
    try {
      await apiFetch(`/api/admin/gallery/${id}`, { method: "DELETE" });
    } catch (e) { await toastError(`تعذّر حذف الصورة: ${(e as Error).message}`); }
    await ensureContentLoaded(true);
  },
};

// Announcements are local-only (no backend model yet).
export const announcementsActions = {
  add(a: Omit<CompetitionAnnouncement, "id">) {
    setState({ ...state, announcements: [{ ...a, id: crypto.randomUUID() }, ...state.announcements] });
  },
  update(id: string, patch: Partial<Omit<CompetitionAnnouncement, "id">>) {
    setState({ ...state, announcements: state.announcements.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  },
  remove(id: string) {
    setState({ ...state, announcements: state.announcements.filter((a) => a.id !== id) });
  },
};
