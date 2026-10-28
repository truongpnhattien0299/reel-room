"use client";

import { createContext, useContext, useState } from "react";
import { toast } from "sonner";
import { setFavorite } from "@/server/actions";
import type { FavoriteIds } from "@/server/favorites";

export type FavoriteKind = "file" | "folder";

type Favorites = {
  isFavorite: (kind: FavoriteKind, id: string) => boolean;
  toggle: (kind: FavoriteKind, id: string) => void;
};

const FavoritesContext = createContext<Favorites | null>(null);

/** The signed-in user's stars; null outside the app (public share pages have none). */
export const useFavorites = () => useContext(FavoritesContext);

/**
 * Holds the user's starred ids for the whole app. A star flips at once and
 * flips back if the server refuses.
 */
export function FavoritesProvider({ initial, children }: { initial: FavoriteIds; children: React.ReactNode }) {
  const [ids, setIds] = useState(() => ({ file: new Set(initial.files), folder: new Set(initial.folders) }));

  function flip(kind: FavoriteKind, id: string, on: boolean) {
    setIds((prev) => {
      const next = new Set(prev[kind]);
      if (on) next.add(id);
      else next.delete(id);
      return { ...prev, [kind]: next };
    });
  }

  const value: Favorites = {
    isFavorite: (kind, id) => ids[kind].has(id),
    toggle(kind, id) {
      const on = !ids[kind].has(id);
      flip(kind, id, on);
      void setFavorite(kind === "file" ? { fileId: id } : { folderId: id }, on).then((res) => {
        if (!res.error) return;
        flip(kind, id, !on);
        toast.error(res.error);
      });
    },
  };

  return <FavoritesContext value={value}>{children}</FavoritesContext>;
}
