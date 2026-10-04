"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Path on this site → absolute URL to hand out. Client-only. */
export const absoluteUrl = (path: string) => `${window.location.origin}${path}`;

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard access can be refused (e.g. no recent user gesture).
    return false;
  }
}

/** `copied` holds the last copied text for a moment, to flip the icon. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return {
    copied,
    copy: async (text: string) => {
      if (await copyText(text)) setCopied(text);
      else toast.error("Không sao chép được, hãy copy link thủ công");
    },
  };
}

/** Read-only link with a copy button. Client-only: shown once a link is created. */
export function CopyLinkField({ path, label = "Link" }: { path: string; label?: string }) {
  const { copied, copy } = useCopy();
  const url = absoluteUrl(path);
  return (
    <div className="flex gap-2">
      <Input
        readOnly
        value={url}
        aria-label={label}
        className="font-mono text-xs"
        onFocus={(e) => e.currentTarget.select()}
      />
      <Button onClick={() => copy(url)}>
        {copied === url ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
        {copied === url ? "Đã chép" : "Sao chép"}
      </Button>
    </div>
  );
}
