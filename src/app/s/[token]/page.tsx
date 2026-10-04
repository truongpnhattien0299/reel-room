import { ClockIcon, ImagesIcon, Link2OffIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { ReelMark, Wordmark } from "@/components/brand/reel-mark";
import { FileGrid } from "@/components/folders/file-grid";
import { SubfolderCard } from "@/components/folders/folder-card";
import { SharedMediaUrls } from "@/components/folders/media-urls";
import { PageShell } from "@/components/page-header";
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
import { formatBytes, formatRelative } from "@/lib/format";
import { shareLinkPath } from "@/lib/media";
import { getSharedFiles, getSharedFolderView, resolveShareLink } from "@/server/share-links";

export async function generateMetadata(props: PageProps<"/s/[token]">): Promise<Metadata> {
  const { token } = await props.params;
  const resolved = await resolveShareLink(token);
  return {
    title: resolved.status === "ok" ? resolved.root.name : "Link chia sẻ",
    // The token is the only key: keep it out of search engines and Referer headers.
    robots: { index: false, follow: false },
    referrer: "same-origin",
  };
}

/** Public view of a share link: no account, read-only, download allowed. */
export default async function SharedPage(props: PageProps<"/s/[token]">) {
  const { token } = await props.params;
  const { f } = await props.searchParams;
  const resolved = await resolveShareLink(token);
  if (resolved.status !== "ok") return <Unavailable expired={resolved.status === "expired"} />;

  const { link, root } = resolved;
  const base = shareLinkPath(token);
  const view =
    link.kind === "folder"
      ? await getSharedFolderView(root, typeof f === "string" ? f : undefined)
      : {
          folder: { id: root.id, name: root.name },
          breadcrumbs: [],
          subfolders: [],
          files: await getSharedFiles(link),
        };
  if (!view) notFound();

  const hrefFor = (id: string) => (id === root.id ? base : `${base}?f=${id}`);
  const totalSize = view.files.reduce((sum, file) => sum + file.size, 0);
  const isEmpty = view.subfolders.length === 0 && view.files.length === 0;

  return (
    <SharedMediaUrls token={token}>
      <div className="min-h-svh bg-background">
        <header className="flex items-center justify-between gap-4 border-b border-[#1a1c21] px-5 py-3.5 sm:px-8 lg:px-12">
          <div className="flex items-center gap-2.5">
            <ReelMark />
            <Wordmark className="text-lg" />
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-border">
            <ClockIcon className="size-3.5" aria-hidden="true" />
            {link.expiresAt ? `Link hết hạn ${formatRelative(link.expiresAt)}` : "Link không hết hạn"}
          </span>
        </header>

        <PageShell>
          <header className="flex flex-col gap-3">
            {view.breadcrumbs.length > 0 && (
              <Breadcrumb>
                <BreadcrumbList className="text-[13px]">
                  {view.breadcrumbs.map((b, i) => (
                    <Fragment key={b.id}>
                      {i > 0 && <BreadcrumbSeparator />}
                      <BreadcrumbItem>
                        <BreadcrumbLink render={<Link href={hrefFor(b.id)} />}>{b.name}</BreadcrumbLink>
                      </BreadcrumbItem>
                    </Fragment>
                  ))}
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{view.folder.name}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            )}
            <span className="text-[11px] font-semibold tracking-[0.08em] text-primary uppercase">
              {link.kind === "folder" ? "Folder được chia sẻ" : "File được chia sẻ"}
            </span>
            <h1 className="font-display text-[34px] leading-[1.05] font-bold tracking-[-0.03em] break-words sm:text-[44px]">
              {view.folder.name}
            </h1>
            <p className="font-mono text-xs text-muted-foreground">
              {view.files.length} file · {formatBytes(totalSize)}
              {view.subfolders.length > 0 && ` · ${view.subfolders.length} folder con`}
            </p>
          </header>

          {view.subfolders.length > 0 && (
            <section aria-label="Folder con">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                {view.subfolders.map((sub) => (
                  <SubfolderCard key={sub.id} folder={sub} href={hrefFor(sub.id)} />
                ))}
              </div>
            </section>
          )}

          {view.files.length > 0 && (
            <section aria-label="Ảnh và video" className="flex flex-col gap-5">
              <FileGrid files={view.files} canEdit={false} folderName={view.folder.name} />
            </section>
          )}

          {isEmpty && (
            <Empty className="rounded-[18px] border border-dashed border-border py-16">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="size-12 rounded-xl bg-card [&_svg]:size-6">
                  <ImagesIcon />
                </EmptyMedia>
                <EmptyTitle className="font-display text-xl">Chưa có gì ở đây</EmptyTitle>
                <EmptyDescription>Nội dung được chia sẻ đã bị xoá hoặc chuyển đi.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </PageShell>
      </div>
    </SharedMediaUrls>
  );
}

function Unavailable({ expired }: { expired: boolean }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-10 bg-background px-6 py-12">
      <div className="flex items-center gap-2.5">
        <ReelMark className="size-10 rounded-xl" />
        <Wordmark className="text-[22px]" />
      </div>
      <Empty className="max-w-md flex-none rounded-[18px] border border-dashed border-border py-14">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-12 rounded-xl bg-card [&_svg]:size-6">
            {expired ? <ClockIcon /> : <Link2OffIcon />}
          </EmptyMedia>
          <EmptyTitle className="font-display text-xl">
            {expired ? "Link đã hết hạn" : "Link không còn hiệu lực"}
          </EmptyTitle>
          <EmptyDescription>
            {expired
              ? "Nhờ người đã gửi link tạo cho bạn một link mới."
              : "Link sai, đã bị thu hồi, hoặc nội dung không còn được chia sẻ."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  );
}
