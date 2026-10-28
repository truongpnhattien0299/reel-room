"use client";

import { ImageIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { formatBytes } from "@/lib/format";
import type { DuplicateMatch } from "@/server/duplicates";

export type DuplicateReview = {
  id: number;
  folderId: string;
  entries: { file: File; matches: DuplicateMatch[] }[];
};

function MatchThumb({ match }: { match: DuplicateMatch }) {
  const [failed, setFailed] = useState(false);
  return match.hasThumb && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed redirect, not optimisable
    <img
      src={`/api/files/${match.fileId}/thumb`}
      alt=""
      className="size-10 shrink-0 rounded-md bg-muted object-cover"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <ImageIcon className="size-4" aria-hidden="true" />
    </span>
  );
}

/**
 * Shown before uploading files that look like ones the user can already see.
 * Skipping is the default; each file can be switched to upload anyway.
 */
export function DuplicateDialog({
  review,
  onResolve,
}: {
  review: DuplicateReview;
  onResolve: (upload: File[]) => void;
}) {
  const [keep, setKeep] = useState<Set<number>>(() => new Set());
  const total = review.entries.length;
  const toggle = (i: number, on: boolean) =>
    setKeep((prev) => {
      const next = new Set(prev);
      if (on) next.add(i);
      else next.delete(i);
      return next;
    });
  const finish = (indexes: Iterable<number>) => onResolve([...indexes].map((i) => review.entries[i].file));

  return (
    <Dialog open onOpenChange={(open) => !open && finish([])}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{total === 1 ? "File này có vẻ đã có" : `${total} file có vẻ đã có`}</DialogTitle>
          <DialogDescription>
            Các file khác vẫn đang upload. Bật &ldquo;Vẫn upload&rdquo; cho file bạn muốn giữ bản mới.
          </DialogDescription>
        </DialogHeader>
        <ul className="-mx-4 flex max-h-[min(60vh,420px)] flex-col divide-y divide-border/60 overflow-y-auto px-4">
          {review.entries.map(({ file, matches }, i) => (
            <li key={i} className="flex flex-col gap-2 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium" title={file.name}>
                    {file.name}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  Vẫn upload
                  <Switch checked={keep.has(i)} onCheckedChange={(on) => toggle(i, on)} />
                </label>
              </div>
              <ul className="flex flex-col gap-2">
                {matches.map((m) => (
                  <li key={m.fileId} className="flex items-center gap-3">
                    <MatchThumb match={m} />
                    <div className="flex min-w-0 flex-col text-xs">
                      <span className="truncate text-foreground" title={m.name}>
                        {m.name}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {m.exact ? "Trùng" : "Có thể trùng"} · trong{" "}
                        <Link
                          href={`/f/${m.folder.id}`}
                          target="_blank"
                          className="font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          {m.folder.name}
                        </Link>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => finish(review.entries.keys())}>
            Vẫn upload tất cả
          </Button>
          <Button onClick={() => finish(keep)}>
            {keep.size === 0
              ? "Bỏ qua file trùng"
              : keep.size === total
                ? `Upload ${total} file`
                : `Upload ${keep.size}, bỏ qua ${total - keep.size}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
