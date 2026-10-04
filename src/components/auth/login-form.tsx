"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { AuthHeading } from "./auth-shell";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(undefined);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setPending(false);
      setError(error.status === 401 ? "Sai email hoặc mật khẩu" : error.message);
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <>
      <AuthHeading title="Đăng nhập" description="Dùng tài khoản công ty do admin cấp." />
      <form onSubmit={onSubmit}>
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="ten@congty.com"
              className="h-12 rounded-xl px-3.5 text-[15px]"
              required
            />
          </Field>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="password">Mật khẩu</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="h-12 rounded-xl px-3.5 text-[15px]"
              required
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>
          <Button type="submit" size="xl" className="mt-1 h-12 text-[15px] font-semibold" disabled={pending}>
            {pending ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
        </FieldGroup>
      </form>
      <p className="border-t border-[#1f2229] pt-5 text-[13px] text-muted-foreground">
        Chưa có tài khoản? Nhờ quản trị viên gửi link mời. Quên mật khẩu? Liên hệ quản trị viên.
      </p>
    </>
  );
}
