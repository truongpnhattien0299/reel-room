import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Đặt mật khẩu" };

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { token, error } = await props.searchParams;
  return (
    <AuthShell>
      {typeof token === "string" && !error ? (
        <ResetPasswordForm token={token} />
      ) : (
        <>
          <AuthHeading
            title="Link không hợp lệ"
            description="Link đặt mật khẩu đã hết hạn hoặc đã được dùng. Nhờ admin gửi lại lời mời."
          />
          <Link href="/login" className="text-sm underline underline-offset-4 hover:text-foreground">
            Quay lại đăng nhập
          </Link>
        </>
      )}
    </AuthShell>
  );
}
