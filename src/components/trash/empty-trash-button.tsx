"use client";

import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/folders/confirm-dialog";
import { Button } from "@/components/ui/button";
import { emptyTrash } from "@/server/actions";

/**
 * Permanently deletes every item the user may manage. `asOf` is when the page
 * was rendered: anything trashed after that (elsewhere) stays.
 */
export function EmptyTrashButton({ count, kept, asOf }: { count: number; kept: number; asOf: Date }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="lg"
        className="rounded-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon data-icon="inline-start" />
        Dọn sạch thùng rác
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Dọn sạch thùng rác?"
        description={`${count} mục sẽ bị xoá vĩnh viễn khỏi hệ thống. Không thể hoàn tác.${
          kept ? ` ${kept} mục bạn không có quyền xoá sẽ được giữ lại.` : ""
        }`}
        confirmLabel="Dọn sạch"
        onConfirm={async () => {
          const res = await emptyTrash(asOf);
          if (!res.error) toast.success(`Đã xoá vĩnh viễn ${res.data ?? 0} mục`);
          return res;
        }}
      />
    </>
  );
}
