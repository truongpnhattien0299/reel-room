"use client";

import { useEffect, useRef } from "react";
import { type MediaControls, RATES } from "./player/use-media-state";

/** Keys a focused control already handles itself, or that belong to text entry. */
export function ignoreHotkey(e: KeyboardEvent) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return true;
  const t = e.target;
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable || t.closest("input, textarea, select, [role=menu], [role=alertdialog]")) {
    return true;
  }
  if (t.getAttribute("role") === "slider" && e.key.startsWith("Arrow")) return true;
  if (t.closest("button, a") && (e.key === " " || e.key === "Enter")) return true;
  return false;
}

/**
 * Window listener in the capture phase: the dialog stops keydown from
 * bubbling up. The handler is read through a ref so callers needn't memoize.
 */
export function useWindowKeydown(enabled: boolean, handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => ref.current(e);
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);
}

/**
 * Viewer-wide keys. Shift+←/→ always step through files; plain arrows do too
 * on photos, while players keep them for seeking.
 */
export function useViewerHotkeys({
  enabled,
  arrowsNavigate,
  onPrev,
  onNext,
}: {
  enabled: boolean;
  arrowsNavigate: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  useWindowKeydown(enabled, (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (!e.shiftKey && !arrowsNavigate) return;
    if (ignoreHotkey(e)) return;
    const go = e.key === "ArrowLeft" ? onPrev : onNext;
    if (!go) return;
    e.preventDefault();
    go();
  });
}

/** YouTube-style keys for a player. */
export function usePlayerHotkeys(
  state: { volume: number; muted: boolean; rate: number },
  controls: MediaControls,
  onFullscreen?: () => void,
) {
  function stepRate(dir: 1 | -1) {
    const i = RATES.indexOf(state.rate);
    const from = i === -1 ? RATES.indexOf(1) : i;
    controls.setRate(RATES[Math.min(RATES.length - 1, Math.max(0, from + dir))]);
  }

  useWindowKeydown(true, (e) => {
    if (ignoreHotkey(e) || e.shiftKey) return;
    const actions: Record<string, () => void> = {
      " ": controls.toggle,
      k: controls.toggle,
      ArrowLeft: () => controls.seekBy(-5),
      ArrowRight: () => controls.seekBy(5),
      j: () => controls.seekBy(-10),
      l: () => controls.seekBy(10),
      ArrowUp: () => controls.setVolume((state.muted ? 0 : state.volume) + 0.1),
      ArrowDown: () => controls.setVolume((state.muted ? 0 : state.volume) - 0.1),
      m: controls.toggleMute,
      ",": () => stepRate(-1),
      ".": () => stepRate(1),
    };
    if (onFullscreen) actions.f = onFullscreen;
    const action = actions[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (!action) return;
    e.preventDefault();
    action();
  });
}
