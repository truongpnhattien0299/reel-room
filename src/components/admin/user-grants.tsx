"use client";

import { FolderIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/folders/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { revokeShare } from "@/server/actions";
import type { UserGrant } from "@/server/queries";

const ROLE_LABEL = { viewer: "Xem", editor: "Sửa", owner: "Chủ sở hữu" };

/** Folders shared with the user, each removable. */
export function UserGrants({
  userId,
  isAdmin,
  self,
  grants,
}: {
  userId: string;
  isAdmin: boolean;
  /** Admins can't drop their own grants (see `revokeShare`). */
  self: boolean;
  grants: UserGrant[];
}) {
  const [revoking, setRevoking] = useState<UserGrant | null>(null);

  return (
    <section
      aria-labelledby="grants-heading"
      className="flex flex-col gap-4 rounded-[18px] bg-card p-5 ring-1 ring-border"
    >
      <div className="flex flex-col gap-1">
        <h2 id="grants-heading" className="font-display text-lg font-semibold">
          Quyền truy cập folder
        </h2>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "Admin xem và quản lý được mọi folder, kể cả folder không có trong danh sách."
            : "Quyền trên một folder áp dụng cho cả các folder con."}
        </p>
      </div>
      {grants.length === 0 ? (
        <p className="rounded-xl bg-background px-4 py-6 text-center text-sm text-muted-foreground ring-1 ring-border">
          Chưa được chia sẻ folder nào.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 rounded-xl bg-background p-1.5 ring-1 ring-border">
          {grants.map((g) => (
            <li key={g.folderId} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
              <FolderIcon className="size-[18px] shrink-0 text-primary" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 flex-col">
                <Link href={`/f/${g.folderId}`} className="truncate font-medium hover:underline">
                  {g.name}
                </Link>
                <span className="text-xs text-muted-foreground">Cấp ngày {formatDate(g.grantedAt)}</span>
              </div>
              <Badge variant="secondary">{ROLE_LABEL[g.role]}</Badge>
              {!self && (
                <Button
                  variant="ghost"
                size="icon-sm"
                aria-label={`Bỏ quyền trên ${g.name}`}
                onClick={() => setRevoking(g)}
              >
                  <XIcon />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="Bỏ quyền truy cập?"
        description={`User sẽ không còn thấy folder "${revoking?.name ?? ""}" và các folder con, trừ khi được chia sẻ qua folder cha.`}
        confirmLabel="Bỏ quyền"
        onConfirm={() => revokeShare(revoking!.folderId, userId)}
      />
    </section>
  );
}
