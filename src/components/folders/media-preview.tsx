"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FolderIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatBytes, formatDateTime, formatDuration } from "@/lib/format";
import { isVideo } from "@/lib/media";
import { toneFor } from "@/lib/tones";
import { cn } from "@/lib/utils";
import type { FileItem } from "@/server/queries";
import { MediaThumb } from "./media-thumb";
import { useMediaUrls } from "./media-urls";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export function MediaPreview({
  files,
  folderName,
  index,
  onIndexChange,
  onRename,
  onDelete,
}: {
  files: FileItem[];
  folderName: string;
  index: number | null;
  onIndexChange: (index: number | null) => void;
  onRename?: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
}) {
  const file = index === null ? null : files[index];
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < files.length - 1;
  const stripRef = useRef<HTMLElement>(null);
  const urls = useMediaUrls();

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      // A focused <video> uses the arrows to seek; leave those alone.
      if (e.target instanceof HTMLVideoElement) return;
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      if (e.key === "ArrowRight" && index < files.length - 1) onIndexChange(index + 1);
    };
    // Capture phase: the dialog stops keydown from bubbling up to window.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [index, files.length, onIndexChange]);

  // Keep the current frame of the filmstrip in view.
  useEffect(() => {
    if (index === null) return;
    stripRef.current
      ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);

  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-stage p-0 text-foreground ring-0 sm:max-w-none"
      >
        {file && index !== null && (
          <>
            <header className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b border-[#1a1c21] px-4 py-3 sm:px-8">
              <div className="flex min-w-0 items-center gap-3.5">
                <DialogClose
                  render={<Button variant="ghost" size="icon-xl" aria-label="Đóng" />}
                >
                  <XIcon />
                </DialogClose>
                <div className="flex min-w-0 flex-col leading-tight">
                  <DialogTitle className="truncate text-base font-semibold">{file.name}</DialogTitle>
                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {index + 1} / {files.length} · {folderName}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="xl" nativeButton={false} render={<a href={urls.download(file.id)} />}>
                  <DownloadIcon data-icon="inline-start" />
                  Tải về
                </Button>
                {(onRename || onDelete) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="outline" size="icon-xl" aria-label="Thêm thao tác" />}
                    >
                      <MoreHorizontalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {onRename && (
                        <DropdownMenuItem onClick={() => onRename(file)}>
                          <PencilIcon />
                          Đổi tên
                        </DropdownMenuItem>
                      )}
                      {onDelete && (
                        <DropdownMenuItem variant="destructive" onClick={() => onDelete(file)}>
                          <Trash2Icon />
                          Chuyển vào thùng rác
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </header>

            <div className="flex min-h-0 flex-1">
              <section
                aria-label="Trình xem"
                className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-8"
              >
                <div className="relative flex min-h-0 flex-1 items-center justify-center">
                  {isVideo(file) ? (
                    <video
                      key={file.id}
                      src={urls.content(file.id)}
                      controls
                      autoPlay
                      playsInline
                      className="max-h-full max-w-full rounded-2xl bg-black shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={file.id}
                      src={urls.content(file.id)}
                      alt={file.name}
                      className="max-h-full max-w-full rounded-2xl object-contain shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
                    />
                  )}
                  {hasPrev && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="File trước"
                      className="absolute left-0 size-12 rounded-full bg-white/8 hover:bg-white/16 [&_svg:not([class*='size-'])]:size-[22px]"
                      onClick={() => onIndexChange(index - 1)}
                    >
                      <ChevronLeftIcon />
                    </Button>
                  )}
                  {hasNext && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="File sau"
                      className="absolute right-0 size-12 rounded-full bg-white/8 hover:bg-white/16 [&_svg:not([class*='size-'])]:size-[22px]"
                      onClick={() => onIndexChange(index + 1)}
                    >
                      <ChevronRightIcon />
                    </Button>
                  )}
                </div>

                {files.length > 1 && (
                  <nav
                    ref={stripRef}
                    aria-label="Các file trong folder"
                    className="flex shrink-0 gap-2 overflow-x-auto px-0.5 pt-1 pb-1.5 [scrollbar-width:thin] sm:justify-center-safe"
                  >
                    {files.map((f, i) => (
                      <button
                        key={f.id}
                        type="button"
                        data-index={i}
                        aria-label={f.name}
                        aria-current={i === index ? "true" : undefined}
                        onClick={() => onIndexChange(i)}
                        className={cn(
                          "h-[52px] w-[76px] shrink-0 overflow-hidden rounded-[9px] outline-offset-2 transition-opacity focus-visible:outline-2 focus-visible:outline-ring",
                          i === index ? "outline-2 outline-primary" : "opacity-55 hover:opacity-90",
                        )}
                      >
                        <MediaThumb id={f.id} hasThumb={f.hasThumb} />
                      </button>
                    ))}
                  </nav>
                )}
              </section>

              <aside
                aria-label="Thông tin file"
                className="hidden w-[340px] shrink-0 flex-col gap-6 overflow-y-auto border-l border-[#1a1c21] bg-background px-6 py-7 lg:flex"
              >
                <h2 className="font-display text-lg font-semibold">Thông tin</h2>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-[13px]">
                  <InfoRow label="Loại">
                    {isVideo(file) ? "Video" : "Ảnh"} · {file.mimeType.split("/")[1]?.toUpperCase()}
                  </InfoRow>
                  <InfoRow label="Dung lượng" mono>
                    {formatBytes(file.size)}
                  </InfoRow>
                  {file.width && file.height && (
                    <InfoRow label="Độ phân giải" mono>
                      {file.width} × {file.height}
                    </InfoRow>
                  )}
                  {file.durationMs !== null && (
                    <InfoRow label="Thời lượng" mono>
                      {formatDuration(file.durationMs)}
                    </InfoRow>
                  )}
                  <InfoRow label="Tải lên">{formatDateTime(file.createdAt)}</InfoRow>
                </dl>
                <div className="h-px bg-[#1f2229]" />
                {/* Public links leave the uploader out. */}
                {file.uploaderName && (
                  <div className="flex flex-col gap-3">
                    <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                      Người tải lên
                    </span>
                    <div className="flex items-center gap-3">
                      <span
                        className="flex size-9 items-center justify-center rounded-full text-xs font-semibold"
                        style={{ background: toneFor(file.uploaderName).sky }}
                      >
                        {initials(file.uploaderName)}
                      </span>
                      <span className="font-medium">{file.uploaderName}</span>
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    Vị trí
                  </span>
                  <span className="flex items-center gap-2.5 rounded-xl bg-card px-3 py-2.5 ring-1 ring-border">
                    <FolderIcon className="size-[18px] text-primary" aria-hidden="true" />
                    <span className="truncate font-medium">{folderName}</span>
                  </span>
                </div>
              </aside>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  label,
  mono,
  children,
}: {
  label: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("m-0 text-right", mono && "font-mono")}>{children}</dd>
    </>
  );
}
