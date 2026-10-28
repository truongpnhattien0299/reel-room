"use client";

import { MusicIcon, PlayIcon } from "lucide-react";
import { useState } from "react";
import { formatDuration } from "@/lib/format";
import type { MediaKind } from "@/lib/media";
import { toneFor } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { useMediaUrls } from "./media-urls";

/**
 * A file's thumbnail, or a muted "contact sheet" tile when there is none
 * (formats the browser couldn't decode, or a thumb that failed to load).
 * Audio never has a picture: it gets the tile with a note on it.
 */
export function MediaThumb({
  id,
  hasThumb,
  kind,
  className,
  imgClassName,
}: {
  id: string;
  hasThumb: boolean;
  kind?: MediaKind;
  className?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  const urls = useMediaUrls();
  if (hasThumb && !failed) {
    return (
      // Plain <img>: the source redirects to a signed R2 URL, nothing to optimize.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={urls.thumb(id)}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cn("size-full object-cover", className, imgClassName)}
      />
    );
  }
  if (kind === "audio") return <AudioTile seed={id} className={className} />;
  return <ToneTile seed={id} className={className} />;
}

/** Stand-in artwork for an audio file. */
export function AudioTile({
  seed,
  className,
  iconClassName,
}: {
  seed: string;
  className?: string;
  iconClassName?: string;
}) {
  const tone = toneFor(seed);
  return (
    <span
      aria-hidden="true"
      className={cn("flex size-full items-center justify-center", className)}
      style={{ background: `linear-gradient(160deg, ${tone.sky}, ${tone.ground})` }}
    >
      <MusicIcon className={cn("size-[28%] max-h-12 max-w-12 text-white/70", iconClassName)} />
    </span>
  );
}

/** Flat two-tone tile standing in for a picture. */
export function ToneTile({ seed, className }: { seed: string; className?: string }) {
  const tone = toneFor(seed);
  return (
    <span
      aria-hidden="true"
      className={cn("relative block size-full overflow-hidden", className)}
      style={{ background: tone.sky }}
    >
      <span className="absolute top-[22%] left-[24%] size-[18%] max-h-7 max-w-7 rounded-full bg-white/20" />
      <span className="absolute inset-x-0 bottom-0 h-[37%]" style={{ background: tone.ground }} />
    </span>
  );
}

export function DurationBadge({
  durationMs,
  kind = "video",
  className,
}: {
  durationMs: number | null;
  kind?: "video" | "audio";
  className?: string;
}) {
  const Icon = kind === "audio" ? MusicIcon : PlayIcon;
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full bg-stage/75 py-1 pr-2 pl-1.5 font-mono text-[11px] leading-none text-foreground backdrop-blur-sm",
        durationMs === null && "pr-1.5",
        className,
      )}
    >
      <Icon className={cn("size-3", kind === "video" && "fill-current")} aria-hidden="true" />
      {durationMs !== null && formatDuration(durationMs)}
      <span className="sr-only">{kind === "audio" ? "Audio" : "Video"}</span>
    </span>
  );
}
