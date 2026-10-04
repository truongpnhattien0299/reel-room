import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { resolveInvitation } from "@/server/invitations";

export const metadata: Metadata = {
  title: "Lời mời",
  robots: { index: false, follow: false },
  // The token is in the URL: don't leak it to other sites.
  referrer: "same-origin",
};

const UNAVAILABLE = {
  registered: {
    title: "Đã có tài khoản",
    description: "Email được mời đã có tài khoản ReelRoom. Hãy đăng nhập.",
  },
  expired: {
    title: "Link mời đã hết hạn",
    description: "Nhờ quản trị viên gửi lại lời mời.",
  },
  invalid: {
    title: "Link không hợp lệ",
    description: "Link mời đã được dùng, bị thu hồi hoặc sai. Nhờ quản trị viên gửi lại lời mời.",
  },
};

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const resolved = await resolveInvitation(token);

  return (
    <AuthShell>
      {resolved.status === "ok" ? (
        <AcceptInviteForm token={token} email={resolved.invitation.email} />
      ) : (
        <>
          <AuthHeading {...UNAVAILABLE[resolved.status]} />
          <Link href="/login" className="text-sm underline underline-offset-4 hover:text-foreground">
            Đến trang đăng nhập
          </Link>
        </>
      )}
    </AuthShell>
  );
}
