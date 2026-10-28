import type { Metadata } from "next";
import { PageHeader, PageShell } from "@/components/page-header";
import { AvatarEditor } from "@/components/profile/avatar-editor";
import { ProfileForm } from "@/components/profile/profile-form";
import { isAdmin, requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Hồ sơ của tôi" };

export default async function ProfilePage() {
  const session = await requireSession();
  const { id, name, email, image } = session.user;

  return (
    <PageShell>
      <PageHeader title="Hồ sơ của tôi" description="Tên và ảnh hiển thị với đồng nghiệp." />
      <div className="flex max-w-2xl flex-col gap-6">
        <AvatarEditor user={{ id, name, image: image ?? null }} />
        <ProfileForm user={{ name, email, isAdmin: isAdmin(session) }} />
      </div>
    </PageShell>
  );
}
