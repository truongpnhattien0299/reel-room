"use client";

import { MoreHorizontalIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { MenuAction } from "./item-menu";

export type ToolbarAction = MenuAction & {
  /** Stays a button on phones; the others fold into the "…" menu there. */
  primary?: boolean;
};

/** Floating bar over a list while picking items: count, actions, exit. */
export function SelectionToolbar({
  count,
  actions,
  onExit,
  label = "File đã chọn",
  exitLabel = "Thoát chế độ chọn",
}: {
  count: number;
  actions: ToolbarAction[];
  onExit: () => void;
  label?: string;
  exitLabel?: string;
}) {
  const secondary = actions.filter((a) => !a.primary);
  return (
    <div
      role="toolbar"
      aria-label={label}
      className="fixed bottom-5 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1.5 rounded-2xl bg-popover py-2 pr-2 pl-4 shadow-[0_24px_60px_rgba(0,0,0,0.5)] ring-1 ring-[#2a2e37] sm:bottom-8 sm:gap-2"
    >
      <span className="pr-1 text-sm whitespace-nowrap sm:pr-2">
        <span className="font-mono font-semibold">{count}</span>
        <span className="max-sm:sr-only"> đã chọn</span>
      </span>
      {actions.map((a) => (
        <Button
          key={a.label}
          size="lg"
          variant={a.destructive ? "destructive" : a.primary ? "default" : "outline"}
          disabled={count === 0}
          onClick={a.onClick}
          className={cn(!a.primary && "max-sm:hidden")}
        >
          <a.icon data-icon="inline-start" />
          {a.label}
        </Button>
      ))}
      {secondary.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={count === 0}
            render={<Button variant="outline" size="icon-lg" aria-label="Thêm thao tác" className="sm:hidden" />}
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            {secondary.map((a) => (
              <DropdownMenuItem
                key={a.label}
                variant={a.destructive ? "destructive" : "default"}
                onClick={a.onClick}
              >
                <a.icon />
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button variant="ghost" size="icon-lg" aria-label={exitLabel} onClick={onExit}>
        <XIcon />
      </Button>
    </div>
  );
}
