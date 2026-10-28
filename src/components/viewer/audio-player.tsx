"use client";

import { DownloadIcon, PauseIcon, PlayIcon, RotateCcwIcon, RotateCwIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { AudioTile } from "@/components/folders/media-thumb";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";
import { usePlayerHotkeys } from "./hotkeys";
import { SeekBar, SpeedMenu, Spinner, TimeDisplay, VolumeControl } from "./player/controls";
import { useMediaState } from "./player/use-media-state";

export function AudioPlayer({
  file,
  src,
  downloadUrl,
  folderName,
  onEnded,
  onPrev,
  onNext,
}: {
  file: { id: string; name: string; size: number; mimeType: string };
  src: string;
  downloadUrl: string;
  folderName: string;
  onEnded?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { state, controls } = useMediaState(audioRef);
  usePlayerHotkeys(state, controls);

  // Lock screen, headphones and media keys.
  const handlers = useRef({ controls, onPrev, onNext });
  useEffect(() => {
    handlers.current = { controls, onPrev, onNext };
  });
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    session.metadata = new MediaMetadata({ title: file.name, album: folderName });
    const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => void audioRef.current?.play().catch(() => {})],
      ["pause", () => audioRef.current?.pause()],
      ["seekbackward", (d) => handlers.current.controls.seekBy(-(d.seekOffset ?? 10))],
      ["seekforward", (d) => handlers.current.controls.seekBy(d.seekOffset ?? 10)],
      ["seekto", (d) => d.seekTime !== undefined && handlers.current.controls.seek(d.seekTime)],
      ["previoustrack", () => handlers.current.onPrev?.()],
      ["nexttrack", () => handlers.current.onNext?.()],
    ];
    for (const [action, handler] of actions) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Action not supported by this browser.
      }
    }
    return () => {
      session.metadata = null;
      for (const [action] of actions) {
        try {
          session.setActionHandler(action, null);
        } catch {}
      }
    };
  }, [file.name, folderName]);

  const subtype = file.mimeType.split("/")[1]?.toUpperCase();

  return (
    <div className="flex size-full items-center justify-center overflow-y-auto">
      <audio ref={audioRef} src={src} autoPlay preload="auto" onEnded={onEnded} />
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl bg-card/60 p-6 ring-1 ring-white/8 sm:p-8">
        <div className="relative aspect-square w-full max-w-60 overflow-hidden rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
          <AudioTile seed={file.id} iconClassName="max-h-20 max-w-20" />
          {state.waiting && (
            <span className="absolute inset-0 flex items-center justify-center bg-stage/30">
              <Spinner />
            </span>
          )}
        </div>
        <div className="flex w-full min-w-0 flex-col items-center gap-1 text-center">
          <p className="w-full truncate font-display text-lg font-semibold" title={file.name}>
            {file.name}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            {[subtype, formatBytes(file.size)].filter(Boolean).join(" · ")}
          </p>
        </div>

        {state.error ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              Trình duyệt không phát được file này. Hãy tải về để nghe bằng ứng dụng khác.
            </p>
            <Button size="lg" nativeButton={false} render={<a href={downloadUrl} />}>
              <DownloadIcon data-icon="inline-start" />
              Tải về
            </Button>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <SeekBar state={state} controls={controls} />
              <TimeDisplay state={state} className="self-end" />
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center">
              <VolumeControl state={state} controls={controls} />
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Lùi 10 giây"
                  aria-keyshortcuts="J"
                  onClick={() => controls.seekBy(-10)}
                >
                  <RotateCcwIcon />
                </Button>
                <button
                  type="button"
                  aria-label={state.playing ? "Tạm dừng" : "Phát"}
                  aria-keyshortcuts="K"
                  onClick={controls.toggle}
                  className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform outline-none hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {state.playing ? (
                    <PauseIcon className="size-6 fill-current" />
                  ) : (
                    <PlayIcon className="ml-0.5 size-6 fill-current" />
                  )}
                </button>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Tới 10 giây"
                  aria-keyshortcuts="L"
                  onClick={() => controls.seekBy(10)}
                >
                  <RotateCwIcon />
                </Button>
              </div>
              <SpeedMenu state={state} controls={controls} className="justify-self-end" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
