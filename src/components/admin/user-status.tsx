import { Badge } from "@/components/ui/badge";

/** Locked beats everything; otherwise whether the account has a password yet. */
export function UserStatus({ user }: { user: { banned: boolean; activated: boolean } }) {
  if (user.banned) return <Badge variant="destructive">Đã khoá</Badge>;
  if (user.activated) return <>Đã kích hoạt</>;
  return <span className="text-muted-foreground">Chờ đặt mật khẩu</span>;
}
