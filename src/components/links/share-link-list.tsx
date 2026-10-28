"use client";

import {
  CalendarClockIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  FolderIcon,
  ImagesIcon,
  KeyRoundIcon,
  LockOpenIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { absoluteUrl, useCopy } from "@/components/copy-link";
import { ConfirmDialog } from "@/components/folders/confirm-dialog";
import { DOWNLOAD_NOTE, expiryText, LinkFlags } from "@/components/folders/share-links";
import { type LinkSetting, LinkSettingsDialog } from "@/components/links/link-settings-dialog";
import { LinkFiles } from "@/components/links/link-files";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { formatDateTime, formatRelative } from "@/lib/format";
import { shareLinkPath } from "@/lib/media";
import { cn } from "@/lib/utils";
import { deleteShareLinks, updateShareLink } from "@/server/actions";
import type { ShareLinkRow, ShareLinkStatus } from "@/server/share-links";

type Filter = "all" | "active" | "expired" | "dead";

const groupOf = (s: ShareLinkStatus): Exclude<Filter, "all"> =>
  s === "active" || s === "expired" ? s : "dead";

const DEAD_LABEL: Record<Exclude<ShareLinkStatus, "active" | "expired">, string> = {
  folder_trashed: "Folder trong thùng rác",
  creator_banned: "Người tạo bị khoá",
  creator_no_access: "Người tạo mất quyền",
};

const EMPTY_LABEL: Record<Filter, string> = {
  all: "link",
  active: "link đang hoạt động",
  expired: "link hết hạn",
  dead: "link không hoạt động",
};

/** A pending revoke: the links and how to describe them. */
type Revoking = { ids: string[]; title: string };

export function ShareLinkList({ links, currentUserId }: { links: ShareLinkRow[]; currentUserId: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [mine, setMine] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [revoking, setRevoking] = useState<Revoking | null>(null);
  const [editing, setEditing] = useState<{ link: ShareLinkRow; setting: LinkSetting } | null>(null);

  const scoped = mine ? links.filter((l) => l.creator.id === currentUserId) : links;
  const counts: Record<Filter, number> = { all: scoped.length, active: 0, expired: 0, dead: 0 };
  for (const l of scoped) counts[groupOf(l.status)]++;
  const visible = filter === "all" ? scoped : scoped.filter((l) => groupOf(l.status) === filter);
  // Selection survives filtering, but only links still listed count.
  const picked = links.filter((l) => selected.has(l.id)).map((l) => l.id);
  const expiredIds = links.filter((l) => l.status === "expired" && l.canManage).map((l) => l.id);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const chips: { value: Filter; label: string }[] = [
    { value: "all", label: "Tất cả" },
    { value: "active", label: "Đang hoạt động" },
    { value: "expired", label: "Hết hạn" },
    { value: "dead", label: "Không hoạt động" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2229] pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Lọc theo trạng thái"
            className="flex flex-wrap gap-1 rounded-xl bg-card p-1 ring-1 ring-border"
          >
            {chips.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-pressed={filter === c.value}
                onClick={() => setFilter(c.value)}
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-[calc(var(--radius-xl)-0.25rem)] px-3.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  filter === c.value
                    ? "bg-[#2a2e37] font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
                <span className="font-mono text-[11px] text-muted-foreground">{counts[c.value]}</span>
              </button>
            ))}
          </div>
          <Button
            variant={mine ? "secondary" : "outline"}
            size="lg"
            aria-pressed={mine}
            onClick={() => setMine((m) => !m)}
          >
            {mine && <CheckIcon data-icon="inline-start" />}
            Của tôi
          </Button>
        </div>
        {expiredIds.length > 0 && (
          <Button
            variant="ghost"
            size="lg"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() =>
              setRevoking({ ids: expiredIds, title: `Xoá ${expiredIds.length} link đã hết hạn?` })
            }
          >
            <Trash2Icon data-icon="inline-start" />
            Xoá link hết hạn ({expiredIds.length})
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Không có {EMPTY_LABEL[filter]} nào.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[#1f2229] overflow-hidden rounded-[18px] bg-card ring-1 ring-border">
          {visible.map((l) => (
            <LinkRow
              key={l.id}
              link={l}
              isMine={l.creator.id === currentUserId}
              selected={selected.has(l.id)}
              onToggle={() => toggle(l.id)}
              onEdit={(setting) => setEditing({ link: l, setting })}
              onRevoke={() => setRevoking({ ids: [l.id], title: "Thu hồi link này?" })}
            />
          ))}
        </ul>
      )}

      {picked.length > 0 && (
        <div
          role="toolbar"
          aria-label="Link đã chọn"
          className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-popover py-2 pr-2 pl-4 shadow-[0_24px_60px_rgba(0,0,0,0.5)] ring-1 ring-[#2a2e37] sm:bottom-8"
        >
          <span className="pr-2 text-sm whitespace-nowrap">
            <span className="font-mono font-semibold">{picked.length}</span> đã chọn
          </span>
          <Button
            size="lg"
            variant="destructive"
            onClick={() => setRevoking({ ids: picked, title: `Thu hồi ${picked.length} link?` })}
          >
            <XIcon data-icon="inline-start" />
            Thu hồi
          </Button>
          <Button variant="ghost" size="icon-lg" aria-label="Bỏ chọn" onClick={() => setSelected(new Set())}>
            <XIcon />
          </Button>
        </div>
      )}

      {revoking && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRevoking(null)}
          title={revoking.title}
          description="Ai đang giữ link sẽ không mở được nữa. Không thể hoàn tác."
          confirmLabel="Thu hồi"
          onConfirm={async () => {
            const res = await deleteShareLinks(revoking.ids);
            if (!res.error) {
              setSelected((s) => new Set([...s].filter((id) => !revoking.ids.includes(id))));
            }
            return res;
          }}
        />
      )}
      {editing && (
        <LinkSettingsDialog
          link={editing.link}
          setting={editing.setting}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </>
  );
}

function LinkRow({
  link,
  isMine,
  selected,
  onToggle,
  onEdit,
  onRevoke,
}: {
  link: ShareLinkRow;
  isMine: boolean;
  selected: boolean;
  onToggle: () => void;
  onEdit: (setting: LinkSetting) => void;
  onRevoke: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const update = (input: Parameters<typeof updateShareLink>[1], done: string) =>
    startTransition(async () => {
      const res = await updateShareLink(link.id, input);
      if (res.error) toast.error(res.error);
      else toast.success(done);
    });
  const { copied, copy } = useCopy();
  const url = () => absoluteUrl(shareLinkPath(link.token));
  const Icon = link.kind === "folder" ? FolderIcon : ImagesIcon;
  const title = link.kind === "folder" ? "Cả folder" : `${link.fileCount} file`;

  return (
    <li className={cn("flex flex-col gap-3 px-4 py-3", selected && "bg-primary/5")}>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          aria-label={`Chọn link ${title} trong ${link.folder.name}`}
          className={cn("size-4 shrink-0 accent-primary", !link.canManage && "invisible")}
          disabled={!link.canManage}
          checked={selected}
          onChange={onToggle}
        />
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background ring-1 ring-border">
          <Icon className="size-4 text-primary" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate">
            <span className="font-medium">{title}</span>
            <span className="text-muted-foreground"> trong </span>
            <Link
              href={`/f/${link.folder.id}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {link.folder.name}
            </Link>
          </p>
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <UserAvatar user={link.creator} className="size-4 text-[8px]" />
            <span className="truncate">
              {isMine ? "Bạn" : link.creator.name} tạo{" "}
              <span title={formatDateTime(link.createdAt)}>{formatRelative(link.createdAt)}</span>
            </span>
          </p>
          <LinkStats link={link} />
          <StatusBadge link={link} className="self-start sm:hidden" />
        </div>
        <StatusBadge link={link} className="hidden sm:inline-flex" />
        <div className="flex shrink-0 items-center gap-1">
          {link.status === "active" && (
            <Button variant="ghost" size="icon-sm" aria-label="Sao chép link" onClick={() => copy(url())}>
              {copied?.endsWith(shareLinkPath(link.token)) ? <CheckIcon /> : <CopyIcon />}
            </Button>
          )}
          {link.kind === "files" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={expanded ? "Ẩn file" : "Xem file"}
              aria-expanded={expanded}
              onClick={() => setExpanded((e) => !e)}
            >
              <ChevronDownIcon className={cn("transition-transform", expanded && "rotate-180")} />
            </Button>
          )}
          {link.canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Thêm thao tác" />}>
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                {link.status !== "folder_trashed" && (
                  <>
                    <DropdownMenuItem onClick={() => onEdit("expiry")}>
                      <CalendarClockIcon />
                      Đổi hạn
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit("password")}>
                      <KeyRoundIcon />
                      {link.hasPassword ? "Đổi mật khẩu" : "Đặt mật khẩu"}
                    </DropdownMenuItem>
                    {link.hasPassword && (
                      <DropdownMenuItem
                        disabled={pending}
                        onClick={() => update({ password: null }, "Đã gỡ mật khẩu")}
                      >
                        <LockOpenIcon />
                        Gỡ mật khẩu
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      disabled={pending}
                      title={link.allowDownload ? DOWNLOAD_NOTE : undefined}
                      onClick={() =>
                        update(
                          { allowDownload: !link.allowDownload },
                          link.allowDownload ? "Đã tắt tải về" : "Đã bật tải về",
                        )
                      }
                    >
                      <DownloadIcon />
                      {link.allowDownload ? "Tắt tải về" : "Bật tải về"}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem variant="destructive" onClick={onRevoke}>
                  <XIcon />
                  Thu hồi
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      {expanded && (
        <div className="sm:pl-[3.75rem]">
          <LinkFiles linkId={link.id} folderId={link.folder.id} fileCount={link.fileCount} />
        </div>
      )}
    </li>
  );
}

/** Password and download marks, then "42 lượt xem · mở gần nhất 2 giờ trước · 5 lượt tải". */
function LinkStats({ link }: { link: ShareLinkRow }) {
  const parts =
    link.viewCount === 0 && link.downloadCount === 0
      ? ["Chưa ai mở"]
      : [
          `${link.viewCount} lượt xem`,
          ...(link.lastViewedAt ? [`mở gần nhất ${formatRelative(link.lastViewedAt)}`] : []),
          ...(link.downloadCount > 0 ? [`${link.downloadCount} lượt tải`] : []),
        ];
  return (
    <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <LinkFlags hasPassword={link.hasPassword} allowDownload={link.allowDownload} />
      <span
        className="truncate"
        title={link.lastViewedAt ? `Mở gần nhất ${formatDateTime(link.lastViewedAt)}` : undefined}
      >
        {parts.join(" · ")}
      </span>
    </p>
  );
}

function StatusBadge({ link, className }: { link: ShareLinkRow; className?: string }) {
  const cls = cn("shrink-0", className);
  if (link.status === "active") {
    return (
      <Badge
        variant="outline"
        className={cls}
        title={link.expiresAt ? formatDateTime(link.expiresAt) : undefined}
      >
        {expiryText(link.expiresAt).text}
      </Badge>
    );
  }
  if (link.status === "expired") {
    return (
      <Badge variant="destructive" className={cls} title={formatDateTime(link.expiresAt!)}>
        Đã hết hạn
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={cls}>
      {DEAD_LABEL[link.status]}
    </Badge>
  );
}
