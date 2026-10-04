import { PageShell } from "@/components/page-header";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level loading UI (used by loading.tsx). Lets navigation switch pages
 * instantly while the server renders, instead of freezing on the old page.
 */
export function PageSkeleton({
  breadcrumb,
  variant = "cards",
}: {
  breadcrumb?: boolean;
  variant?: "cards" | "tiles" | "rows";
}) {
  return (
    <PageShell>
      <div role="status" aria-label="Đang tải" className="contents">
        <header className="flex flex-col gap-3">
          <div className="flex min-h-8 items-center gap-2 md:min-h-0">
            <SidebarTrigger className="-ml-1.5 size-9 md:hidden" />
            {breadcrumb && <Skeleton className="h-4 w-48" />}
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-64 max-w-full rounded-lg sm:h-12" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
        </header>

        {variant === "cards" && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex flex-col gap-3.5 rounded-[18px] bg-card p-2.5 pb-4 ring-1 ring-border">
                <Skeleton className="h-[170px] rounded-xl" />
                <div className="flex flex-col gap-2 px-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {variant === "tiles" && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        )}

        {variant === "rows" && (
          <div className="flex flex-col gap-1 rounded-[18px] bg-card p-1.5 ring-1 ring-border">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-2.5 py-2">
                <Skeleton className="size-9 shrink-0 rounded-[10px]" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56 max-w-full" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
