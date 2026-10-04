"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { acceptInvite } from "@/server/actions";
import { AuthHeading } from "./auth-shell";
import { PasswordInput } from "./password-input";

const inputClass = "h-12 rounded-xl px-3.5 text-[15px]";

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) {
      setError("Hai mật khẩu không khớp");
      return;
    }
    startTransition(async () => {
      // On success the action signs the user in and redirects home.
      const res = await acceptInvite({ token, name: String(form.get("name")), password });
      setError(res.error);
    });
  }

  return (
    <>
      <AuthHeading
        title="Tạo tài khoản"
        description="Bạn được mời vào ReelRoom. Nhập tên và chọn mật khẩu để bắt đầu."
      />
      <form onSubmit={onSubmit}>
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" value={email} readOnly disabled className={inputClass} />
          </Field>
          <Field>
            <FieldLabel htmlFor="name">Tên</FieldLabel>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              maxLength={100}
              className={inputClass}
              required
              autoFocus
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Mật khẩu</FieldLabel>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              className={inputClass}
              required
            />
            <FieldDescription>Tối thiểu 8 ký tự</FieldDescription>
          </Field>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="confirm">Nhập lại mật khẩu</FieldLabel>
            <PasswordInput
              id="confirm"
              name="confirm"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              className={inputClass}
              required
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Button type="submit" size="xl" className="mt-1 h-12 text-[15px] font-semibold" disabled={pending}>
            {pending ? "Đang tạo…" : "Tạo tài khoản"}
          </Button>
        </FieldGroup>
      </form>
    </>
  );
}
