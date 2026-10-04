"use client";

import { UsersIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShareDialog } from "./share-dialog";

export function ShareButton({
  folder,
  currentUserId,
}: {
  folder: { id: string; name: string };
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UsersIcon data-icon="inline-start" />
        Chia sẻ
      </Button>
      {open && (
        <ShareDialog
          open
          onOpenChange={setOpen}
          folder={folder}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}
