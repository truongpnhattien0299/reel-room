import {
  CogIcon,
  FileIcon,
  FolderIcon,
  Link2Icon,
  ShieldIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import type { ActivityAction } from "@/db/schema";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import type { ActivityItem as Row } from "@/server/activity";

export type { Row as ActivityRowData };

const ROLE_LABEL: Record<string, string> = { viewer: "xem", editor: "chỉnh sửa", owner: "chủ sở hữu" };

const GROUP_ICON: Record<string, LucideIcon> = {
  file: FileIcon,
  folder: FolderIcon,
  share: UsersIcon,
  link: Link2Icon,
  user: ShieldIcon,
};

const B = ({ children }: { children: React.ReactNode }) => (
  <strong className="font-medium text-foreground">{children}</strong>
);
const Place = ({ children }: { children: React.ReactNode }) => (
  <em className="font-medium text-foreground not-italic">{children}</em>
);

/** "“a.jpg”", or "12 file" with the first names in a tooltip. */
function Files({ names = [], count = names.length }: { names?: string[]; count?: number }) {
  if (count === 1 && names[0]) return <B>“{names[0]}”</B>;
  const more = count - names.length;
  const title = names.join(", ") + (more > 0 ? ` và ${more} file khác` : "");
  return (
    <span title={title || undefined} className="font-medium text-foreground">
      {count} file
    </span>
  );
}

const inFolder = (name?: string) => name && <> trong <Place>{name}</Place></>;
const expiry = (iso?: string | null) =>
  iso ? `hết hạn ${formatDate(new Date(iso))}` : "không hết hạn";

const linkOptions = (m: Row["meta"]) => [
  ...(m.password ? [m.password === "set" ? "đặt mật khẩu" : "gỡ mật khẩu"] : []),
  ...(m.allowDownload !== undefined ? [m.allowDownload ? "cho phép tải về" : "tắt tải về"] : []),
];

/** The sentence after the actor's name, in Vietnamese. */
export function describe(action: ActivityAction, m: Row["meta"]): React.ReactNode {
  switch (action) {
    case "file.upload":
      return <>đã upload <Files names={m.names} count={m.count} />{m.folderName && <> vào <Place>{m.folderName}</Place></>}</>;
    case "file.rename":
      return <>đã đổi tên file “{m.from}” thành <B>“{m.to}”</B>{inFolder(m.folderName)}</>;
    case "file.move":
      return <>đã chuyển <Files names={m.names} count={m.count} /> từ <Place>{m.from}</Place> sang <Place>{m.to}</Place></>;
    case "file.trash":
      return <>đã xoá <Files names={m.names} count={m.count} />{inFolder(m.folderName)}</>;
    case "file.restore":
      return <>đã khôi phục <Files names={m.names} count={m.count} />{inFolder(m.folderName)}</>;
    case "file.purge":
      return <>đã xoá vĩnh viễn <Files names={m.names} count={m.count} />{inFolder(m.folderName)}</>;
    case "folder.create":
      return <>đã tạo folder <Place>{m.name}</Place>{inFolder(m.folderName)}</>;
    case "folder.rename":
      return <>đã đổi tên folder “{m.from}” thành <Place>{m.to}</Place></>;
    case "folder.move":
      return <>đã chuyển folder <Place>{m.name}</Place>{m.from && <> từ <Place>{m.from}</Place></>} sang <Place>{m.to}</Place></>;
    case "folder.trash":
      return <>đã xoá folder <Place>{m.name}</Place></>;
    case "folder.restore":
      return <>đã khôi phục folder <Place>{m.name}</Place></>;
    case "folder.purge":
      return <>đã xoá vĩnh viễn folder <Place>{m.name}</Place></>;
    case "share.grant":
      return <>đã cho <B>{m.name}</B> quyền {ROLE_LABEL[m.role ?? ""] ?? m.role} ở <Place>{m.folderName}</Place></>;
    case "share.revoke":
      return <>đã gỡ quyền của <B>{m.name}</B> ở <Place>{m.folderName}</Place></>;
    case "link.create":
      return (
        <>
          đã tạo link chia sẻ {m.kind === "files" ? <><Files count={m.count} /> trong </> : "folder "}
          <Place>{m.folderName}</Place> ({[expiry(m.expiresAt), ...linkOptions(m)].join(", ")})
        </>
      );
    case "link.update": {
      const changes = [
        ...("expiresAt" in m ? [`đổi hạn thành ${expiry(m.expiresAt)}`] : []),
        ...linkOptions(m),
      ];
      return <>đã sửa link ở <Place>{m.folderName}</Place>: {changes.join(", ")}</>;
    }
    case "link.revoke":
      return <>đã thu hồi {m.count && m.count > 1 ? `${m.count} link` : "link"} ở <Place>{m.folderName}</Place></>;
    case "user.invite":
      return <>đã mời <B>{m.email}</B>{m.role === "admin" && " làm admin"}</>;
    case "user.role":
      return <>đã đổi vai trò của <B>{m.name}</B> thành {m.to === "admin" ? "Admin" : "Member"}</>;
    case "user.lock":
      return <>đã khoá tài khoản <B>{m.name}</B>{m.reason && ` (lý do: ${m.reason})`}</>;
    case "user.unlock":
      return <>đã mở khoá tài khoản <B>{m.name}</B></>;
    case "user.password":
      return m.via === "email"
        ? <>đã gửi link đặt lại mật khẩu cho <B>{m.name}</B></>
        : <>đã đặt mật khẩu mới cho <B>{m.name}</B></>;
  }
}

/** One event: who, what, when. */
export function ActivityItem({ row }: { row: Row }) {
  const Icon = GROUP_ICON[row.action.split(".")[0]] ?? FileIcon;
  return (
    <li className="flex gap-3 py-3">
      <span className="relative mt-0.5 h-fit shrink-0">
        {row.actor ? (
          <UserAvatar user={row.actor} />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <CogIcon className="size-4" />
          </span>
        )}
        <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-popover ring-2 ring-card">
          <Icon className="size-2.5 text-muted-foreground" aria-hidden="true" />
        </span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm leading-snug break-words text-muted-foreground">
          <B>{row.actor?.name ?? "Hệ thống"}</B> {describe(row.action, row.meta)}
        </p>
        <time
          dateTime={row.createdAt.toISOString()}
          title={formatDateTime(row.createdAt)}
          className="text-xs text-muted-foreground"
          // Relative times drift between the server render and hydration.
          suppressHydrationWarning
        >
          {formatRelative(row.createdAt)}
        </time>
      </div>
    </li>
  );
}
