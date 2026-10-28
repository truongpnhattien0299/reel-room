"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FolderInputIcon,
  InfoIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MediaThumb } from "@/components/folders/media-thumb";
import { useMediaUrls } from "@/components/folders/media-urls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { mediaKind } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { FileItem } from "@/server/queries";
import { AudioPlayer } from "./audio-player";
import { useViewerHotkeys } from "./hotkeys";
import { ImageViewer } from "./image-viewer";
import { InfoPanel } from "./info-panel";
import { VideoPlayer } from "./video-player";

/** Full-screen viewer stepping through `files`; `index` null means closed. */
export function MediaViewer({
  files,
  folderName,
  index,
  onIndexChange,
  onRename,
  onMove,
  onDelete,
}: {
  files: FileItem[];
  folderName: string;
  index: number | null;
  onIndexChange: (index: number | null) => void;
  onRename?: (file: FileItem) => void;
  onMove?: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
}) {
  const file = index === null ? null : files[index];
  const kind = file ? mediaKind(file) : null;
  const prev = index !== null && index > 0 ? () => onIndexChange(index - 1) : undefined;
  const next =
    index !== null && index < files.length - 1 ? () => onIndexChange(index + 1) : undefined;
  const stripRef = useRef<HTMLElement>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const urls = useMediaUrls();

  useViewerHotkeys({ enabled: file !== null, arrowsNavigate: kind === "image", onPrev: prev, onNext: next });

  // Keep the current frame of the filmstrip in view.
  useEffect(() => {
    if (index === null) return;
    stripRef.current
      ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);

  // Warm the cache for the photos either side, so stepping through is instant.
  useEffect(() => {
    if (index === null) return;
    for (const f of [files[index - 1], files[index + 1]]) {
      if (f && mediaKind(f) === "image") new Image().src = urls.content(f.id);
    }
  }, [index, files, urls]);

  // An audio file plays into the next one, as long as that is audio too.
  const nextFile = index === null ? undefined : files[index + 1];
  const playOn = next && nextFile && mediaKind(nextFile) === "audio" ? next : undefined;

  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-stage p-0 text-foreground ring-0 sm:max-w-none"
      >
        {file && index !== null && (
          <>
            <header className="flex items-center justify-between gap-x-3 border-b border-[#1a1c21] px-3 py-3 sm:gap-x-5 sm:px-8">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3.5">
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
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="icon-xl"
                  aria-label="Thông tin file"
                  onClick={() => setInfoOpen(true)}
                  className="lg:hidden"
                >
                  <InfoIcon />
                </Button>
                <Button
                  size="xl"
                  nativeButton={false}
                  render={<a href={urls.download(file.id)} />}
                  aria-label="Tải về"
                  className="max-sm:w-11 max-sm:px-0!"
                >
                  <DownloadIcon data-icon="inline-start" />
                  <span className="max-sm:hidden">Tải về</span>
                </Button>
                {(onRename || onMove || onDelete) && (
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
                      {onMove && (
                        <DropdownMenuItem onClick={() => onMove(file)}>
                          <FolderInputIcon />
                          Di chuyển
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
                className="flex min-w-0 flex-1 flex-col gap-4 p-3 sm:gap-6 sm:p-8"
              >
                <div className="relative flex min-h-0 flex-1 items-center justify-center">
                  {kind === "image" ? (
                    <ImageViewer
                      key={file.id}
                      file={file}
                      src={urls.content(file.id)}
                      downloadUrl={urls.download(file.id)}
                      onPrev={prev}
                      onNext={next}
                    />
                  ) : kind === "video" ? (
                    <VideoPlayer
                      key={file.id}
                      src={urls.content(file.id)}
                      downloadUrl={urls.download(file.id)}
                    />
                  ) : (
                    <AudioPlayer
                      key={file.id}
                      file={file}
                      src={urls.content(file.id)}
                      downloadUrl={urls.download(file.id)}
                      folderName={folderName}
                      onEnded={playOn}
                      onPrev={prev}
                      onNext={next}
                    />
                  )}
                  <StepButton side="prev" onClick={prev} />
                  <StepButton side="next" onClick={next} />
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
                        <MediaThumb id={f.id} hasThumb={f.hasThumb} kind={mediaKind(f)} />
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
                <InfoPanel file={file} folderName={folderName} />
              </aside>
            </div>

            <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
              <SheetContent side="bottom" className="max-h-[80dvh] rounded-t-2xl lg:hidden">
                <SheetHeader className="px-5 pt-5 pb-0">
                  <SheetTitle className="font-display text-lg font-semibold">Thông tin</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-6 overflow-y-auto px-5 pb-8">
                  <InfoPanel file={file} folderName={folderName} />
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepButton({ side, onClick }: { side: "prev" | "next"; onClick?: () => void }) {
  if (!onClick) return null;
  const Icon = side === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={side === "prev" ? "File trước" : "File sau"}
      aria-keyshortcuts={side === "prev" ? "Shift+ArrowLeft" : "Shift+ArrowRight"}
      onClick={onClick}
      className={cn(
        "absolute size-12 rounded-full bg-stage/50 backdrop-blur-sm hover:bg-white/16 max-sm:hidden [&_svg:not([class*='size-'])]:size-[22px]",
        side === "prev" ? "left-0" : "right-0",
      )}
    >
      <Icon />
    </Button>
  );
}
