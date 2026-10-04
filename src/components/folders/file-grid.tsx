"use client";

import { useState } from "react";
import { renameFile, trashFile } from "@/server/actions";
import type { FileItem } from "@/server/queries";
import { ConfirmDialog } from "./confirm-dialog";
import { FileCard } from "./file-card";
import { MediaPreview } from "./media-preview";
import { NameDialog } from "./name-dialog";

export function FileGrid({ files, canEdit }: { files: FileItem[]; canEdit: boolean }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<FileItem | null>(null);
  const [deleting, setDeleting] = useState<FileItem | null>(null);

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
        {files.map((f, i) => (
          <FileCard
            key={f.id}
            file={f}
            onOpen={() => setPreviewIndex(i)}
            onRename={canEdit ? () => setRenaming(f) : undefined}
            onDelete={canEdit ? () => setDeleting(f) : undefined}
          />
        ))}
      </div>

      <MediaPreview files={files} index={previewIndex} onIndexChange={setPreviewIndex} />

      {renaming && (
        <NameDialog
          open
          onOpenChange={(open) => !open && setRenaming(null)}
          title="Đổi tên file"
          submitLabel="Lưu"
          defaultValue={renaming.name}
          onSubmit={(name) => renameFile(renaming.id, name)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title={`Xoá “${deleting.name}”?`}
          description="File sẽ được chuyển vào thùng rác."
          confirmLabel="Xoá"
          onConfirm={() => trashFile(deleting.id)}
        />
      )}
    </>
  );
}
