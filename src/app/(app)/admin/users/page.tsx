import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvitationList } from "@/components/admin/invitation-list";
import { InviteUserButton } from "@/components/admin/invite-user-button";
import { UserStatus } from "@/components/admin/user-status";
import { PageHeader, PageShell } from "@/components/page-header";
import { UserAvatar } from "@/components/user-avatar";
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
import { listInvitations } from "@/server/invitations";
import { listUsers } from "@/server/queries";

export const metadata: Metadata = { title: "Quản lý user" };

export default async function UsersPage() {
  const session = await requireSession();
  if (!isAdmin(session)) notFound();
  const [users, invitations] = await Promise.all([listUsers(), listInvitations()]);

  return (
    <PageShell>
      <PageHeader
        title="Quản lý user"
        description="Mời đồng nghiệp, đổi vai trò, khoá tài khoản."
        actions={<InviteUserButton />}
      />
      {invitations.length > 0 && <InvitationList invitations={invitations} />}
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
                // The name link stretches over the whole row.
                <TableRow key={u.id} className="relative">
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-3">
                      <UserAvatar user={u} />
                      <span>
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
                        >
                          {u.name}
                        </Link>
                        {u.id === session.user.id && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">(Bạn)</span>
                        )}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    {u.role === "admin" ? <Badge>Admin</Badge> : <Badge variant="secondary">Member</Badge>}
                  </TableCell>
                  <TableCell>
                    <UserStatus user={u} />
                  </TableCell>
                  <TableCell>{formatDate(u.createdAt)}</TableCell>
                  <TableCell>
                    <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </PageShell>
  );
}
