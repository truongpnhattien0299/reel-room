"use client";

import {
  DownloadIcon,
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PictureInPicture2Icon,
  PlayIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlayerHotkeys } from "./hotkeys";
import { SeekBar, SpeedMenu, Spinner, TimeDisplay, VolumeControl } from "./player/controls";
import { useMediaState } from "./player/use-media-state";

const HIDE_AFTER_MS = 2500;
const DOUBLE_TAP_MS = 280;

type IOSVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

const noSubscribe = () => () => {};
const usePipSupported = () =>
  useSyncExternalStore(noSubscribe, () => document.pictureInPictureEnabled, () => false);

export function VideoPlayer({ src, downloadUrl }: { src: string; downloadUrl: string | null }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, controls } = useMediaState(videoRef);
  const [fullscreen, setFullscreen] = useState(false);
  const [active, setActive] = useState(true);
  const [ripple, setRipple] = useState<{ side: -1 | 1; key: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastTap = useRef<{ at: number; side: -1 | 0 | 1 } | null>(null);
  const pipSupported = usePipSupported();

  const showControls = state.error || !state.playing || active;

  function wake() {
    setActive(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setActive(false), HIDE_AFTER_MS);
  }

  // Start the countdown once playback starts; any movement restarts it.
  useEffect(() => {
    if (!state.playing) return;
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setActive(false), HIDE_AFTER_MS);
  }, [state.playing]);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      clearTimeout(hideTimer.current);
      clearTimeout(tapTimer.current);
    };
  }, []);

  function toggleFullscreen() {
    const root = rootRef.current;
    const video = videoRef.current as IOSVideo | null;
    if (!root || !video) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (root.requestFullscreen) void root.requestFullscreen().catch(() => {});
    // iPhone Safari only lets the <video> itself go fullscreen.
    else video.webkitEnterFullscreen?.();
  }

  function togglePip() {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) void document.exitPictureInPicture();
    else void video.requestPictureInPicture().catch(() => {});
  }

  usePlayerHotkeys(state, controls, toggleFullscreen);

  // One handler for mouse and touch so a double tap/click isn't also a single one.
  function onSurfaceUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const touch = e.pointerType !== "mouse";
    const rect = e.currentTarget.getBoundingClientRect();
    const third = (e.clientX - rect.left) / rect.width;
    const side = touch ? (third < 1 / 3 ? -1 : third > 2 / 3 ? 1 : 0) : 0;
    const now = e.timeStamp;
    const prev = lastTap.current;

    if (prev && now - prev.at < DOUBLE_TAP_MS && prev.side === side) {
      clearTimeout(tapTimer.current);
      lastTap.current = null;
      if (side === 0) toggleFullscreen();
      else {
        controls.seekBy(side * 10);
        setRipple({ side, key: now });
      }
      return;
    }
    lastTap.current = { at: now, side };
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      lastTap.current = null;
      // A tap on a phone shows/hides the controls; a click plays/pauses.
      if (!touch) controls.toggle();
      else if (showControls && state.playing) {
        clearTimeout(hideTimer.current);
        setActive(false);
      } else wake();
    }, DOUBLE_TAP_MS);
  }

  return (
    <div
      ref={rootRef}
      onPointerMove={(e) => e.pointerType === "mouse" && wake()}
      onFocusCapture={wake}
      className={cn(
        "relative flex size-full items-center justify-center overflow-hidden",
        fullscreen && "bg-black",
        !showControls && "cursor-none",
      )}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        playsInline
        preload="auto"
        className={cn(
          "max-h-full max-w-full bg-black",
          !fullscreen && "rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)]",
        )}
      />

      {/* Click/tap surface over the picture, under the controls. */}
      <div aria-hidden="true" className="absolute inset-0" onPointerUp={onSurfaceUp} />

      {ripple && (
        <span
          key={ripple.key}
          aria-hidden="true"
          onAnimationEnd={() => setRipple(null)}
          className={cn(
            "pointer-events-none absolute top-1/2 flex size-20 -translate-y-1/2 animate-[viewer-ripple_600ms_ease-out_forwards] items-center justify-center rounded-full bg-white/15 font-mono text-sm font-semibold",
            ripple.side === -1 ? "left-[12%]" : "right-[12%]",
          )}
        >
          {ripple.side === -1 ? "−10s" : "+10s"}
        </span>
      )}

      {state.error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stage/80 p-6 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">
            Trình duyệt không phát được video này.
            {downloadUrl && " Hãy tải về để xem bằng ứng dụng khác."}
          </p>
          {downloadUrl && (
            <Button size="lg" nativeButton={false} render={<a href={downloadUrl} />}>
              <DownloadIcon data-icon="inline-start" />
              Tải về
            </Button>
          )}
        </div>
      ) : state.waiting ? (
        <Spinner className="pointer-events-none absolute" />
      ) : (
        !state.playing && (
          <button
            type="button"
            aria-label={state.ended ? "Xem lại" : "Phát"}
            onClick={controls.toggle}
            className="absolute flex size-16 items-center justify-center rounded-full bg-stage/60 text-white ring-1 ring-white/15 backdrop-blur-md transition-transform outline-none hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {state.ended ? (
              <RotateCcwIcon className="size-7" />
            ) : (
              <PlayIcon className="ml-1 size-7 fill-current" />
            )}
          </button>
        )
      )}

      <div
        onPointerMove={wake}
        className={cn(
          "absolute inset-x-2 bottom-2 flex flex-col gap-1 rounded-2xl bg-stage/70 px-3 pt-1.5 pb-1.5 ring-1 ring-white/10 backdrop-blur-md transition-opacity duration-300 sm:inset-x-auto sm:bottom-4 sm:w-[min(720px,calc(100%-2rem))]",
          showControls ? "opacity-100" : "pointer-events-none opacity-0",
          state.error && "hidden",
        )}
      >
        <SeekBar state={state} controls={controls} />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label={state.playing ? "Tạm dừng" : "Phát"}
            aria-keyshortcuts="K"
            onClick={controls.toggle}
          >
            {state.playing ? <PauseIcon className="fill-current" /> : <PlayIcon className="fill-current" />}
          </Button>
          <VolumeControl state={state} controls={controls} />
          <TimeDisplay state={state} className="ml-1" />
          <div className="ml-auto flex items-center">
            <SpeedMenu state={state} controls={controls} />
            {pipSupported && (
              <Button variant="ghost" size="icon-lg" aria-label="Hình trong hình" onClick={togglePip}>
                <PictureInPicture2Icon />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label={fullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
              aria-keyshortcuts="F"
              onClick={toggleFullscreen}
            >
              {fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
