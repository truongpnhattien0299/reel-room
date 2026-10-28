"use client";

import { LockIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { unlockShareLink } from "@/server/actions";

/** Asks for a link's password; on success the action refreshes into the shared page. */
export function PasswordGate({ token }: { token: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    startTransition(async () => {
      const res = await unlockShareLink(token, password);
      setError(res.error);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-sm flex-col gap-5 rounded-[18px] bg-card p-6 ring-1 ring-border"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-muted [&_svg]:size-6">
          <LockIcon aria-hidden="true" />
        </span>
        <h1 className="font-display text-xl font-semibold">Link có mật khẩu</h1>
        <p className="text-sm text-muted-foreground">Nhập mật khẩu người gửi link đưa cho bạn để xem.</p>
      </div>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="password">Mật khẩu</FieldLabel>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="off"
          autoFocus
          required
          className="h-12 rounded-xl px-3.5 text-[15px]"
          aria-invalid={error ? true : undefined}
        />
        {error && <FieldError>{error}</FieldError>}
      </Field>
      <Button type="submit" size="xl" className="h-12 text-[15px] font-semibold" disabled={pending}>
        {pending ? "Đang kiểm tra…" : "Mở link"}
      </Button>
    </form>
  );
}
