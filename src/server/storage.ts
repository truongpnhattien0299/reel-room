import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { files, user } from "@/db/schema";

const sumSize = (where: ReturnType<typeof sql>) =>
  sql<number>`coalesce(sum(${files.size}) filter (where ${where}), 0)::bigint`.mapWith(Number);
const countWhere = (where: ReturnType<typeof sql>) =>
  sql<number>`(count(*) filter (where ${where}))::int`.mapWith(Number);

// Trashing a folder stamps `deleted_at` on its files too, so the file's own column is enough.
const live = sql`${files.status} = 'ready' and ${files.deletedAt} is null`;
const trashed = sql`${files.deletedAt} is not null`;
const pending = sql`${files.status} = 'uploading' and ${files.deletedAt} is null`;
const ofKind = (prefix: string) => sql`${live} and ${files.mimeType} like ${`${prefix}/%`}`;

export type StorageBucket = { bytes: number; files: number };

/**
 * Totals across the whole bucket, from the `files` table. Originals only:
 * thumbnails and avatars carry no size in the database.
 */
export async function getStorageOverview() {
  const [r] = await db
    .select({
      liveBytes: sumSize(live),
      liveFiles: countWhere(live),
      trashBytes: sumSize(trashed),
      trashFiles: countWhere(trashed),
      pendingBytes: sumSize(pending),
      pendingFiles: countWhere(pending),
      imageBytes: sumSize(ofKind("image")),
      imageFiles: countWhere(ofKind("image")),
      videoBytes: sumSize(ofKind("video")),
      videoFiles: countWhere(ofKind("video")),
      audioBytes: sumSize(ofKind("audio")),
      audioFiles: countWhere(ofKind("audio")),
    })
    .from(files);
  return {
    live: { bytes: r.liveBytes, files: r.liveFiles },
    trash: { bytes: r.trashBytes, files: r.trashFiles },
    pending: { bytes: r.pendingBytes, files: r.pendingFiles },
    byKind: {
      image: { bytes: r.imageBytes, files: r.imageFiles },
      video: { bytes: r.videoBytes, files: r.videoFiles },
      audio: { bytes: r.audioBytes, files: r.audioFiles },
    },
  };
}

export type StorageOverview = Awaited<ReturnType<typeof getStorageOverview>>;

/** Live bytes per uploader, largest first. */
export async function getStorageByUploader() {
  return db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      bytes: sql<number>`coalesce(sum(${files.size}), 0)::bigint`.mapWith(Number),
      files: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(files)
    .innerJoin(user, eq(user.id, files.uploadedBy))
    .where(and(eq(files.status, "ready"), isNull(files.deletedAt)))
    .groupBy(user.id)
    .orderBy(desc(sql`sum(${files.size})`), user.name);
}

/**
 * Live bytes by upload month (UTC), oldest first, including empty months:
 * `months` months up to and including the one `now` falls in.
 */
export async function getMonthlyGrowth(months = 12, now = new Date()) {
  const { rows } = await db.execute<{ month: string; bytes: string; files: number }>(sql`
    with m as (
      select generate_series(
        date_trunc('month', ${now.toISOString()}::timestamp) - make_interval(months => ${months - 1}),
        date_trunc('month', ${now.toISOString()}::timestamp),
        interval '1 month'
      ) as month
    )
    select to_char(m.month, 'YYYY-MM') as month,
           coalesce(sum(f.size), 0)::text as bytes,
           count(f.id)::int as files
    from m
    left join files f
      on date_trunc('month', f.created_at) = m.month
     and f.status = 'ready' and f.deleted_at is null
    group by m.month
    order by m.month
  `);
  return rows.map((r) => ({ month: r.month, bytes: Number(r.bytes), files: r.files }));
}

export type MonthlyGrowth = Awaited<ReturnType<typeof getMonthlyGrowth>>;

const GB = 1024 ** 3;
/** Cloudflare R2's free tier, per month. */
const FREE_GB = 10;

/** Rough R2 storage bill per month in USD; operations and egress not included. */
export function estimateMonthlyCost(bytes: number, pricePerGb = Number(process.env.R2_PRICE_PER_GB_MONTH) || 0.015) {
  return Math.max(0, bytes / GB - FREE_GB) * pricePerGb;
}
