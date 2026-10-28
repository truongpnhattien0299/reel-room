import "server-only";
import { and, asc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { db } from "@/db";
import { files, folders, shareLinkFiles, type Folder, type ShareLink } from "@/db/schema";
import type { Session } from "@/lib/auth";
import { presignRead } from "@/lib/r2";
import { ForbiddenError, NotFoundError, requireFolderRole } from "@/server/permissions";

/** One zip request may hold at most this many files / bytes. */
export const MAX_ZIP_FILES = 5000;
export const MAX_ZIP_BYTES = 50 * 1024 ** 3;

export type DownloadEntry = { path: string; size: number; r2Key: string; mimeType: string };
export type DownloadList = { zipName: string; entries: DownloadEntry[] };

const fileCols = { name: files.name, size: files.size, r2Key: files.r2Key, mimeType: files.mimeType };
const live = and(eq(files.status, "ready"), isNull(files.deletedAt), isNull(folders.deletedAt));
const inSubtree = (path: string) => or(eq(folders.path, path), like(folders.path, `${path}/%`));

/** A name that is safe as one path segment in a zip on any OS. */
export function safeSegment(name: string) {
  const s = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
  return s === "" || s === "." || s === ".." ? "_" : s;
}

/** Adds " (2)", " (3)"… before the extension to paths already taken (case-insensitive). */
export function dedupePaths<T extends { path: string }>(entries: T[]): T[] {
  const taken = new Set<string>();
  return entries.map((e) => {
    let path = e.path;
    const dot = path.lastIndexOf(".");
    const slash = path.lastIndexOf("/");
    const [stem, ext] = dot > slash + 1 ? [path.slice(0, dot), path.slice(dot)] : [path, ""];
    for (let n = 2; taken.has(path.toLowerCase()); n++) path = `${stem} (${n})${ext}`;
    taken.add(path.toLowerCase());
    return { ...e, path };
  });
}

function checkLimits(entries: DownloadEntry[]) {
  if (entries.length === 0) throw new NotFoundError("Không có file nào để tải");
  if (entries.length > MAX_ZIP_FILES) {
    throw new ForbiddenError(`Tối đa ${MAX_ZIP_FILES} file mỗi lần tải. Hãy tải từng folder con.`);
  }
  if (entries.reduce((sum, e) => sum + e.size, 0) > MAX_ZIP_BYTES) {
    throw new ForbiddenError("Tối đa 50 GB mỗi lần tải. Hãy tải từng folder con.");
  }
  return entries;
}

/** Every live file under `root`, at paths made of folder names below it. */
async function subtreeEntries(root: Pick<Folder, "id" | "path">) {
  const rows = await db
    .select({ ...fileCols, folderPath: folders.path })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(and(live, inSubtree(root.path)));
  const folderIds = [...new Set(rows.flatMap((r) => r.folderPath.split("/")))];
  const names = new Map(
    (folderIds.length
      ? await db.select({ id: folders.id, name: folders.name }).from(folders).where(inArray(folders.id, folderIds))
      : []
    ).map((f) => [f.id, safeSegment(f.name)]),
  );
  const entries = rows.map(({ folderPath, name, ...f }) => {
    const ids = folderPath.split("/");
    const dirs = ids.slice(ids.indexOf(root.id) + 1).map((id) => names.get(id));
    return { ...f, path: [...dirs, safeSegment(name)].join("/") };
  });
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return checkLimits(dedupePaths(entries));
}

const flatEntries = (rows: (Omit<DownloadEntry, "path"> & { name: string })[]) =>
  checkLimits(
    dedupePaths(
      rows
        .map(({ name, ...f }) => ({ ...f, path: safeSegment(name) }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    ),
  );

/** A whole folder (viewer and up), subfolders included. */
export async function listFolderDownload(session: Session, folderId: string): Promise<DownloadList> {
  const { folder } = await requireFolderRole(session, folderId, "viewer");
  return { zipName: `${safeSegment(folder.name)}.zip`, entries: await subtreeEntries(folder) };
}

/** Picked files; the user must be able to view every one of them. */
export async function listFilesDownload(session: Session, fileIds: string[]): Promise<DownloadList> {
  const rows = await db
    .select({ ...fileCols, folderId: files.folderId, folderName: folders.name })
    .from(files)
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(and(live, inArray(files.id, fileIds)));
  if (rows.length !== new Set(fileIds).size) throw new NotFoundError("File không tồn tại");
  for (const folderId of new Set(rows.map((r) => r.folderId))) {
    await requireFolderRole(session, folderId, "viewer");
  }
  return {
    zipName: `${safeSegment(rows[0].folderName)} - ${rows.length} file.zip`,
    entries: flatEntries(rows),
  };
}

/**
 * What a public link lets a visitor zip: a folder link's root or a live
 * folder below it, or files the link exposes. `fileIds` narrows to picked files.
 */
export async function listSharedDownload(
  link: ShareLink,
  root: Folder,
  req: { folderId?: string; fileIds?: string[] },
): Promise<DownloadList> {
  if (link.kind === "folder") {
    if (req.fileIds) {
      const rows = await db
        .select(fileCols)
        .from(files)
        .innerJoin(folders, eq(folders.id, files.folderId))
        .where(and(live, inArray(files.id, req.fileIds), inSubtree(root.path)));
      if (rows.length !== new Set(req.fileIds).size) throw new NotFoundError("File không tồn tại");
      return { zipName: `${safeSegment(root.name)} - ${rows.length} file.zip`, entries: flatEntries(rows) };
    }
    let folder: Folder = root;
    if (req.folderId && req.folderId !== root.id) {
      const [sub] = await db
        .select()
        .from(folders)
        .where(and(eq(folders.id, req.folderId), isNull(folders.deletedAt), like(folders.path, `${root.path}/%`)));
      if (!sub) throw new NotFoundError("Folder không tồn tại");
      folder = sub;
    }
    return { zipName: `${safeSegment(folder.name)}.zip`, entries: await subtreeEntries(folder) };
  }

  const rows = await db
    .select(fileCols)
    .from(shareLinkFiles)
    .innerJoin(files, eq(files.id, shareLinkFiles.fileId))
    .innerJoin(folders, eq(folders.id, files.folderId))
    .where(
      and(
        eq(shareLinkFiles.linkId, link.id),
        live,
        req.fileIds ? inArray(files.id, req.fileIds) : undefined,
      ),
    )
    .orderBy(asc(files.name));
  if (req.fileIds && rows.length !== new Set(req.fileIds).size) throw new NotFoundError("File không tồn tại");
  return { zipName: `${safeSegment(root.name)}.zip`, entries: flatEntries(rows) };
}

/** The response body: signed R2 URLs the browser fetches and zips itself. */
export async function signDownload(list: DownloadList) {
  return {
    zipName: list.zipName,
    entries: await Promise.all(
      list.entries.map(async (e) => ({
        path: e.path,
        size: e.size,
        // `noStore` keeps CORS reads off cached non-CORS copies.
        url: await presignRead(e.r2Key, { contentType: e.mimeType, noStore: true }),
      })),
    ),
  };
}
