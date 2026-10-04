import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InviteUserButton } from "@/components/admin/invite-user-button";
import { ResendInviteButton } from "@/components/admin/resend-invite-button";
import { PageHeader, PageShell } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isAdmin, requireSession } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { listUsers } from "@/server/queries";

export const metadata: Metadata = { title: "Quản lý user" };

export default async function UsersPage() {
  const session = await requireSession();
  if (!isAdmin(session)) notFound();
  const users = await listUsers();

  return (
    <PageShell>
      <PageHeader
        title="Quản lý user"
        description="Mời đồng nghiệp và theo dõi ai đã kích hoạt tài khoản."
        actions={<InviteUserButton />}
      />
      <div>
        <div className="overflow-x-auto rounded-[18px] bg-card ring-1 ring-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tên</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Ngày tạo</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    {u.role === "admin" ? <Badge>Admin</Badge> : <Badge variant="secondary">Member</Badge>}
                  </TableCell>
                  <TableCell>
                    {u.activated ? (
                      "Đã kích hoạt"
                    ) : (
                      <span className="text-muted-foreground">Chờ đặt mật khẩu</span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(u.createdAt)}</TableCell>
                  <TableCell>{!u.activated && <ResendInviteButton userId={u.id} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageShell>
  );
}
