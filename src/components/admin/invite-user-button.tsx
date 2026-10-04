"use client";

import { UserPlusIcon } from "lucide-react";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inviteUser } from "@/server/actions";

const ROLES = { user: "Member", admin: "Admin" } as const;

export function InviteUserButton() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<keyof typeof ROLES>("user");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button size="xl" className="font-semibold" onClick={() => setOpen(true)}>
        <UserPlusIcon data-icon="inline-start" />
        Mời user
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(undefined);
        }}
      >
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              startTransition(async () => {
                const res = await inviteUser({
                  name: String(form.get("name")),
                  email: String(form.get("email")),
                  role,
                });
                if (res.error) {
                  setError(res.error);
                  return;
                }
                toast.success("Đã gửi email mời");
                setOpen(false);
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Mời user</DialogTitle>
              <DialogDescription>
                User sẽ nhận email có link đặt mật khẩu (hết hạn sau 24 giờ).
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="invite-name">Tên</FieldLabel>
                <Input id="invite-name" name="name" required />
              </Field>
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
                Gửi lời mời
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
