"use client";

import { EyeIcon, EyeOffIcon, KeyRoundIcon, LogOutIcon, MailIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/folders/confirm-dialog";
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
import { formatRelative } from "@/lib/format";
import { revokeUserSessions, sendPasswordReset, setUserPassword } from "@/server/actions";
import type { UserDetail } from "@/server/queries";

/** Password and sign-in: mail a reset link, set a password, end sessions. */
export function UserAccessCard({ user, self }: { user: UserDetail; self: boolean }) {
  const [pending, startTransition] = useTransition();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  return (
    <section
      aria-labelledby="access-heading"
      className="flex flex-col gap-4 rounded-[18px] bg-card p-5 ring-1 ring-border"
    >
      <div className="flex flex-col gap-1">
        <h2 id="access-heading" className="font-display text-lg font-semibold">
          Mật khẩu & đăng nhập
        </h2>
        <p className="text-sm text-muted-foreground">
          {user.activeSessions > 0
            ? `${user.activeSessions} phiên đang đăng nhập`
            : "Không có phiên nào đang đăng nhập"}
          {user.lastSignIn && ` · đăng nhập gần nhất ${formatRelative(user.lastSignIn)}`}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="justify-start"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await sendPasswordReset(user.id);
              if (res.error) toast.error(res.error);
              else toast.success(`Đã gửi email tới ${user.email}`);
            })
          }
        >
          <MailIcon data-icon="inline-start" />
          {user.activated ? "Gửi email đặt lại mật khẩu" : "Gửi lại email kích hoạt"}
        </Button>
        {!self && (
          <>
            <Button variant="outline" className="justify-start" onClick={() => setPasswordOpen(true)}>
              <KeyRoundIcon data-icon="inline-start" />
              Đặt mật khẩu mới
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              disabled={user.activeSessions === 0}
              onClick={() => setSignOutOpen(true)}
            >
              <LogOutIcon data-icon="inline-start" />
              Đăng xuất mọi thiết bị
            </Button>
          </>
        )}
      </div>
      {!self && (
        <>
          <SetPasswordDialog user={user} open={passwordOpen} onOpenChange={setPasswordOpen} />
          <ConfirmDialog
            open={signOutOpen}
            onOpenChange={setSignOutOpen}
            title="Đăng xuất mọi thiết bị?"
            description={`${user.name} sẽ phải đăng nhập lại trên mọi thiết bị.`}
            confirmLabel="Đăng xuất"
            onConfirm={async () => {
              const res = await revokeUserSessions(user.id);
              if (!res.error) toast.success("Đã đăng xuất mọi thiết bị");
              return res;
            }}
          />
        </>
      )}
    </section>
  );
}

function SetPasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(next) => {
        if (next) return;
        setPassword("");
        setVisible(false);
        setError(undefined);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await setUserPassword(user.id, password);
              if (res.error) return setError(res.error);
              toast.success("Đã đặt mật khẩu mới");
              onOpenChange(false);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Đặt mật khẩu mới</DialogTitle>
            <DialogDescription>
              Dùng khi chưa gửi được email. {user.name} sẽ bị đăng xuất khỏi mọi thiết bị; hãy gửi
              mật khẩu này cho họ qua kênh an toàn.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="new-password">Mật khẩu mới</FieldLabel>
            <div className="relative">
              <Input
                id="new-password"
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                maxLength={128}
                required
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                onClick={() => setVisible((v) => !v)}
                className="absolute top-1/2 right-1 -translate-y-1/2"
              >
                {visible ? <EyeOffIcon /> : <EyeIcon />}
              </Button>
            </div>
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={pending}>
              Đặt mật khẩu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
