import { Trash2Icon } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader, PageShell } from "@/components/page-header";
import { EmptyTrashButton } from "@/components/trash/empty-trash-button";
import { TrashList } from "@/components/trash/trash-list";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { requireSession } from "@/lib/auth";
import { TRASH_RETENTION_DAYS } from "@/lib/trash";
import { listTrash } from "@/server/queries";

export const metadata: Metadata = { title: "Thùng rác" };

export default async function TrashPage() {
  const session = await requireSession();
  const asOf = new Date();
  const items = await listTrash(session);
  const manageable = items.filter((i) => i.canManage).length;

  return (
    <PageShell>
      <PageHeader
        title="Thùng rác"
        description={`Khôi phục hoặc xoá vĩnh viễn. Mục trong thùng rác tự xoá sau ${TRASH_RETENTION_DAYS} ngày.`}
        actions={
          manageable > 0 && (
            <EmptyTrashButton count={manageable} kept={items.length - manageable} asOf={asOf} />
          )
        }
      />
      {items.length ? (
        <TrashList items={items} />
      ) : (
        <Empty className="rounded-[18px] border border-dashed border-border py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-12 rounded-xl bg-card [&_svg]:size-6">
              <Trash2Icon />
            </EmptyMedia>
            <EmptyTitle className="font-display text-xl">Thùng rác trống</EmptyTitle>
            <EmptyDescription>Folder và file bạn xoá sẽ nằm ở đây {TRASH_RETENTION_DAYS} ngày.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </PageShell>
  );
}
