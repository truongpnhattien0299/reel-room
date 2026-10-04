"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

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
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Đặt mật khẩu</CardTitle>
        <CardDescription>Chọn mật khẩu cho tài khoản ReelRoom của bạn</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="password">Mật khẩu mới</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
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
                required
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
            <Button type="submit" disabled={pending}>
              {pending ? "Đang lưu…" : "Đặt mật khẩu"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
