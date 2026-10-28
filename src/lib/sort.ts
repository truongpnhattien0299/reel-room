import { useSyncExternalStore } from "react";

export const FILE_SORTS = ["newest", "oldest", "name-asc", "name-desc", "size", "duration"] as const;
export type FileSort = (typeof FILE_SORTS)[number];

export const FOLDER_SORTS = ["name", "recent"] as const;
export type FolderSort = (typeof FOLDER_SORTS)[number];

// Natural order ("IMG_2" before "IMG_10"), ignoring case and accents.
const collator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

type SortableFile = { id: string; name: string; size: number; durationMs: number | null; createdAt: Date };

// Ties fall back to newest first, then id, so the order never shifts between renders.
const byNewest = (a: SortableFile, b: SortableFile) =>
  b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

const FILE_COMPARE: Record<FileSort, (a: SortableFile, b: SortableFile) => number> = {
  newest: byNewest,
  oldest: (a, b) => byNewest(b, a),
  "name-asc": (a, b) => collator.compare(a.name, b.name) || byNewest(a, b),
  "name-desc": (a, b) => collator.compare(b.name, a.name) || byNewest(a, b),
  size: (a, b) => b.size - a.size || byNewest(a, b),
  // Files without a duration (images, unprobed uploads) go last.
  duration: (a, b) => (b.durationMs ?? -1) - (a.durationMs ?? -1) || byNewest(a, b),
};

export function sortFiles<T extends SortableFile>(files: T[], sort: FileSort): T[] {
  return [...files].sort(FILE_COMPARE[sort]);
}

type SortableFolder = { id: string; name: string; lastUpload: Date | null; updatedAt?: Date | null };

const byName = (a: SortableFolder, b: SortableFolder) =>
  collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const time = (d: Date | null | undefined) => d?.getTime() ?? 0;

const FOLDER_COMPARE: Record<FolderSort, (a: SortableFolder, b: SortableFolder) => number> = {
  name: byName,
  recent: (a, b) =>
    time(b.lastUpload) - time(a.lastUpload) || time(b.updatedAt) - time(a.updatedAt) || byName(a, b),
};

export function sortFolders<T extends SortableFolder>(folders: T[], sort: FolderSort): T[] {
  return [...folders].sort(FOLDER_COMPARE[sort]);
}

// ---------------------------------------------------------------------------
// Remembered choice, shared by every folder
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>();
// Used when localStorage is blocked, so a choice still lasts until reload.
const memory = new Map<string, string>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

/**
 * A sort choice kept in localStorage under `key`. The server render and the
 * first client render use `fallback`, so hydration matches; the saved choice
 * applies right after.
 */
export function useStoredSort<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const stored = useSyncExternalStore(subscribe, () => read(key), () => null);
  const value = allowed.includes(stored as T) ? (stored as T) : fallback;
  const set = (next: T) => {
    memory.set(key, next);
    try {
      localStorage.setItem(key, next);
    } catch {
      // Private mode or blocked storage: `memory` keeps it.
    }
    for (const l of listeners) l();
  };
  return [value, set] as const;
}
