"use client";

import { FolderCard } from "@/components/folders/folder-card";
import { FileGrid } from "@/components/folders/file-grid";
import { SectionHeading } from "@/components/page-header";
import type { Favorites } from "@/server/favorites";
import { useFavorites } from "./favorites-provider";

/**
 * The favorites page body. Unstarring hides the item at once (the list is
 * filtered by the live stars, not refetched).
 */
export function FavoritesView({ favorites, empty }: { favorites: Favorites; empty: React.ReactNode }) {
  const stars = useFavorites();
  const folders = favorites.folders.filter((f) => stars?.isFavorite("folder", f.id) ?? true);
  const files = favorites.files.filter((f) => stars?.isFavorite("file", f.id) ?? true);

  if (folders.length === 0 && files.length === 0) return empty;
  return (
    <>
      {folders.length > 0 && (
        <section aria-labelledby="fav-folders-h" className="flex flex-col gap-4">
          <SectionHeading id="fav-folders-h">Folder</SectionHeading>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
            {folders.map((f) => (
              <FolderCard key={f.id} folder={f} />
            ))}
          </div>
        </section>
      )}
      {files.length > 0 && (
        <section aria-labelledby="fav-files-h" className="flex flex-col gap-4">
          <SectionHeading id="fav-files-h">File</SectionHeading>
          <FileGrid files={files} canEdit={false} folderName="Yêu thích" />
        </section>
      )}
    </>
  );
}
