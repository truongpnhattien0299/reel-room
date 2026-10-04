"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { AuthHeading } from "./auth-shell";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get("password"));
    if (newPassword !== String(form.get("confirm"))) {
      setError("Hai mật khẩu không khớp");
      return;
    }
    setPending(true);
    setError(undefined);
    const { error } = await authClient.resetPassword({ newPassword, token });
    if (error) {
      setPending(false);
      setError(error.message ?? "Không đặt được mật khẩu");
      return;
    }
    toast.success("Đã đặt mật khẩu. Mời bạn đăng nhập.");
    router.replace("/login");
  }

  return (
    <>
      <AuthHeading title="Đặt mật khẩu" description="Chọn mật khẩu cho tài khoản ReelRoom của bạn." />
      <form onSubmit={onSubmit}>
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="password">Mật khẩu mới</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              className="h-12 rounded-xl px-3.5 text-[15px]"
              required
            />
            <FieldDescription>Tối thiểu 8 ký tự</FieldDescription>
          </Field>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="confirm">Nhập lại mật khẩu</FieldLabel>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              className="h-12 rounded-xl px-3.5 text-[15px]"
              required
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Button type="submit" size="xl" className="mt-1 h-12 text-[15px] font-semibold" disabled={pending}>
            {pending ? "Đang lưu…" : "Đặt mật khẩu"}
          </Button>
        </FieldGroup>
      </form>
    </>
  );
}
