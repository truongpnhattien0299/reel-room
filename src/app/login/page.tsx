import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Đăng nhập" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  // Only allow same-site relative redirects.
  const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (await getSession()) redirect(target);
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <LoginForm redirectTo={target} />
    </main>
  );
}
