"use client";

import { type RefObject, useEffect, useMemo, useState } from "react";

export type MediaState = {
  playing: boolean;
  /** Seconds. */
  currentTime: number;
  /** Seconds; 0 until the metadata is in. */
  duration: number;
  /** End of the buffered range around the playhead, in seconds. */
  buffered: number;
  volume: number;
  muted: boolean;
  rate: number;
  /** Playing, but stalled for data. */
  waiting: boolean;
  ended: boolean;
  error: boolean;
};

export type MediaControls = {
  toggle: () => void;
  seek: (seconds: number) => void;
  seekBy: (delta: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setRate: (rate: number) => void;
};

export const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

const INITIAL: MediaState = {
  playing: false,
  currentTime: 0,
  duration: 0,
  buffered: 0,
  volume: 1,
  muted: false,
  rate: 1,
  waiting: false,
  ended: false,
  error: false,
};

const EVENTS = [
  "play",
  "pause",
  "playing",
  "timeupdate",
  "durationchange",
  "loadedmetadata",
  "progress",
  "volumechange",
  "ratechange",
  "waiting",
  "canplay",
  "seeking",
  "seeked",
  "ended",
  "error",
] as const;

// Volume, mute and speed carry over between files and visits.
const PREFS_KEY = "reelroom:player";
type Prefs = Pick<MediaState, "volume" | "muted" | "rate">;

function readPrefs(): Partial<Prefs> {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<Prefs>;
  } catch {
    return {};
  }
}

function writePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Private mode or blocked storage: the defaults are fine.
  }
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function bufferedEnd(el: HTMLMediaElement) {
  const { buffered, currentTime } = el;
  for (let i = 0; i < buffered.length; i++) {
    if (buffered.start(i) <= currentTime + 0.5 && currentTime <= buffered.end(i)) {
      return buffered.end(i);
    }
  }
  return 0;
}

function snapshot(el: HTMLMediaElement): MediaState {
  return {
    playing: !el.paused,
    currentTime: el.currentTime,
    duration: Number.isFinite(el.duration) ? el.duration : 0,
    buffered: bufferedEnd(el),
    volume: el.volume,
    muted: el.muted,
    rate: el.playbackRate,
    waiting: !el.paused && (el.seeking || el.readyState < HTMLMediaElement.HAVE_FUTURE_DATA),
    ended: el.ended,
    error: el.error !== null,
  };
}

/** State and controls of an `<audio>`/`<video>` drawn with our own UI. */
export function useMediaState(ref: RefObject<HTMLMediaElement | null>) {
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefs = readPrefs();
    if (typeof prefs.volume === "number") el.volume = clamp(prefs.volume, 0, 1);
    if (typeof prefs.muted === "boolean") el.muted = prefs.muted;
    if (typeof prefs.rate === "number" && RATES.includes(prefs.rate)) {
      el.defaultPlaybackRate = el.playbackRate = prefs.rate;
    }

    const sync = (e?: Event) => {
      setState(snapshot(el));
      if (e?.type === "volumechange" || e?.type === "ratechange") {
        writePrefs({ volume: el.volume, muted: el.muted, rate: el.playbackRate });
      }
    };
    // WebM straight from MediaRecorder (screen recordings) has no duration in
    // its header: seeking past the end makes the browser work it out.
    let probing = false;
    const probeDuration = () => {
      if (el.duration !== Infinity || probing) return;
      probing = true;
      el.currentTime = 1e101;
    };
    const probed = () => {
      if (!probing || !Number.isFinite(el.duration)) return;
      probing = false;
      el.currentTime = 0;
    };

    for (const type of EVENTS) el.addEventListener(type, sync);
    el.addEventListener("loadedmetadata", probeDuration);
    el.addEventListener("durationchange", probed);
    // Events that fired before we listened (a cached file loads fast).
    const frame = requestAnimationFrame(() => {
      if (el.readyState >= HTMLMediaElement.HAVE_METADATA) probeDuration();
      sync();
    });
    return () => {
      cancelAnimationFrame(frame);
      for (const type of EVENTS) el.removeEventListener(type, sync);
      el.removeEventListener("loadedmetadata", probeDuration);
      el.removeEventListener("durationchange", probed);
    };
  }, [ref]);

  const controls = useMemo<MediaControls>(() => {
    const seek = (seconds: number) => {
      const el = ref.current;
      if (!el || !Number.isFinite(el.duration)) return;
      el.currentTime = clamp(seconds, 0, el.duration);
    };
    return {
      toggle: () => {
        const el = ref.current;
        if (!el) return;
        // Autoplay can be refused; the button just stays on "play".
        if (el.paused || el.ended) void el.play().catch(() => {});
        else el.pause();
      },
      seek,
      seekBy: (delta) => seek((ref.current?.currentTime ?? 0) + delta),
      setVolume: (volume) => {
        const el = ref.current;
        if (!el) return;
        el.volume = clamp(volume, 0, 1);
        el.muted = el.volume === 0;
      },
      toggleMute: () => {
        const el = ref.current;
        if (!el) return;
        el.muted = !el.muted;
        if (!el.muted && el.volume === 0) el.volume = 0.5;
      },
      setRate: (rate) => {
        const el = ref.current;
        if (el) el.defaultPlaybackRate = el.playbackRate = rate;
      },
    };
  }, [ref]);

  return { state, controls };
}
