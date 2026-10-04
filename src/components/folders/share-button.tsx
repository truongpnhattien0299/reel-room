"use client";

import { UsersIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FolderRole } from "@/db/schema";
import { ShareDialog } from "./share-dialog";

export function ShareButton({
  folder,
  role,
  currentUserId,
}: {
  folder: { id: string; name: string };
  role: FolderRole;
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="xl" onClick={() => setOpen(true)}>
        <UsersIcon data-icon="inline-start" />
        Chia sẻ
      </Button>
      {open && (
        <ShareDialog
          open
          onOpenChange={setOpen}
          folder={folder}
          role={role}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}
