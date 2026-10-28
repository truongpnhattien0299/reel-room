import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivityFilters } from "@/components/activity/activity-filters";
import { ActivityList } from "@/components/activity/activity-list";
import { PageHeader, PageShell } from "@/components/page-header";
import { isAdmin, requireSession } from "@/lib/auth";
import { activityFilterSchema, listActivity } from "@/server/activity";
import { listUsers } from "@/server/queries";

export const metadata: Metadata = { title: "Hoạt động" };

export default async function ActivityPage(props: PageProps<"/admin/activity">) {
  const session = await requireSession();
  if (!isAdmin(session)) notFound();
  const sp = await props.searchParams;
  // Each filter on its own: a bad value is dropped instead of failing the page.
  const filter: Record<string, string> = {};
  for (const key of ["actor", "group", "from", "to"] as const) {
    const value = sp[key];
    if (typeof value !== "string") continue;
    if (activityFilterSchema.shape[key].safeParse(value).success) filter[key] = value;
  }
  const [page, users] = await Promise.all([listActivity(session, filter), listUsers()]);

  return (
    <PageShell>
      <PageHeader title="Hoạt động" description="Ai đã làm gì trong ReelRoom. Giữ 365 ngày." />
      <ActivityFilters users={users.map((u) => ({ id: u.id, name: u.name }))} />
      <div className="rounded-[18px] bg-card px-5 py-4 ring-1 ring-border">
        <ActivityList
          key={JSON.stringify(filter)}
          filter={filter}
          initial={page}
          empty={Object.keys(filter).length ? "Không có hoạt động nào khớp bộ lọc." : "Chưa có hoạt động nào."}
        />
      </div>
    </PageShell>
  );
}
