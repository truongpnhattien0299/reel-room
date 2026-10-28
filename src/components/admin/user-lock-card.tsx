"use client";

import { LockIcon, LockOpenIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { lockUser, unlockUser } from "@/server/actions";
import type { UserDetail } from "@/server/queries";

/** Locking replaces deleting: the account and its uploads stay, sign-in doesn't. */
export function UserLockCard({ user }: { user: UserDetail }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <section
      aria-labelledby="lock-heading"
      className="flex flex-col gap-4 rounded-[18px] bg-card p-5 ring-1 ring-destructive/30"
    >
      <div className="flex flex-col gap-1">
        <h2 id="lock-heading" className="font-display text-lg font-semibold">
          {user.banned ? "Tài khoản đang bị khoá" : "Khoá tài khoản"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {user.banned
            ? user.banReason
              ? `Lý do: ${user.banReason}`
              : "Không đăng nhập được, link chia sẻ do user tạo đang ngừng hoạt động."
            : "User không đăng nhập được nữa. File và folder họ tạo vẫn giữ nguyên."}
        </p>
      </div>
      {user.banned ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await unlockUser(user.id);
              if (res.error) toast.error(res.error);
              else toast.success("Đã mở khoá tài khoản");
            })
          }
        >
          <LockOpenIcon data-icon="inline-start" />
          Mở khoá
        </Button>
      ) : (
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <LockIcon data-icon="inline-start" />
          Khoá tài khoản
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={(next) => {
          if (next) return;
          setReason("");
          setError(undefined);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await lockUser(user.id, reason);
                if (res.error) return setError(res.error);
                toast.success("Đã khoá tài khoản");
                setOpen(false);
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Khoá tài khoản {user.name}?</DialogTitle>
              <DialogDescription>
                User bị đăng xuất ngay và không đăng nhập lại được. Các link chia sẻ công khai họ tạo
                ngừng hoạt động cho tới khi mở khoá. File, folder và lịch sử upload vẫn giữ nguyên.
              </DialogDescription>
            </DialogHeader>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="lock-reason">Lý do (không bắt buộc)</FieldLabel>
              <Input
                id="lock-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
                placeholder="Ví dụ: đã nghỉ việc"
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Huỷ
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                Khoá tài khoản
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
