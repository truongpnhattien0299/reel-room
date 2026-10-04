"use client";

import { FolderPlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createFolder } from "@/server/actions";
import { NameDialog } from "./name-dialog";

export function NewFolderButton({
  parentId,
  variant = "outline",
}: {
  parentId: string | null;
  variant?: "outline" | "default";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <FolderPlusIcon data-icon="inline-start" />
        Folder mới
      </Button>
      {open && (
        <NameDialog
          open
          onOpenChange={setOpen}
          title="Tạo folder mới"
          submitLabel="Tạo"
          onSubmit={(name) => createFolder(parentId, name)}
        />
      )}
    </>
  );
}
