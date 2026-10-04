"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type MenuAction = {
  label: string;
  icon: React.ComponentType;
  onClick: () => void;
  destructive?: boolean;
};

/**
 * Same actions on right-click (whole card) and on the "…" button, so the
 * menu is reachable by mouse, touch and keyboard alike.
 */
export function ItemWithMenu({
  actions,
  children,
  className,
  menuClassName,
}: {
  actions: MenuAction[];
  children: React.ReactNode;
  className?: string;
  /** Overrides where the "…" button sits (top-right by default). */
  menuClassName?: string;
}) {
  if (actions.length === 0) return <div className={className}>{children}</div>;
  return (
    <ContextMenu>
      <ContextMenuTrigger className={className}>
        {children}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Thao tác"
                className={cn("absolute top-2 right-2 rounded-[9px] bg-stage/75 text-foreground opacity-0 backdrop-blur-sm group-hover/item:opacity-100 hover:bg-stage/90 focus-visible:opacity-100 aria-expanded:bg-stage/90 aria-expanded:opacity-100 pointer-coarse:opacity-100", menuClassName)}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {actions.map((a) => (
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
      </ContextMenuTrigger>
      <ContextMenuContent>
        {actions.map((a) => (
          <ContextMenuItem
            key={a.label}
            variant={a.destructive ? "destructive" : "default"}
            onClick={a.onClick}
          >
            <a.icon />
            {a.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}
