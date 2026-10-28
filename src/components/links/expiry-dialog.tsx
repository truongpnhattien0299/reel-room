"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DEFAULT_EXPIRY, ExpiryPicker, expiryDate } from "@/components/folders/share-links";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { formatDateTime } from "@/lib/format";
import { updateShareLinkExpiry } from "@/server/actions";

export function ExpiryDialog({
  link,
  onOpenChange,
}: {
  link: { id: string; expiresAt: Date | null };
  onOpenChange: (open: boolean) => void;
}) {
  const [expiry, setExpiry] = useState(DEFAULT_EXPIRY);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function save() {
    const expiresAt = expiryDate(expiry);
    if (expiresAt === undefined) {
      setError("Chọn ngày hết hạn");
      return;
    }
    startTransition(async () => {
      const res = await updateShareLinkExpiry(link.id, expiresAt);
      if (res.error) return setError(res.error);
      toast.success("Đã đổi hạn link");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Đổi hạn link</DialogTitle>
          <DialogDescription>
            {link.expiresAt
              ? `Hạn hiện tại: ${formatDateTime(link.expiresAt)}. Hạn mới tính từ bây giờ.`
              : "Link này đang không hết hạn. Hạn mới tính từ bây giờ."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <ExpiryPicker value={expiry} onChange={setExpiry} disabled={pending} />
          {error && <FieldError>{error}</FieldError>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={save} disabled={pending}>
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
