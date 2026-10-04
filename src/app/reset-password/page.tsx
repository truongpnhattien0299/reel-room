import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Đặt mật khẩu" };

export default async function ResetPasswordPage(props: PageProps<"/reset-password">) {
  const { token, error } = await props.searchParams;
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      {typeof token === "string" && !error ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Link không hợp lệ</CardTitle>
            <CardDescription>
              Link đặt mật khẩu đã hết hạn hoặc đã được dùng. Nhờ admin gửi lại lời mời, hoặc{" "}
              <Link href="/login" className="underline">
                quay lại đăng nhập
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </main>
  );
}
