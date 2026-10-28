"use client";

import { useState } from "react";
import { startZipDownload } from "@/components/download-progress";
import type { FolderRole } from "@/db/schema";
import { renameFolder, trashFolder } from "@/server/actions";
import type { FolderStats } from "@/server/queries";
import { ConfirmDialog } from "./confirm-dialog";
import { FolderCard, SubfolderCard } from "./folder-card";
import { useMediaUrls } from "./media-urls";
import { MoveDialog } from "./move-dialog";
import { NameDialog } from "./name-dialog";
import { ShareDialog } from "./share-dialog";

type GridFolder = { id: string; name: string; role: FolderRole } & FolderStats;

const can = {
  rename: (role: FolderRole) => role !== "viewer",
  // Top-level folders stay put: their own grants make up a shared space.
  move: (role: FolderRole, isRoot: boolean) => !isRoot && role !== "viewer",
  // Editors may hand out public links; only owners manage members.
  share: (role: FolderRole) => role !== "viewer",
  // Top-level folders are shared spaces, so only owners may remove them.
  delete: (role: FolderRole, isRoot: boolean) => (isRoot ? role === "owner" : role !== "viewer"),
};

export function FolderGrid({
  folders,
  isRoot,
  parentId,
  currentUserId,
}: {
  folders: GridFolder[];
  isRoot: boolean;
  /** The folder these subfolders sit in (none for library roots). */
  parentId?: string;
  currentUserId: string;
}) {
  const [renaming, setRenaming] = useState<GridFolder | null>(null);
  const [moving, setMoving] = useState<GridFolder | null>(null);
  const urls = useMediaUrls();
  const [sharing, setSharing] = useState<GridFolder | null>(null);
  const [deleting, setDeleting] = useState<GridFolder | null>(null);
  // Library roots get cover cards; subfolders inside a folder get compact rows.
  const Card = isRoot ? FolderCard : SubfolderCard;

  return (
    <>
      <div
        className={
          isRoot
            ? "grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5"
            : "grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3"
        }
      >
        {folders.map((f) => (
          <Card
            key={f.id}
            folder={f}
            onRename={can.rename(f.role) ? () => setRenaming(f) : undefined}
            onMove={parentId && can.move(f.role, isRoot) ? () => setMoving(f) : undefined}
            onShare={can.share(f.role) ? () => setSharing(f) : undefined}
            onDownload={() => void startZipDownload(urls.zip, { folderId: f.id }, `${f.name}.zip`)}
            onDelete={can.delete(f.role, isRoot) ? () => setDeleting(f) : undefined}
          />
        ))}
      </div>

      {renaming && (
        <NameDialog
          open
          onOpenChange={(open) => !open && setRenaming(null)}
          title="Đổi tên folder"
          submitLabel="Lưu"
          defaultValue={renaming.name}
          onSubmit={(name) => renameFolder(renaming.id, name)}
        />
      )}
      {moving && parentId && (
        <MoveDialog
          open
          onOpenChange={(open) => !open && setMoving(null)}
          items={{ kind: "folder", id: moving.id, name: moving.name }}
          sourceFolderId={parentId}
        />
      )}
      {sharing && (
        <ShareDialog
          open
          onOpenChange={(open) => !open && setSharing(null)}
          folder={sharing}
          role={sharing.role}
          currentUserId={currentUserId}
        />
      )}
      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title={`Xoá “${deleting.name}”?`}
          description="Folder, toàn bộ folder con và file bên trong sẽ được chuyển vào thùng rác."
          confirmLabel="Xoá"
          onConfirm={() => trashFolder(deleting.id)}
        />
      )}
    </>
  );
}
