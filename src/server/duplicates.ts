import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { files, folders } from "@/db/schema";
import type { Session } from "@/lib/auth";
import { grantedOn } from "@/server/queries";

export type DuplicateCheckItem = { key: string; size: number; name: string; sha256?: string };

export type DuplicateMatch = {
  fileId: string;
  name: string;
  hasThumb: boolean;
  folder: { id: string; name: string };
  /** Same SHA-256; otherwise only the size and name match. */
  exact: boolean;
};

export type DuplicateResult = {
  /** Some readable file has this size; hashing the upload would settle it. */
  needsHash: boolean;
  matches: DuplicateMatch[];
};

const MAX_MATCHES = 3;

/**
 * Looks for files the user can already read that an upload would duplicate.
 * Hashes come from the browser, so this only ever drives a suggestion.
 *
 * Without `sha256`, an item matches on size + name. With it, an item matches
 * files with the same hash, and older unhashed files on size + name.
 */
export async function checkDuplicates(session: Session, items: DuplicateCheckItem[]) {
  const sizes = [...new Set(items.map((i) => i.size))];
  const rows = sizes.length
    ? await db
        .select({
          fileId: files.id,
          name: files.name,
          size: files.size,
          sha256: files.sha256,
          thumbKey: files.thumbKey,
          folderId: folders.id,
          folderName: folders.name,
        })
        .from(files)
        .innerJoin(folders, eq(folders.id, files.folderId))
        .where(
          and(
            inArray(files.size, sizes),
            eq(files.status, "ready"),
            isNull(files.deletedAt),
            isNull(folders.deletedAt),
            grantedOn(session, folders.path),
          ),
        )
        .orderBy(desc(files.createdAt))
    : [];

  const bySize = Map.groupBy(rows, (r) => r.size);
  const results: Record<string, DuplicateResult> = {};
  for (const item of items) {
    const candidates = bySize.get(item.size) ?? [];
    const name = item.name.toLowerCase();
    const sameName = (r: (typeof rows)[number]) => r.name.toLowerCase() === name;
    const exact = item.sha256 ? candidates.filter((r) => r.sha256 === item.sha256) : [];
    const likely = candidates.filter((r) => sameName(r) && (!item.sha256 || r.sha256 === null));
    results[item.key] = {
      needsHash: !item.sha256 && candidates.length > 0,
      matches: [
        ...exact.map((r) => ({ r, exact: true })),
        ...likely.map((r) => ({ r, exact: false })),
      ]
        .slice(0, MAX_MATCHES)
        .map(({ r, exact }) => ({
          fileId: r.fileId,
          name: r.name,
          hasThumb: r.thumbKey !== null,
          folder: { id: r.folderId, name: r.folderName },
          exact,
        })),
    };
  }
  return results;
}
