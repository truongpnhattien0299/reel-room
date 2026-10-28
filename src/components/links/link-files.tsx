"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MediaThumb } from "@/components/folders/media-thumb";
import { mediaKind } from "@/lib/media";
import { getShareLinkFiles } from "@/server/actions";
import type { FileItem } from "@/server/queries";

/** The files a "files" link still exposes, loaded on first expand. */
export function LinkFiles({
  linkId,
  folderId,
  fileCount,
}: {
  linkId: string;
  folderId: string;
  fileCount: number;
}) {
  const [items, setItems] = useState<FileItem[] | null>(null);

  useEffect(() => {
    void getShareLinkFiles(linkId).then(setItems);
  }, [linkId]);

  if (items === null) return <p className="text-sm text-muted-foreground">Đang tải…</p>;
  const gone = fileCount - items.length;

  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
          {items.map((f) => (
            <li key={f.id}>
              <Link
                href={`/f/${folderId}`}
                title={f.name}
                className="flex flex-col gap-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="aspect-square overflow-hidden rounded-lg ring-1 ring-border">
                  <MediaThumb id={f.id} hasThumb={f.hasThumb} kind={mediaKind(f)} />
                </span>
                <span className="truncate text-xs text-muted-foreground">{f.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {gone > 0 && (
        <p className="text-xs text-muted-foreground">
          {items.length === 0 ? "Mọi file" : `${gone} file`} trong link đã bị xoá khỏi folder.
        </p>
      )}
    </div>
  );
}
