import { Link2Icon } from "lucide-react";
import type { Metadata } from "next";
import { ShareLinkList } from "@/components/links/share-link-list";
import { PageHeader, PageShell } from "@/components/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { requireSession } from "@/lib/auth";
import { listAllShareLinks } from "@/server/share-links";

export const metadata: Metadata = { title: "Link chia sẻ" };

export default async function LinksPage() {
  const session = await requireSession();
  const links = await listAllShareLinks(session);

  return (
    <PageShell>
      <PageHeader title="Link chia sẻ" description="Mọi link công khai trong các folder bạn quản lý." />
      {links.length ? (
        <ShareLinkList links={links} currentUserId={session.user.id} />
      ) : (
        <Empty className="rounded-[18px] border border-dashed border-border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-12 rounded-xl bg-card [&_svg]:size-6">
              <Link2Icon />
            </EmptyMedia>
            <EmptyTitle className="font-display text-xl">Chưa có link nào</EmptyTitle>
            <EmptyDescription>Tạo link trong mục Chia sẻ của một folder, hoặc chọn file rồi bấm Tạo link.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </PageShell>
  );
}
