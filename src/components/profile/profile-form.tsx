"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateMyName } from "@/server/actions";

export function ProfileForm({
  user,
}: {
  user: { name: string; email: string; isAdmin: boolean };
}) {
  const [name, setName] = useState(user.name);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const changed = name.trim() !== user.name;

  return (
    <form
      aria-labelledby="profile-heading"
      className="flex flex-col gap-5 rounded-[18px] bg-card p-5 ring-1 ring-border"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await updateMyName(name);
          if (res.error) return setError(res.error);
          setError(undefined);
          toast.success("Đã lưu tên");
        });
      }}
    >
      <h2 id="profile-heading" className="font-display text-lg font-semibold">
        Thông tin
      </h2>
      <FieldGroup>
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="profile-name">Tên hiển thị</FieldLabel>
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            autoComplete="name"
          />
          {error && <FieldError>{error}</FieldError>}
        </Field>
        <Field data-disabled>
          <FieldLabel htmlFor="profile-email">Email</FieldLabel>
          <Input id="profile-email" value={user.email} readOnly disabled />
        </Field>
        <Field data-disabled>
          <FieldLabel htmlFor="profile-role">Vai trò</FieldLabel>
          <Input id="profile-role" value={user.isAdmin ? "Admin" : "Member"} readOnly disabled />
          <FieldDescription>Liên hệ admin để đổi email hoặc vai trò.</FieldDescription>
        </Field>
      </FieldGroup>
      <div className="flex justify-end gap-2">
        {changed && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setName(user.name);
              setError(undefined);
            }}
          >
            Huỷ
          </Button>
        )}
        <Button type="submit" disabled={pending || !changed}>
          Lưu
        </Button>
      </div>
    </form>
  );
}
