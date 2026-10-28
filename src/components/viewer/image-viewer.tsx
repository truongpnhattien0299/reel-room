"use client";

import { DownloadIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MediaThumb } from "@/components/folders/media-thumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ignoreHotkey, useWindowKeydown } from "./hotkeys";
import { Spinner } from "./player/controls";

const MAX_SCALE = 8;
const STEP = 1.5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const SWIPE_PX = 60;

type Size = { w: number; h: number };
type View = { scale: number; x: number; y: number };
type Point = { x: number; y: number };
type Gesture =
  | { type: "pan"; start: Point; view: View }
  | { type: "pinch"; dist: number; mid: Point; view: View }
  | { type: "swipe"; start: Point };

const FIT: View = { scale: 1, x: 0, y: 0 };
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * A photo fitted to the stage (never upscaled), with wheel/pinch/double-tap
 * zoom, drag to pan, and a horizontal swipe to change file on touch screens.
 */
export function ImageViewer({
  file,
  src,
  downloadUrl,
  onPrev,
  onNext,
}: {
  file: { id: string; name: string; hasThumb: boolean; width: number | null; height: number | null };
  src: string;
  downloadUrl: string;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Size | null>(null);
  const [natural, setNatural] = useState<Size | null>(
    file.width && file.height ? { w: file.width, h: file.height } : null,
  );
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>(FIT);
  const [smooth, setSmooth] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ at: number; point: Point } | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setStage({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = stage && natural ? Math.min(1, stage.w / natural.w, stage.h / natural.h) : null;
  const box = fit && natural ? { w: natural.w * fit, h: natural.h * fit } : null;

  function clampView(v: View): View {
    if (!box || !stage) return v;
    const maxX = Math.max(0, (box.w * v.scale - stage.w) / 2);
    const maxY = Math.max(0, (box.h * v.scale - stage.h) / 2);
    return { scale: v.scale, x: clamp(v.x, -maxX, maxX), y: clamp(v.y, -maxY, maxY) };
  }

  /** Scales `from` around `p` (relative to the stage centre), keeping that point still. */
  function zoomed(from: View, scale: number, p: Point): View {
    const s = clamp(scale, 1, MAX_SCALE);
    const k = s / from.scale;
    return clampView({ scale: s, x: p.x - (p.x - from.x) * k, y: p.y - (p.y - from.y) * k });
  }

  function toStage(clientX: number, clientY: number): Point {
    const rect = stageRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }

  function animateTo(next: View) {
    setSmooth(true);
    setView(next);
  }

  function toggleZoom(p: Point) {
    animateTo(view.scale > 1 ? FIT : zoomed(view, DOUBLE_TAP_SCALE, p));
  }

  // React's wheel listener is passive; this one has to cancel page zoom/scroll.
  const onWheel = useRef<(e: WheelEvent) => void>(() => {});
  useEffect(() => {
    onWheel.current = (e) => {
      if (!loaded) return;
      e.preventDefault();
      // Trackpad pinches arrive as ctrl+wheel with small deltas.
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      setSmooth(false);
      setView((v) => zoomed(v, v.scale * factor, toStage(e.clientX, e.clientY)));
    };
  });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const listener = (e: WheelEvent) => onWheel.current(e);
    el.addEventListener("wheel", listener, { passive: false });
    return () => el.removeEventListener("wheel", listener);
  }, []);

  useWindowKeydown(loaded, (e) => {
    if (ignoreHotkey(e)) return;
    if (e.key === "+" || e.key === "=") animateTo(zoomed(view, view.scale * STEP, { x: 0, y: 0 }));
    else if (e.key === "-") animateTo(zoomed(view, view.scale / STEP, { x: 0, y: 0 }));
    else if (e.key === "0") animateTo(FIT);
    else return;
    e.preventDefault();
  });

  function startGesture(e: React.PointerEvent) {
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const [a, b] = pts;
      gesture.current = {
        type: "pinch",
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        mid: toStage((a.x + b.x) / 2, (a.y + b.y) / 2),
        view,
      };
    } else if (view.scale > 1) {
      gesture.current = { type: "pan", start: pts[0], view };
    } else if (e.pointerType !== "mouse") {
      gesture.current = { type: "swipe", start: pts[0] };
    } else {
      gesture.current = null;
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!loaded || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setSmooth(false);
    setDragging(true);
    startGesture(e);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.type === "pinch") {
      const [a, b] = [...pointers.current.values()];
      if (!b) return;
      const mid = toStage((a.x + b.x) / 2, (a.y + b.y) / 2);
      const next = zoomed(g.view, (g.view.scale * Math.hypot(a.x - b.x, a.y - b.y)) / g.dist, g.mid);
      setView(clampView({ ...next, x: next.x + mid.x - g.mid.x, y: next.y + mid.y - g.mid.y }));
    } else if (g.type === "pan") {
      setView(
        clampView({
          ...g.view,
          x: g.view.x + e.clientX - g.start.x,
          y: g.view.y + e.clientY - g.start.y,
        }),
      );
    } else {
      setSwipeX(e.clientX - g.start.x);
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const start = pointers.current.get(e.pointerId);
    if (!start) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;

    if (g?.type === "swipe") {
      const dx = e.clientX - g.start.x;
      const dy = e.clientY - g.start.y;
      setSmooth(true);
      setSwipeX(0);
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
        (dx > 0 ? onPrev : onNext)?.();
      } else if (Math.hypot(dx, dy) < 10) {
        onTap(e);
      }
    } else if (g?.type === "pan" && e.pointerType !== "mouse") {
      if (Math.hypot(e.clientX - g.start.x, e.clientY - g.start.y) < 10) onTap(e);
    }

    if (pointers.current.size > 0) startGesture(e);
    else {
      gesture.current = null;
      setDragging(false);
    }
  }

  // Touch double tap; mice get onDoubleClick.
  function onTap(e: React.PointerEvent) {
    const point = toStage(e.clientX, e.clientY);
    const prev = lastTap.current;
    if (prev && e.timeStamp - prev.at < DOUBLE_TAP_MS) {
      lastTap.current = null;
      toggleZoom(point);
    } else {
      lastTap.current = { at: e.timeStamp, point };
    }
  }

  if (failed) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          Trình duyệt không hiển thị được ảnh này. Hãy tải về để xem bằng ứng dụng khác.
        </p>
        <Button size="lg" nativeButton={false} render={<a href={downloadUrl} />}>
          <DownloadIcon data-icon="inline-start" />
          Tải về
        </Button>
      </div>
    );
  }

  const percent = fit ? Math.round(fit * view.scale * 100) : 100;

  return (
    <div
      ref={stageRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(e) => loaded && toggleZoom(toStage(e.clientX, e.clientY))}
      className={cn(
        "relative size-full touch-none overflow-hidden select-none",
        loaded &&
          (view.scale > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"),
      )}
    >
      <div
        className={cn(
          "absolute top-1/2 left-1/2 overflow-hidden",
          view.scale === 1 && "rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.6)]",
          smooth && "transition-transform duration-200 ease-out",
          !box && "invisible",
        )}
        style={
          box
            ? {
                width: box.w,
                height: box.h,
                marginLeft: -box.w / 2,
                marginTop: -box.h / 2,
                transform: `translate(${view.x + swipeX}px, ${view.y}px) scale(${view.scale})`,
              }
            : undefined
        }
      >
        {!loaded && (
          <MediaThumb
            id={file.id}
            hasThumb={file.hasThumb}
            className="absolute inset-0 blur-md"
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={file.name}
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            setNatural({ w: img.naturalWidth, h: img.naturalHeight });
            setLoaded(true);
          }}
          onError={() => setFailed(true)}
          className={cn(
            "relative size-full transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      {!loaded && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}

      {loaded && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-xl bg-stage/70 p-1 ring-1 ring-white/10 backdrop-blur-md"
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label="Thu nhỏ"
            aria-keyshortcuts="-"
            disabled={view.scale <= 1}
            onClick={() => animateTo(zoomed(view, view.scale / STEP, { x: 0, y: 0 }))}
          >
            <ZoomOutIcon />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Vừa khung"
            aria-keyshortcuts="0"
            onClick={() => animateTo(FIT)}
            className="min-w-14 font-mono text-xs"
          >
            {percent}%
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Phóng to"
            aria-keyshortcuts="+"
            disabled={view.scale >= MAX_SCALE}
            onClick={() => animateTo(zoomed(view, view.scale * STEP, { x: 0, y: 0 }))}
          >
            <ZoomInIcon />
          </Button>
        </div>
      )}
    </div>
  );
}
