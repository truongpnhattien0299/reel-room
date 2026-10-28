import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StorageGrowthChart } from "@/components/admin/storage-growth-chart";
import { type ShareRow, ShareTable, StorageSection, StorageTile } from "@/components/admin/storage-parts";
import { PageHeader, PageShell } from "@/components/page-header";
import { UserAvatar } from "@/components/user-avatar";
import { isAdmin, requireSession } from "@/lib/auth";
import { formatBytes } from "@/lib/format";
import { TRASH_RETENTION_DAYS } from "@/lib/trash";
import { listRootFoldersWithStats } from "@/server/queries";
import {
  estimateMonthlyCost,
  getMonthlyGrowth,
  getStorageByUploader,
  getStorageOverview,
} from "@/server/storage";

export const metadata: Metadata = { title: "Dung lượng" };

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const rowLink =
  "block truncate font-medium outline-none hover:underline focus-visible:underline";

export default async function StoragePage() {
  const session = await requireSession();
  if (!isAdmin(session)) notFound();
  const [overview, uploaders, growth, roots] = await Promise.all([
    getStorageOverview(),
    getStorageByUploader(),
    getMonthlyGrowth(),
    listRootFoldersWithStats(session),
  ]);
  const { live, trash, pending, byKind } = overview;
  // Everything still sitting in the bucket is billed, trash and stalled uploads included.
  const stored = live.bytes + trash.bytes + pending.bytes;

  const folderRows: ShareRow[] = roots
    .toSorted((a, b) => b.totalSize - a.totalSize)
    .map((f) => ({
      key: f.id,
      label: (
        <Link href={`/f/${f.id}`} className={rowLink} title={f.name}>
          {f.name}
        </Link>
      ),
      bytes: f.totalSize,
      files: f.itemCount,
    }));
  const uploaderRows: ShareRow[] = uploaders.map((u) => ({
    key: u.id,
    label: (
      <span className="flex min-w-0 items-center gap-2.5">
        <UserAvatar user={u} className="size-7 text-[10px]" />
        <Link href={`/admin/users/${u.id}`} className={rowLink} title={u.name}>
          {u.name}
        </Link>
      </span>
    ),
    bytes: u.bytes,
    files: u.files,
  }));
  const kindRows: ShareRow[] = [
    { key: "image", label: "Ảnh", ...byKind.image },
    { key: "video", label: "Video", ...byKind.video },
    { key: "audio", label: "Audio", ...byKind.audio },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Dung lượng"
        description="Dung lượng file gốc trên R2. Chưa tính thumbnail và avatar."
      />

      <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
        <StorageTile label="Đang dùng" value={formatBytes(live.bytes)} detail={`${live.files} file`} />
        <StorageTile
          label="Trong thùng rác"
          value={formatBytes(trash.bytes)}
          detail={`${trash.files} file · tự xoá sau tối đa ${TRASH_RETENTION_DAYS} ngày`}
        />
        <StorageTile
          label="Upload dở"
          value={formatBytes(pending.bytes)}
          detail={`${pending.files} file · tự dọn sau 1 ngày`}
        />
        <StorageTile
          label="Chi phí ước tính"
          value={
            <>
              {usd.format(estimateMonthlyCost(stored))}
              <span className="text-base font-normal text-muted-foreground">/tháng</span>
            </>
          }
          detail={`Lưu ${formatBytes(stored)}, trừ 10 GB miễn phí. Chưa tính lượt đọc/ghi.`}
        />
      </div>

      <StorageSection
        id="growth-h"
        title="Upload theo tháng"
        description="12 tháng gần nhất, chỉ tính file còn đang dùng."
      >
        <StorageGrowthChart data={growth} />
      </StorageSection>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <StorageSection id="folders-h" title="Theo folder gốc" description="Gồm cả folder con.">
          <ShareTable rows={folderRows} total={live.bytes} empty="Chưa có folder nào." />
        </StorageSection>
        <StorageSection id="uploaders-h" title="Theo người upload">
          <ShareTable rows={uploaderRows} total={live.bytes} empty="Chưa có ai upload." />
        </StorageSection>
        <StorageSection id="kinds-h" title="Theo loại">
          <ShareTable rows={kindRows} total={live.bytes} empty="Chưa có file nào." />
        </StorageSection>
      </div>
    </PageShell>
  );
}
