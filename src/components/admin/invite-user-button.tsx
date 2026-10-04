"use client";

import { UserPlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { CopyLinkField } from "@/components/copy-link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invitePath } from "@/lib/media";
import { inviteUser } from "@/server/actions";

const ROLES = { user: "Member", admin: "Admin" } as const;

type Invited = { email: string; token: string; emailed: boolean };

export function InviteUserButton() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<keyof typeof ROLES>("user");
  const [error, setError] = useState<string>();
  const [invited, setInvited] = useState<Invited | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button size="xl" className="font-semibold" onClick={() => setOpen(true)}>
        <UserPlusIcon data-icon="inline-start" />
        Mời user
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={(next) => {
          if (next) return;
          setError(undefined);
          setInvited(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {invited ? (
            <InviteLink invited={invited} onDone={() => setOpen(false)} />
          ) : (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const email = String(new FormData(e.currentTarget).get("email"));
                startTransition(async () => {
                  const res = await inviteUser({ email, role });
                  if (res.error || !res.data) {
                    setError(res.error);
                    return;
                  }
                  setError(undefined);
                  setInvited({ email: email.trim().toLowerCase(), ...res.data });
                });
              }}
            >
              <DialogHeader>
                <DialogTitle>Mời user</DialogTitle>
                <DialogDescription>
                  Tạo link mời (hết hạn sau 7 ngày). Người được mời mở link, tự nhập tên và mật khẩu
                  để tạo tài khoản.
                </DialogDescription>
              </DialogHeader>
              <FieldGroup>
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                  <Input id="invite-email" name="email" type="email" required />
                  {error && <FieldError>{error}</FieldError>}
                </Field>
                <Field>
                  <FieldLabel>Vai trò</FieldLabel>
                  <Select
                    items={ROLES}
                    value={role}
                    onValueChange={(v) => v && setRole(v as keyof typeof ROLES)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Huỷ
                </Button>
                <Button type="submit" disabled={pending}>
                  Tạo link mời
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function InviteLink({ invited, onDone }: { invited: Invited; onDone: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Đã tạo link mời</DialogTitle>
        <DialogDescription>
          {invited.emailed ? (
            <>
              Đã gửi email tới <span className="text-foreground">{invited.email}</span>. Bạn cũng có thể
              gửi thẳng link này cho họ.
            </>
          ) : (
            <>
              Chưa gửi được email. Hãy gửi link này cho{" "}
              <span className="text-foreground">{invited.email}</span>.
            </>
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <CopyLinkField path={invitePath(invited.token)} label="Link mời" />
        <p className="text-xs text-muted-foreground">
          Link chỉ dùng được một lần, hết hạn sau 7 ngày. Xem lại hoặc thu hồi trong danh sách lời mời.
        </p>
      </div>
      <DialogFooter>
        <Button onClick={onDone}>Xong</Button>
      </DialogFooter>
    </>
  );
}
