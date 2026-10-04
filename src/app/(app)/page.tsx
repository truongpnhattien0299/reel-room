import { FolderIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { FolderGrid } from "@/components/folders/folder-grid";
import { NewFolderButton } from "@/components/folders/new-folder-button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { requireSession } from "@/lib/auth";
import { listRootFolders } from "@/server/queries";

export default async function HomePage() {
  const session = await requireSession();
  const folders = await listRootFolders(session);

  return (
    <>
      <PageHeader actions={<NewFolderButton parentId={null} />}>
        <h1 className="font-semibold">Tất cả folder</h1>
      </PageHeader>
      <div className="p-4">
        {folders.length ? (
          <FolderGrid folders={folders} isRoot currentUserId={session.user.id} />
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderIcon />
              </EmptyMedia>
              <EmptyTitle>Chưa có folder nào</EmptyTitle>
              <EmptyDescription>
                Tạo folder đầu tiên, hoặc nhờ đồng nghiệp chia sẻ folder với bạn.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <NewFolderButton parentId={null} variant="default" />
            </EmptyContent>
          </Empty>
        )}
      </div>
    </>
  );
}
