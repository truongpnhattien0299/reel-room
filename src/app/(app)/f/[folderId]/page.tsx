import { ImagesIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Fragment } from "react";
import { FileGrid } from "@/components/folders/file-grid";
import { FolderGrid } from "@/components/folders/folder-grid";
import { NewFolderButton } from "@/components/folders/new-folder-button";
import { ShareButton } from "@/components/folders/share-button";
import { PageHeader } from "@/components/page-header";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FolderDropzone, UploadButton } from "@/components/upload/folder-dropzone";
import { requireSession } from "@/lib/auth";
import { NotFoundError, roleAtLeast } from "@/server/permissions";
import { getFolderView } from "@/server/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Deduped between generateMetadata and the page.
const loadFolder = cache(async (folderId: string) => {
  if (!UUID.test(folderId)) notFound();
  const session = await requireSession();
  try {
    return { session, view: await getFolderView(session, folderId) };
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
});

export async function generateMetadata(props: PageProps<"/f/[folderId]">): Promise<Metadata> {
  const { folderId } = await props.params;
  const { view } = await loadFolder(folderId);
  return { title: view.folder.name };
}

export default async function FolderPage(props: PageProps<"/f/[folderId]">) {
  const { folderId } = await props.params;
  const { session, view } = await loadFolder(folderId);
  const canEdit = roleAtLeast(view.role, "editor");
  const isEmpty = view.subfolders.length === 0 && view.files.length === 0;

  return (
    <FolderDropzone folderId={view.folder.id} enabled={canEdit}>
      <PageHeader
        actions={
          <>
            {view.role === "owner" && (
              <ShareButton folder={view.folder} currentUserId={session.user.id} />
            )}
            {canEdit && <NewFolderButton parentId={view.folder.id} />}
            {canEdit && <UploadButton folderId={view.folder.id} />}
          </>
        }
      >
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/" />}>Tất cả</BreadcrumbLink>
            </BreadcrumbItem>
            {view.breadcrumbs.map((b) => (
              <Fragment key={b.id}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink render={<Link href={`/f/${b.id}`} />}>{b.name}</BreadcrumbLink>
                </BreadcrumbItem>
              </Fragment>
            ))}
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold">{view.folder.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>

      <div className="space-y-6 p-4">
        {view.subfolders.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Folder</h2>
            <FolderGrid
              folders={view.subfolders.map((f) => ({ ...f, role: view.role }))}
              isRoot={false}
              currentUserId={session.user.id}
            />
          </section>
        )}
        {view.files.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Ảnh &amp; video ({view.files.length})
            </h2>
            <FileGrid files={view.files} canEdit={canEdit} />
          </section>
        )}
        {isEmpty && (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ImagesIcon />
              </EmptyMedia>
              <EmptyTitle>Folder trống</EmptyTitle>
              <EmptyDescription>
                {canEdit
                  ? "Kéo thả ảnh, video vào đây hoặc bấm Upload."
                  : "Chưa có nội dung nào trong folder này."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </FolderDropzone>
  );
}
