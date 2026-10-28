"use client";

import { useState } from "react";
import { avatarUrl, initials } from "@/lib/avatar";
import { toneFor } from "@/lib/tones";
import { cn } from "@/lib/utils";

/** Profile picture, or initials on the user's tone when there is none (or it fails). */
export function UserAvatar({
  user,
  className,
}: {
  user: { id: string; name: string; image?: string | null };
  className?: string;
}) {
  const src = avatarUrl(user);
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = src !== null && failed !== src;

  return (
    <span
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold",
        className,
      )}
      style={showImage ? undefined : { background: toneFor(user.id).sky }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" onError={() => setFailed(src)} />
      ) : (
        <span aria-hidden="true">{initials(user.name)}</span>
      )}
    </span>
  );
}
