"use client";

import { StarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type FavoriteKind, useFavorites } from "./favorites-provider";

export const favoriteLabel = (on: boolean) => (on ? "Bỏ yêu thích" : "Thêm vào yêu thích");

/** A filled star when starred; renders nothing where there are no favorites. */
export function StarMark({ on, className }: { on: boolean; className?: string }) {
  return (
    <StarIcon
      aria-hidden="true"
      className={cn(on && "fill-primary text-primary", className)}
    />
  );
}

/**
 * Star toggle for a card or the viewer. On cards it shows on hover or focus,
 * and stays visible once starred.
 */
export function FavoriteButton({
  kind,
  id,
  variant = "card",
  className,
}: {
  kind: FavoriteKind;
  id: string;
  variant?: "card" | "toolbar";
  className?: string;
}) {
  const favorites = useFavorites();
  if (!favorites) return null;
  const on = favorites.isFavorite(kind, id);
  return (
    <Button
      variant={variant === "card" ? "ghost" : "outline"}
      size={variant === "card" ? "icon" : "icon-xl"}
      aria-label={favoriteLabel(on)}
      aria-pressed={on}
      title={variant === "toolbar" ? `${favoriteLabel(on)} (S)` : undefined}
      onClick={(e) => {
        // Cards are links or buttons themselves.
        e.preventDefault();
        e.stopPropagation();
        favorites.toggle(kind, id);
      }}
      className={cn(
        variant === "card" &&
          "rounded-[9px] bg-stage/75 text-foreground backdrop-blur-sm hover:bg-stage/90 focus-visible:opacity-100",
        variant === "card" && !on && "opacity-0 group-hover/item:opacity-100 pointer-coarse:hidden",
        className,
      )}
    >
      <StarMark on={on} />
    </Button>
  );
}
