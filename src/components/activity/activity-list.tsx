"use client";

import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loadActivity } from "@/server/actions";
import type { ActivityFilter } from "@/server/activity";
import { ActivityItem, type ActivityRowData as Row } from "./activity-item";

const TZ = "Asia/Ho_Chi_Minh";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ });
const dayLabel = new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, weekday: "long", day: "numeric", month: "numeric", year: "numeric" });

function dayHeading(d: Date, now = new Date()) {
  const key = dayKey.format(d);
  if (key === dayKey.format(now)) return "Hôm nay";
  if (key === dayKey.format(new Date(now.getTime() - 86_400_000))) return "Hôm qua";
  const label = dayLabel.format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Uploads are logged one row per file; back-to-back uploads by the same
 * person into the same folder read as one.
 */
function foldUploads(rows: Row[]) {
  const out: Row[] = [];
  for (const row of rows) {
    const prev = out.at(-1);
    if (
      prev &&
      row.action === "file.upload" &&
      prev.action === "file.upload" &&
      prev.actor?.id === row.actor?.id &&
      prev.folderId === row.folderId &&
      dayKey.format(prev.createdAt) === dayKey.format(row.createdAt)
    ) {
      const names = [...(prev.meta.names ?? []), ...(row.meta.names ?? [])].slice(0, 20);
      out[out.length - 1] = {
        ...prev,
        meta: { ...prev.meta, names, count: (prev.meta.count ?? 1) + (row.meta.count ?? 1) },
      };
    } else {
      out.push(row);
    }
  }
  return out;
}

/** The log, newest first, grouped by day, with "Xem thêm" for older pages. */
export function ActivityList({
  filter,
  initial,
  empty = "Chưa có hoạt động nào.",
}: {
  filter: ActivityFilter;
  initial: { rows: Row[]; nextCursor: string | null };
  empty?: string;
}) {
  const [rows, setRows] = useState(initial.rows);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [pending, startTransition] = useTransition();

  function more() {
    if (!cursor) return;
    startTransition(async () => {
      const res = await loadActivity({ ...filter, cursor });
      if (res.error || !res.data) return void toast.error(res.error ?? "Không tải được");
      const page = res.data;
      setRows((prev) => [...prev, ...page.rows]);
      setCursor(page.nextCursor);
    });
  }

  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;

  const days: { heading: string; rows: Row[] }[] = [];
  for (const row of foldUploads(rows)) {
    const heading = dayHeading(row.createdAt);
    if (days.at(-1)?.heading !== heading) days.push({ heading, rows: [] });
    days.at(-1)!.rows.push(row);
  }

  return (
    <div className="flex flex-col gap-5">
      {days.map((d) => (
        <section key={d.heading} aria-label={d.heading}>
          <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase" suppressHydrationWarning>
            {d.heading}
          </h3>
          <ul className="divide-y divide-border/60">
            {d.rows.map((r) => (
              <ActivityItem key={r.id} row={r} />
            ))}
          </ul>
        </section>
      ))}
      {cursor && (
        <Button variant="outline" className="self-center" disabled={pending} onClick={more}>
          {pending && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
          Xem thêm
        </Button>
      )}
    </div>
  );
}
