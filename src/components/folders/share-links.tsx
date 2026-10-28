"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  FolderIcon,
  ImagesIcon,
  Link2Icon,
  LockIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/auth/password-input";
import { absoluteUrl, copyText, CopyLinkField, useCopy } from "@/components/copy-link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDateTime, formatRelative } from "@/lib/format";
import { shareLinkPath } from "@/lib/media";
import { cn } from "@/lib/utils";
import { createShareLink, deleteShareLink, getShareLinks } from "@/server/actions";
import type { ShareLinkItem } from "@/server/share-links";

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

const EXPIRY_LABELS = {
  "1": "1 ngày",
  "7": "7 ngày",
  "30": "30 ngày",
  never: "Không hết hạn",
  custom: "Chọn ngày…",
} as const;

type ExpiryChoice = keyof typeof EXPIRY_LABELS;
export type Expiry = { choice: ExpiryChoice; date: string };

export const DEFAULT_EXPIRY: Expiry = { choice: "7", date: "" };

const DAY = 86_400_000;
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The expiry to send: null for never, undefined while a custom date is missing. */
export function expiryDate({ choice, date }: Expiry): Date | null | undefined {
  if (choice === "never") return null;
  if (choice === "custom") return date ? new Date(`${date}T23:59:59`) : undefined;
  return new Date(Date.now() + Number(choice) * DAY);
}

