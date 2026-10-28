"use client";

import { CheckIcon, Volume1Icon, Volume2Icon, VolumeXIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Slider } from "./slider";
import { type MediaControls, type MediaState, RATES } from "./use-media-state";

const time = (seconds: number) => formatDuration(seconds * 1000);

export function SeekBar({
  state,
  controls,
  className,
}: {
  state: MediaState;
  controls: MediaControls;
  className?: string;
}) {
  return (
    <Slider
      label="Tua"
      value={state.currentTime}
      max={state.duration}
      buffered={state.buffered}
      step={5}
      valueText={`${time(state.currentTime)} / ${time(state.duration)}`}
      formatTip={time}
      onChange={controls.seek}
      className={className}
    />
  );
}

export function TimeDisplay({ state, className }: { state: MediaState; className?: string }) {
  return (
    <span className={cn("font-mono text-xs whitespace-nowrap text-foreground/80 tabular-nums", className)}>
      {time(state.currentTime)}
      <span className="text-muted-foreground"> / {time(state.duration)}</span>
    </span>
  );
}

export function VolumeControl({
  state,
  controls,
}: {
  state: MediaState;
  controls: MediaControls;
}) {
  const level = state.muted ? 0 : state.volume;
  const Icon = level === 0 ? VolumeXIcon : level < 0.5 ? Volume1Icon : Volume2Icon;
  return (
    <div className="group/volume flex items-center">
      <Button
        variant="ghost"
        size="icon-lg"
        aria-label={state.muted ? "Bật tiếng" : "Tắt tiếng"}
        aria-keyshortcuts="M"
        onClick={controls.toggleMute}
      >
        <Icon />
      </Button>
      {/* Phones change volume with their hardware buttons. */}
      <Slider
        label="Âm lượng"
        value={level}
        max={1}
        step={0.1}
        valueText={`${Math.round(level * 100)}%`}
        onChange={controls.setVolume}
        className="hidden w-20 pr-1 sm:flex"
      />
    </div>
  );
}

/**
 * Playback speed. An inline list rather than a portaled menu, so it still
 * shows when the player is fullscreen.
 */
export function SpeedMenu({
  state,
  controls,
  className,
}: {
  state: MediaState;
  controls: MediaControls;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    // Capture on window: Escape closes the list, not the whole viewer.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        variant="ghost"
        size="lg"
        aria-label="Tốc độ phát"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className="min-w-12 px-2 font-mono text-xs"
      >
        {state.rate}x
      </Button>
      {open && (
        <div
          role="group"
          aria-label="Tốc độ phát"
          className="absolute right-0 bottom-full z-10 mb-2 flex w-32 flex-col rounded-xl bg-popover p-1 shadow-[0_16px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
        >
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === state.rate}
              onClick={() => {
                controls.setRate(r);
                setOpen(false);
              }}
              className="flex h-8 items-center justify-between rounded-lg px-2.5 text-left font-mono text-xs outline-none hover:bg-white/8 focus-visible:bg-white/8"
            >
              {r === 1 ? "Bình thường" : `${r}x`}
              {r === state.rate && <CheckIcon className="size-3.5 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Đang tải"
      className={cn(
        "block size-10 animate-spin rounded-full border-[3px] border-white/20 border-t-white",
        className,
      )}
    />
  );
}
