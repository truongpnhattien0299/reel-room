"use client";

import { SearchIcon } from "lucide-react";
import Form from "next/form";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * GET form to /search?q=…; works without JS, navigates client-side with it.
 * The sidebar instance also answers ⌘K / Ctrl+K.
 */
export function SearchBox({
  size = "sm",
  shortcut = false,
  autoFocus = false,
  className,
}: {
  size?: "sm" | "lg";
  shortcut?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const current = useSearchParams().get("q") ?? "";
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  return (
    <Form action="/search" role="search" className={className}>
      <label
        className={cn(
          "flex items-center gap-2.5 rounded-[10px] bg-card text-muted-foreground ring-1 ring-[#262a32] transition-shadow focus-within:ring-2 focus-within:ring-ring",
          size === "sm" ? "h-10 px-3" : "h-14 rounded-2xl px-4 text-base",
        )}
      >
        <SearchIcon className={size === "sm" ? "size-4" : "size-5"} aria-hidden="true" />
        <span className="sr-only">Tìm kiếm</span>
        <input
          ref={input}
          // Remount when the URL's query changes so the box mirrors it.
          key={current}
          type="search"
          name="q"
          defaultValue={current}
          autoFocus={autoFocus}
          placeholder="Tìm ảnh, video, folder…"
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-[#8b919c] [&::-webkit-search-cancel-button]:hidden"
        />
        {shortcut && (
          <kbd className="hidden rounded-md px-1.5 py-0.5 font-mono text-[11px] ring-1 ring-[#2e323b] md:inline">
            ⌘K
          </kbd>
        )}
      </label>
    </Form>
  );
}
