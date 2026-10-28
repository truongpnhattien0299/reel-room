import "server-only";
import { and, desc, eq, gte, isNull, like, lt, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activity, user, type ActivityAction } from "@/db/schema";
import { isAdmin, type Session } from "@/lib/auth";
import { ForbiddenError, requireFolderRole } from "@/server/permissions";

/** What a row keeps about the event; every field is optional. */
export type ActivityMeta = {
  /** The folder or file the event is about. */
  name?: string;
  /** Up to `MAX_NAMES` file names, for bulk events; `count` has the total. */
  names?: string[];
  count?: number;
  /** Old and new value: names on rename, folder names on move, roles. */
  from?: string | null;
  to?: string | null;
  /** The folder the event happened in, when `name` is about something else. */
  folderName?: string;
  role?: string;
  kind?: "folder" | "files";
  expiresAt?: string | null;
  email?: string;
  reason?: string | null;
  via?: "email" | "set";
  /** Link settings changed or chosen at creation. */
  password?: "set" | "removed";
  allowDownload?: boolean;
};

const MAX_NAMES = 20;
export const someNames = (names: string[]) => names.slice(0, MAX_NAMES);

/**
 * The insert for one log row, not yet run: put it in the same `db.batch` as
 * the change it records, so a failed change logs nothing. `actor` null means
 * the system.
 */
export function logActivity(
  actor: Session | null,
  action: ActivityAction,
  opts: { folder?: { id: string; path: string }; targetUserId?: string; meta?: ActivityMeta } = {},
) {
  return db.insert(activity).values({
    actorId: actor?.user.id ?? null,
    action,
    folderId: opts.folder?.id ?? null,
    folderPath: opts.folder?.path ?? null,
    targetUserId: opts.targetUserId ?? null,
    meta: opts.meta ?? {},
    // Millisecond precision, so a row's time round-trips through the page cursor.
    createdAt: new Date(),
  });
}

/** Rows older than this are dropped by the daily cleanup. */
export const ACTIVITY_RETENTION_DAYS = 365;

export const ACTIVITY_GROUPS = ["file", "folder", "share", "link", "user"] as const;

/** Day boundaries for the date filter are Vietnam time. */
const TZ = "+07:00";
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const activityFilterSchema = z.object({
  /** A folder's log (owners only); without it the whole log (admins only). */
  folderId: z.uuid().optional(),
  /** A user id, or "system". */
  actor: z.string().min(1).max(100).optional(),
  group: z.enum(ACTIVITY_GROUPS).optional(),
  from: day.optional(),
  to: day.optional(),
  cursor: z.string().regex(/^[^|]+\|[0-9a-f-]{36}$/).optional(),
});

export type ActivityFilter = z.input<typeof activityFilterSchema>;

const PAGE_SIZE = 50;

export async function listActivity(session: Session, rawFilter: ActivityFilter) {
  const filter = activityFilterSchema.parse(rawFilter);
  const where: (SQL | undefined)[] = [];
  if (filter.folderId) {
    const { folder } = await requireFolderRole(session, filter.folderId, "owner");
    where.push(or(eq(activity.folderPath, folder.path), like(activity.folderPath, `${folder.path}/%`)));
  } else if (!isAdmin(session)) {
    throw new ForbiddenError();
  }
  if (filter.actor) {
    where.push(filter.actor === "system" ? isNull(activity.actorId) : eq(activity.actorId, filter.actor));
  }
  if (filter.group) where.push(like(sql`${activity.action}::text`, `${filter.group}.%`));
  if (filter.from) where.push(gte(activity.createdAt, new Date(`${filter.from}T00:00:00${TZ}`)));
  if (filter.to) {
    const end = new Date(`${filter.to}T00:00:00${TZ}`);
    end.setUTCDate(end.getUTCDate() + 1);
    where.push(lt(activity.createdAt, end));
  }
  if (filter.cursor) {
    const [at, id] = filter.cursor.split("|");
    where.push(sql`(${activity.createdAt}, ${activity.id}) < (${new Date(at).toISOString()}::timestamp, ${id}::uuid)`);
  }

  const rows = await db
    .select({
      id: activity.id,
      action: activity.action,
      folderId: activity.folderId,
      targetUserId: activity.targetUserId,
      meta: activity.meta,
      createdAt: activity.createdAt,
      actor: { id: user.id, name: user.name, image: user.image },
    })
    .from(activity)
    .leftJoin(user, eq(user.id, activity.actorId))
    .where(and(...where))
    .orderBy(desc(activity.createdAt), desc(activity.id))
    .limit(PAGE_SIZE + 1);

  const page = rows.slice(0, PAGE_SIZE).map((r) => ({ ...r, meta: r.meta as ActivityMeta }));
  const last = page.at(-1);
  return {
    rows: page,
    nextCursor: rows.length > PAGE_SIZE && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
  };
}

export type ActivityItem = Awaited<ReturnType<typeof listActivity>>["rows"][number];
