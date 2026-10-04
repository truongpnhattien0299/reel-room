import Link from "next/link";
import { formatRelative } from "@/lib/format";
import { isVideo } from "@/lib/media";
import type { RecentFile } from "@/server/queries";
import { DurationBadge, MediaThumb } from "./media-thumb";

/** Newest uploads across the library; each opens in its folder's viewer. */
export function RecentGrid({ files }: { files: RecentFile[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
      {files.map((f) => (
        <Link
          key={f.id}
          href={`/f/${f.folderId}?file=${f.id}`}
          className="group flex flex-col gap-2.5 rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        >
          <span className="relative block aspect-[4/5] overflow-hidden rounded-[14px] bg-muted transition-[filter] duration-200 group-hover:brightness-110">
            <MediaThumb id={f.id} hasThumb={f.hasThumb} />
            {isVideo(f) && (
              <DurationBadge durationMs={f.durationMs} className="absolute bottom-2.5 left-2.5" />
            )}
          </span>
          <span className="flex min-w-0 flex-col px-0.5 leading-snug">
            <span className="truncate text-[13px] font-medium" title={f.name}>
              {f.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {f.folderName} · {formatRelative(f.createdAt)}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
