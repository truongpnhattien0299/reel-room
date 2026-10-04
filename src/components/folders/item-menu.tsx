"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}: {
  actions: MenuAction[];
  children: React.ReactNode;
  className?: string;
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
                variant="secondary"
                size="icon-sm"
                aria-label="Thao tác"
                className="absolute top-2 right-2 opacity-0 shadow-sm group-hover/item:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100"
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
