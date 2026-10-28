"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/password-input";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { formatDateTime } from "@/lib/format";
import { updateShareLink } from "@/server/actions";

export type LinkSetting = "expiry" | "password";

/** Changes a link's expiry or sets its password. */
export function LinkSettingsDialog({
  link,
  setting,
  onOpenChange,
}: {
  link: { id: string; expiresAt: Date | null; hasPassword: boolean };
  setting: LinkSetting;
  onOpenChange: (open: boolean) => void;
}) {
  const [expiry, setExpiry] = useState(DEFAULT_EXPIRY);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    let input: Parameters<typeof updateShareLink>[1];
    if (setting === "expiry") {
      const expiresAt = expiryDate(expiry);
      if (expiresAt === undefined) return setError("Chọn ngày hết hạn");
      input = { expiresAt };
    } else {
      input = { password };
    }
    startTransition(async () => {
      const res = await updateShareLink(link.id, input);
      if (res.error) return setError(res.error);
      toast.success(setting === "expiry" ? "Đã đổi hạn link" : "Đã lưu mật khẩu");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {setting === "expiry" ? "Đổi hạn link" : link.hasPassword ? "Đổi mật khẩu" : "Đặt mật khẩu"}
            </DialogTitle>
            <DialogDescription>
              {setting === "password"
                ? link.hasPassword
                  ? "Người đã mở link sẽ phải nhập mật khẩu mới."
                  : "Người mở link phải nhập mật khẩu này mới xem được."
                : link.expiresAt
                  ? `Hạn hiện tại: ${formatDateTime(link.expiresAt)}. Hạn mới tính từ bây giờ.`
                  : "Link này đang không hết hạn. Hạn mới tính từ bây giờ."}
            </DialogDescription>
          </DialogHeader>
          {setting === "expiry" ? (
            <div className="flex flex-col gap-2">
              <ExpiryPicker value={expiry} onChange={setExpiry} disabled={pending} />
              {error && <FieldError>{error}</FieldError>}
            </div>
          ) : (
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="new-link-password">Mật khẩu</FieldLabel>
              <PasswordInput
                id="new-link-password"
                autoComplete="new-password"
                minLength={4}
                maxLength={128}
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
              />
              {error ? (
                <FieldError>{error}</FieldError>
              ) : (
                <FieldDescription>Tối thiểu 4 ký tự. Gửi cho người nhận qua kênh khác với link.</FieldDescription>
              )}
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={pending}>
              Lưu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