export function ExpiryPicker({
  value,
  onChange,
  disabled,
}: {
  value: Expiry;
  onChange: (value: Expiry) => void;
  disabled?: boolean;
}) {
  const today = new Date();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field className="w-40 gap-1.5">
        <FieldLabel className="text-xs text-muted-foreground">Hết hạn sau</FieldLabel>
        <Select
          items={EXPIRY_LABELS}
          value={value.choice}
          onValueChange={(v) => v && onChange({ ...value, choice: v as ExpiryChoice })}
          disabled={disabled}
        >
          <SelectTrigger aria-label="Thời hạn link">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(EXPIRY_LABELS) as ExpiryChoice[]).map((c) => (
              <SelectItem key={c} value={c}>
                {EXPIRY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {value.choice === "custom" && (
        <Input
          type="date"
          aria-label="Ngày hết hạn"
          className="w-40"
          min={isoDay(today)}
          max={isoDay(new Date(today.getTime() + 365 * DAY))}
          value={value.date}
          onChange={(e) => onChange({ ...value, date: e.target.value })}
          disabled={disabled}
          required
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Password and downloads
// ---------------------------------------------------------------------------

export type LinkOptions = { password: string; allowDownload: boolean };
export const DEFAULT_LINK_OPTIONS: LinkOptions = { password: "", allowDownload: true };

/** What `createShareLink` takes from the options: an empty password means none. */
export const linkOptionsInput = ({ password, allowDownload }: LinkOptions) => ({
  password: password || undefined,
  allowDownload,
});

export const DOWNLOAD_NOTE = "Người xem vẫn có thể lưu ảnh khi đang xem; tuỳ chọn này chỉ ẩn nút tải.";

/** Lets a visitor download what the link shows. */
export function AllowDownloadField({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Field orientation="horizontal" className="items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <FieldLabel htmlFor="allow-download">Cho phép tải về</FieldLabel>
        <FieldDescription className="text-xs">{DOWNLOAD_NOTE}</FieldDescription>
      </div>
      <Switch id="allow-download" checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </Field>
  );
}

/** A folded "Tuỳ chọn" section: password and downloads, for a new link. */
export function LinkOptionsFields({
  value,
  onChange,
  disabled,
}: {
  value: LinkOptions;
  onChange: (value: LinkOptions) => void;
  disabled?: boolean;
}) {
  const changed = value.password !== "" || !value.allowDownload;
  const [open, setOpen] = useState(changed);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="link-options"
        onClick={() => setOpen(!open)}
        className="flex h-9 items-center gap-1.5 self-start rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronDownIcon className={cn("size-4 transition-transform", !open && "-rotate-90")} aria-hidden="true" />
        Tuỳ chọn
        {!open && changed && <LinkFlags hasPassword={value.password !== ""} allowDownload={value.allowDownload} />}
      </button>
      {open && (
        <div id="link-options" className="flex flex-col gap-4 rounded-xl bg-card p-3.5 ring-1 ring-border">
          <Field className="gap-1.5">
            <FieldLabel htmlFor="link-password">Mật khẩu (không bắt buộc)</FieldLabel>
            <PasswordInput
              id="link-password"
              autoComplete="new-password"
              maxLength={128}
              placeholder="Để trống nếu không cần"
              value={value.password}
              onChange={(e) => onChange({ ...value, password: e.target.value })}
              disabled={disabled}
            />
            <FieldDescription className="text-xs">
              Tối thiểu 4 ký tự. Gửi mật khẩu cho người nhận qua kênh khác với link.
            </FieldDescription>
          </Field>
          <AllowDownloadField
            checked={value.allowDownload}
            onCheckedChange={(allowDownload) => onChange({ ...value, allowDownload })}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

/** Small marks for a link's password and download setting. */
export function LinkFlags({ hasPassword, allowDownload }: { hasPassword: boolean; allowDownload: boolean }) {
  if (!hasPassword && allowDownload) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 align-middle whitespace-nowrap">
      {hasPassword && (
        <span title="Có mật khẩu" className="inline-flex text-muted-foreground">
          <LockIcon className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Có mật khẩu</span>
        </span>
      )}
      {!allowDownload && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground">
          <DownloadIcon className="size-3" aria-hidden="true" />
          Không cho tải
        </span>
      )}
    </span>
  );
}

const linkUrl = (token: string) => absoluteUrl(shareLinkPath(token));

// ---------------------------------------------------------------------------
// Folder links (inside the share dialog)
// ---------------------------------------------------------------------------

export function expiryText(expiresAt: Date | null) {
  if (!expiresAt) return { text: "Không hết hạn", expired: false };
  if (expiresAt.getTime() <= Date.now()) return { text: "Đã hết hạn", expired: true };
  return { text: `Hết hạn ${formatRelative(expiresAt)}`, expired: false };
}

/** Create a link to the whole folder and manage every link made in it. */
export function FolderShareLinks({
  folderId,
  currentUserId,
  isOwner,
}: {
  folderId: string;
  currentUserId: string;
  isOwner: boolean;
}) {
  const [links, setLinks] = useState<ShareLinkItem[] | null>(null);
  const [expiry, setExpiry] = useState(DEFAULT_EXPIRY);
  const [options, setOptions] = useState(DEFAULT_LINK_OPTIONS);
  const [error, setError] = useState<string>();
  const [fresh, setFresh] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { copied, copy } = useCopy();

  const reload = () => getShareLinks(folderId).then(setLinks);

  useEffect(() => {
    void getShareLinks(folderId).then(setLinks);
  }, [folderId]);

  function create() {
    const expiresAt = expiryDate(expiry);
    if (expiresAt === undefined) {
      setError("Chọn ngày hết hạn");
      return;
    }
    startTransition(async () => {
      const res = await createShareLink({ folderId, expiresAt, ...linkOptionsInput(options) });
      if (res.error || !res.data) {
        setError(res.error);
        return;
      }
      setError(undefined);
      setOptions(DEFAULT_LINK_OPTIONS);
      setFresh(res.data.token);
      await reload();
      if (await copyText(linkUrl(res.data.token))) toast.success("Đã tạo và sao chép link");
      else toast.success("Đã tạo link");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <ExpiryPicker value={expiry} onChange={setExpiry} disabled={pending} />
        <Button onClick={create} disabled={pending}>
          <Link2Icon data-icon="inline-start" />
          Tạo link cả folder
        </Button>
      </div>
      <LinkOptionsFields value={options} onChange={setOptions} disabled={pending} />
      {error && <FieldError>{error}</FieldError>}

      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto" aria-label="Link đã tạo">
        {links === null ? (
          <li className="text-muted-foreground">Đang tải…</li>
        ) : links.length === 0 ? (
          <li className="text-muted-foreground">
            Chưa có link nào. Muốn chia sẻ vài file? Bấm “Chọn” trong folder rồi chọn file.
          </li>
        ) : (
          links.map((l) => {
            const exp = expiryText(l.expiresAt);
            const canRevoke = isOwner || l.createdBy === currentUserId;
            const Icon = l.kind === "folder" ? FolderIcon : ImagesIcon;
            return (
              <li
                key={l.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors",
                  fresh === l.token && "bg-primary/10 ring-1 ring-primary/30",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-card ring-1 ring-border">
                  <Icon className="size-4 text-primary" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-2 font-medium">
                    <span className="truncate">{l.kind === "folder" ? "Cả folder" : `${l.fileCount} file đã chọn`}</span>
                    <LinkFlags hasPassword={l.hasPassword} allowDownload={l.allowDownload} />
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span
                      className={cn(exp.expired && "text-destructive")}
                      title={l.expiresAt ? formatDateTime(l.expiresAt) : undefined}
                    >
                      {exp.text}
                    </span>
                    {" · "}
                    {l.createdBy === currentUserId ? "bạn tạo" : l.creatorName}
                  </p>
                </div>
                {!exp.expired && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Sao chép link"
                    onClick={() => copy(linkUrl(l.token))}
                  >
                    {copied?.endsWith(shareLinkPath(l.token)) ? <CheckIcon /> : <CopyIcon />}
                  </Button>
                )}
                {canRevoke && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Thu hồi link"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await deleteShareLink(l.id);
                        if (res.error) toast.error(res.error);
                        else toast.success("Đã thu hồi link");
                        await reload();
                      })
                    }
                  >
                    <XIcon />
                  </Button>
                )}
              </li>
            );
          })
        )}
      </ul>
      <Link href="/links" className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Quản lý mọi link chia sẻ
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selected files
// ---------------------------------------------------------------------------

export function ShareFilesDialog({
  folderId,
  fileIds,
  open,
  onOpenChange,
  onCreated,
}: {
  folderId: string;
  fileIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [expiry, setExpiry] = useState(DEFAULT_EXPIRY);
  const [options, setOptions] = useState(DEFAULT_LINK_OPTIONS);
  const [error, setError] = useState<string>();
  const [token, setToken] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    const expiresAt = expiryDate(expiry);
    if (expiresAt === undefined) {
      setError("Chọn ngày hết hạn");
      return;
    }
    startTransition(async () => {
      const res = await createShareLink({ folderId, fileIds, expiresAt, ...linkOptionsInput(options) });
      if (res.error || !res.data) {
        setError(res.error);
        return;
      }
      setError(undefined);
      setToken(res.data.token);
      onCreated?.();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chia sẻ {fileIds.length} file</DialogTitle>
          <DialogDescription>
            Ai có link (và mật khẩu, nếu đặt) đều xem được các file này, không cần đăng nhập.
          </DialogDescription>
        </DialogHeader>

        {token ? (
          <div className="flex flex-col gap-2">
            <CopyLinkField path={shareLinkPath(token)} label="Link chia sẻ" />
            <p className="text-xs text-muted-foreground">
              Xem lại hoặc thu hồi link ở trang Link chia sẻ.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <ExpiryPicker value={expiry} onChange={setExpiry} disabled={pending} />
            <LinkOptionsFields value={options} onChange={setOptions} disabled={pending} />
            {error && <FieldError>{error}</FieldError>}
          </div>
        )}

        <DialogFooter>
          {token ? (
            <Button onClick={() => onOpenChange(false)}>Xong</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Huỷ
              </Button>
              <Button onClick={create} disabled={pending}>
                <Link2Icon data-icon="inline-start" />
                Tạo link
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
