import { FolderIcon } from "lucide-react";
import { FolderGrid } from "@/components/folders/folder-grid";
import { NewFolderButton } from "@/components/folders/new-folder-button";
import { RecentGrid } from "@/components/folders/recent-grid";
import { PageHeader, PageShell, SectionHeading } from "@/components/page-header";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { requireSession } from "@/lib/auth";
import { listRecentFiles, listRootFoldersWithStats } from "@/server/queries";

export default async function HomePage() {
  const session = await requireSession();
  const [folders, recent] = await Promise.all([
    listRootFoldersWithStats(session),
    listRecentFiles(session),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Thư viện"
        description="Ảnh và video của cả team, sắp xếp theo folder."
        actions={<NewFolderButton parentId={null} />}
      />

      {folders.length ? (
        <>
          <section aria-labelledby="folders-h" className="flex flex-col gap-4">
            <SectionHeading id="folders-h">Folder</SectionHeading>
            <FolderGrid folders={folders} isRoot currentUserId={session.user.id} />
          </section>
          {recent.length > 0 && (
            <section aria-labelledby="recent-h" className="flex flex-col gap-4">
              <SectionHeading id="recent-h">Tải lên gần đây</SectionHeading>
              <RecentGrid files={recent} />
            </section>
          )}
        </>
      ) : (
        <Empty className="rounded-[18px] border border-dashed border-border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-12 rounded-xl bg-card [&_svg]:size-6">
              <FolderIcon />
            </EmptyMedia>
            <EmptyTitle className="font-display text-xl">Chưa có folder nào</EmptyTitle>
            <EmptyDescription>
              Tạo folder đầu tiên, hoặc nhờ đồng nghiệp chia sẻ folder với bạn.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <NewFolderButton parentId={null} variant="default" />
          </EmptyContent>
        </Empty>
      )}
    </PageShell>
  );
}
