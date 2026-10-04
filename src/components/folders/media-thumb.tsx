"use client";

import { PlayIcon } from "lucide-react";
import { useState } from "react";
import { formatDuration } from "@/lib/format";
import { thumbUrl } from "@/lib/media";
import { toneFor } from "@/lib/tones";
import { cn } from "@/lib/utils";

/**
 * A file's thumbnail, or a muted "contact sheet" tile when there is none
 * (formats the browser couldn't decode, or a thumb that failed to load).
 */
export function MediaThumb({
  id,
  hasThumb,
  className,
  imgClassName,
}: {
  id: string;
  hasThumb: boolean;
  className?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (hasThumb && !failed) {
    return (
      // Plain <img>: the source redirects to a signed R2 URL, nothing to optimize.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbUrl(id)}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cn("size-full object-cover", className, imgClassName)}
      />
    );
  }
  return <ToneTile seed={id} className={className} />;
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
  className,
}: {
  durationMs: number | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full bg-stage/75 py-1 pr-2 pl-1.5 font-mono text-[11px] leading-none text-foreground backdrop-blur-sm",
        durationMs === null && "pr-1.5",
        className,
      )}
    >
      <PlayIcon className="size-3 fill-current" aria-hidden="true" />
      {durationMs !== null && formatDuration(durationMs)}
      <span className="sr-only">Video</span>
    </span>
  );
}
