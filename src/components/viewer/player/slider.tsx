"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Horizontal slider for the seek bar and volume: a thin track that thickens
 * on hover, an optional buffered layer, and a time/value tooltip.
 */
export function Slider({
  value,
  max,
  buffered,
  step,
  label,
  valueText,
  formatTip,
  onChange,
  className,
}: {
  value: number;
  max: number;
  buffered?: number;
  /** Arrow-key step, in the same unit as `value`. */
  step: number;
  label: string;
  valueText: string;
  /** Tooltip over the hovered/dragged position; none when omitted. */
  formatTip?: (value: number) => string;
  onChange: (value: number) => void;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const shown = dragValue ?? value;
  const pct = (n: number) => (max > 0 ? `${Math.min(100, Math.max(0, (n / max) * 100))}%` : "0%");

  function valueAt(clientX: number) {
    const rect = trackRef.current!.getBoundingClientRect();
    return (Math.min(Math.max(clientX - rect.left, 0), rect.width) / rect.width) * max;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const next =
      e.key === "ArrowLeft" || e.key === "ArrowDown"
        ? value - step
        : e.key === "ArrowRight" || e.key === "ArrowUp"
          ? value + step
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? max
              : null;
    if (next === null) return;
    e.preventDefault();
    onChange(Math.min(max, Math.max(0, next)));
  }

  const tipAt = dragValue ?? hover;

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(shown * 100) / 100}
      aria-valuetext={valueText}
      data-dragging={dragValue !== null || undefined}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        if (e.button !== 0 || max <= 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const v = valueAt(e.clientX);
        setDragValue(v);
        onChange(v);
      }}
      onPointerMove={(e) => {
        if (max <= 0) return;
        const v = valueAt(e.clientX);
        if (e.pointerType === "mouse") setHover(v);
        if (dragValue !== null) {
          setDragValue(v);
          onChange(v);
        }
      }}
      onPointerUp={() => setDragValue(null)}
      onPointerCancel={() => setDragValue(null)}
      onPointerLeave={() => setHover(null)}
      className={cn(
        "group/slider relative flex h-5 cursor-pointer touch-none items-center outline-none",
        className,
      )}
    >
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20 transition-[height] group-hover/slider:h-1.5 group-focus-visible/slider:h-1.5 group-data-dragging/slider:h-1.5">
        {buffered !== undefined && (
          <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: pct(buffered) }} />
        )}
        <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: pct(shown) }} />
      </div>
      <span
        aria-hidden="true"
        className="absolute size-3 -translate-x-1/2 scale-0 rounded-full bg-white shadow transition-transform group-hover/slider:scale-100 group-focus-visible/slider:scale-100 group-focus-visible/slider:ring-2 group-focus-visible/slider:ring-ring group-data-dragging/slider:scale-100"
        style={{ left: pct(shown) }}
      />
      {formatTip && tipAt !== null && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-md bg-stage/90 px-1.5 py-0.5 font-mono text-[11px] text-foreground ring-1 ring-white/10"
          style={{ left: pct(tipAt) }}
        >
          {formatTip(tipAt)}
        </span>
      )}
    </div>
  );
}
