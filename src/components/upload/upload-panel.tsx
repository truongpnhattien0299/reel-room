"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ImageIcon,
  PlayIcon,
  RotateCwIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUploads, type UploadItem } from "./upload-provider";

function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={cn("h-1 overflow-hidden rounded-full bg-[#2a2e37]", className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

export function UploadPanel() {
  const { items, cancel, retry, clearFinished } = useUploads();
  const [collapsed, setCollapsed] = useState(false);
  if (items.length === 0) return null;

  const running = items.filter((it) => it.status === "uploading" || it.status === "finishing");
  const failed = items.filter((it) => it.status === "error").length;
  const total = items.reduce((sum, it) => sum + it.size, 0);
  const sent = items.reduce((sum, it) => sum + it.bytesUploaded, 0);

  const title = running.length
    ? `Đang upload ${running.length} file`
    : failed
      ? `${failed} file lỗi`
      : "Upload hoàn tất";

  return (
    <aside
      aria-label="Tiến trình upload"
      className="fixed right-4 bottom-4 z-40 flex w-[calc(100%-2rem)] flex-col gap-3.5 rounded-[18px] bg-popover p-4 shadow-[0_24px_60px_rgba(0,0,0,0.5)] ring-1 ring-[#2a2e37] sm:right-8 sm:bottom-8 sm:w-[360px]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="font-semibold">{title}</span>
          {running.length > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              {formatBytes(sent)} / {formatBytes(total)}
            </span>
          )}
        </div>
        <div className="flex">
          <Button
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "Mở rộng" : "Thu gọn"}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </Button>
          {running.length === 0 && (
            <Button variant="ghost" size="icon" aria-label="Đóng" onClick={clearFinished}>
              <XIcon />
            </Button>
          )}
        </div>
      </div>
      {running.length > 0 && <Bar value={total ? (sent / total) * 100 : 0} />}
      {!collapsed && (
        <ul className="-mr-2 flex max-h-72 flex-col gap-3 overflow-y-auto pr-2">
          {items.map((it) => (
            <UploadRow key={it.id} item={it} onCancel={cancel} onRetry={retry} />
          ))}
        </ul>
      )}
    </aside>
  );
}

function UploadRow({
  item,
  onCancel,
  onRetry,
}: {
  item: UploadItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const percent = item.size ? (item.bytesUploaded / item.size) * 100 : 0;
  const Icon = /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(item.name) ? PlayIcon : ImageIcon;
  return (
    <li className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#2a2e37] text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex justify-between gap-2 text-[13px]">
          <span className="truncate" title={item.name}>
            {item.name}
          </span>
          {(item.status === "uploading" || item.status === "finishing") && (
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {item.status === "finishing" ? "Hoàn tất…" : `${Math.floor(percent)}%`}
            </span>
          )}
        </div>
        {item.status === "error" ? (
          <p className="truncate text-xs text-destructive" title={item.error}>
            {item.error ?? "Lỗi upload"}
          </p>
        ) : item.status === "done" ? (
          <p className="font-mono text-xs text-muted-foreground">{formatBytes(item.size)}</p>
        ) : (
          <Bar value={percent} className="h-[3px]" />
        )}
      </div>
      {item.status === "done" ? (
        <span
          aria-label="Xong"
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-300/15 text-emerald-300"
        >
          <CheckIcon className="size-3.5" strokeWidth={3} />
        </span>
      ) : (
        <div className="flex shrink-0">
          {item.status === "error" && (
            <Button variant="ghost" size="icon-sm" aria-label="Thử lại" onClick={() => onRetry(item.id)}>
              <RotateCwIcon />
            </Button>
          )}
          {item.status !== "finishing" && (
            <Button variant="ghost" size="icon-sm" aria-label="Huỷ upload" onClick={() => onCancel(item.id)}>
              <XIcon />
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
