"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setUserRole, updateUserProfile } from "@/server/actions";
import type { UserDetail } from "@/server/queries";

const ROLES = { user: "Member", admin: "Admin" } as const;
type Role = keyof typeof ROLES;

export function UserProfileForm({ user, self }: { user: UserDetail; self: boolean }) {
  const initialRole: Role = user.role === "admin" ? "admin" : "user";
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<Role>(initialRole);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const profileChanged = name.trim() !== user.name || email.trim().toLowerCase() !== user.email;
  const roleChanged = role !== initialRole;

  return (
    <form
      aria-labelledby="profile-heading"
      className="flex flex-col gap-5 rounded-[18px] bg-card p-5 ring-1 ring-border"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          if (profileChanged) {
            const res = await updateUserProfile(user.id, { name, email });
            if (res.error) return setError(res.error);
          }
          if (roleChanged) {
            const res = await setUserRole(user.id, role);
            if (res.error) return setError(res.error);
          }
          setError(undefined);
          toast.success("Đã lưu thay đổi");
        });
      }}
    >
      <h2 id="profile-heading" className="font-display text-lg font-semibold">
        Thông tin
      </h2>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="user-name">Tên</FieldLabel>
          <Input
            id="user-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="user-email">Email</FieldLabel>
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <FieldDescription>Email dùng để đăng nhập và nhận link đặt mật khẩu.</FieldDescription>
        </Field>
        <Field data-disabled={self ? true : undefined}>
          <FieldLabel>Vai trò</FieldLabel>
          <Select
            items={ROLES}
            value={role}
            disabled={self}
            onValueChange={(v) => v && setRole(v as Role)}
          >
            <SelectTrigger aria-label="Vai trò" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>
            {self
              ? "Bạn không thể tự đổi vai trò của mình."
              : "Admin xem và quản lý được mọi folder, và quản lý user."}
          </FieldDescription>
        </Field>
        {error && <FieldError>{error}</FieldError>}
      </FieldGroup>
      <div className="flex justify-end gap-2">
        {(profileChanged || roleChanged) && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setName(user.name);
              setEmail(user.email);
              setRole(initialRole);
              setError(undefined);
            }}
          >
            Huỷ
          </Button>
        )}
        <Button type="submit" disabled={pending || !(profileChanged || roleChanged)}>
          Lưu
        </Button>
      </div>
    </form>
  );
}
