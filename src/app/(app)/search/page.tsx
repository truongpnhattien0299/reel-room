import { SearchXIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ToneTile } from "@/components/folders/media-thumb";
import { RecentGrid } from "@/components/folders/recent-grid";
import { PageHeader, PageShell, SectionHeading } from "@/components/page-header";
import { SearchBox } from "@/components/search/search-box";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { requireSession } from "@/lib/auth";
import { searchLibrary } from "@/server/queries";

export async function generateMetadata(props: PageProps<"/search">): Promise<Metadata> {
  const { q } = await props.searchParams;
  return { title: typeof q === "string" && q.trim() ? `Tìm “${q.trim()}”` : "Tìm kiếm" };
}

export default async function SearchPage(props: PageProps<"/search">) {
  const session = await requireSession();
  const { q } = await props.searchParams;
  const term = typeof q === "string" ? q.trim() : "";
  const results = await searchLibrary(session, term);
  const total = results.folders.length + results.files.length;

  return (
    <PageShell>
      <PageHeader
        title={term ? `Kết quả cho “${term}”` : "Tìm kiếm"}
        description={
          term
            ? `${results.folders.length} folder · ${results.files.length} file. Không phân biệt hoa thường hay dấu.`
            : "Tìm theo tên folder hoặc tên file, gõ có dấu hay không dấu đều được."
        }
      />
      {/* The sidebar box is hidden on phones; give this page its own. */}
      <Suspense>
        <SearchBox size="lg" autoFocus={!term} className="md:hidden" />
      </Suspense>

      {term && total === 0 && (
        <Empty className="rounded-[18px] border border-dashed border-border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-12 rounded-xl bg-card [&_svg]:size-6">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle className="font-display text-xl">Không tìm thấy gì</EmptyTitle>
            <EmptyDescription>Thử một từ khoá ngắn hơn, hoặc một phần của tên file.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {results.folders.length > 0 && (
        <section aria-labelledby="sr-folders" className="flex flex-col gap-4">
          <SectionHeading id="sr-folders">Folder</SectionHeading>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {results.folders.map((f) => (
              <Link
                key={f.id}
                href={`/f/${f.id}`}
                className="flex items-center gap-3 rounded-[14px] bg-card p-2.5 pr-4 ring-1 ring-border transition-colors outline-none hover:bg-[#1a1d23] hover:ring-[#3a3f4a] focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="size-11 shrink-0 overflow-hidden rounded-[10px]">
                  <ToneTile seed={f.id} />
                </span>
                <span className="flex min-w-0 flex-col leading-snug">
                  <span className="truncate font-semibold">{f.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {f.parentName ? `trong ${f.parentName}` : "Folder gốc"}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.files.length > 0 && (
        <section aria-labelledby="sr-files" className="flex flex-col gap-4">
          <SectionHeading id="sr-files">Ảnh &amp; video</SectionHeading>
          <RecentGrid files={results.files} />
        </section>
      )}
    </PageShell>
  );
}
