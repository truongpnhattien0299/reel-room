import { cn } from "@/lib/utils";

/** The ReelRoom mark: a film reel on an amber tile. */
export function ReelMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
        className="size-[58%]"
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="7.5" r="1.6" />
        <circle cx="12" cy="16.5" r="1.6" />
        <circle cx="7.5" cy="12" r="1.6" />
        <circle cx="16.5" cy="12" r="1.6" />
      </svg>
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-xl font-bold tracking-[-0.02em]", className)}>
      ReelRoom
    </span>
  );
}
