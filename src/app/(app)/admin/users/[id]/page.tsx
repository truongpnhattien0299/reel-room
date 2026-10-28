import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { UserAccessCard } from "@/components/admin/user-access-card";
import { UserGrants } from "@/components/admin/user-grants";
import { UserLockCard } from "@/components/admin/user-lock-card";
import { UserProfileForm } from "@/components/admin/user-profile-form";
import { UserStatus } from "@/components/admin/user-status";
import { PageHeader, PageShell } from "@/components/page-header";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { isAdmin, requireSession } from "@/lib/auth";
import { formatBytes, formatDate } from "@/lib/format";
import { getUserDetail, listUserGrants } from "@/server/queries";

// Deduped between generateMetadata and the page.
const loadUser = cache(async (id: string) => {
  const session = await requireSession();
  if (!isAdmin(session)) notFound();
  const detail = await getUserDetail(id);
  if (!detail) notFound();
  return { session, detail };
});

export async function generateMetadata(props: PageProps<"/admin/users/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const { detail } = await loadUser(id);
  return { title: detail.name };
}

export default async function UserPage(props: PageProps<"/admin/users/[id]">) {
  const { id } = await props.params;
  const { session, detail } = await loadUser(id);
  const grants = await listUserGrants(id);
  const self = detail.id === session.user.id;

  return (
    <PageShell>
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href="/admin/users" />}>Quản lý user</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{detail.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        }
        title={
          <span className="flex items-center gap-4">
            <UserAvatar user={detail} className="size-14 font-sans text-lg tracking-normal" />
            <span className="min-w-0">{detail.name}</span>
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="break-all">{detail.email}</span>
            {detail.role === "admin" ? <Badge>Admin</Badge> : <Badge variant="secondary">Member</Badge>}
            <UserStatus user={detail} />
            {self && <span className="text-xs">(Bạn)</span>}
          </span>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <UserProfileForm user={detail} self={self} />
          <UserGrants userId={detail.id} isAdmin={detail.role === "admin"} self={self} grants={grants} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <section
            aria-labelledby="activity-heading"
            className="flex flex-col gap-4 rounded-[18px] bg-card p-5 ring-1 ring-border"
          >
            <h2 id="activity-heading" className="font-display text-lg font-semibold">
              Hoạt động
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
              <Stat label="Ngày tạo">{formatDate(detail.createdAt)}</Stat>
              <Stat label="File đã upload">
                {detail.uploads} · {formatBytes(detail.uploadedBytes)}
              </Stat>
              <Stat label="Folder đã tạo">{detail.foldersCreated}</Stat>
            </dl>
          </section>
          <UserAccessCard user={detail} self={self} />
          {!self && <UserLockCard user={detail} />}
        </div>
      </div>
    </PageShell>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 text-right font-mono">{children}</dd>
    </>
  );
}
