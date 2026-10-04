"use client";

import { CheckIcon, CopyIcon, FolderIcon, ImagesIcon, Link2Icon, XIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
function expiryDate({ choice, date }: Expiry): Date | null | undefined {
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
// Copying
// ---------------------------------------------------------------------------

const absoluteLink = (token: string) => `${window.location.origin}${shareLinkPath(token)}`;

async function copyLink(token: string) {
  try {
    await navigator.clipboard.writeText(absoluteLink(token));
    return true;
  } catch {
    // Clipboard access can be refused (e.g. no recent user gesture).
    return false;
  }
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return {
    copied,
    copy: async (token: string) => {
      if (await copyLink(token)) setCopied(token);
      else toast.error("Không sao chép được, hãy copy link thủ công");
    },
  };
}

/** Read-only link with a copy button. Client-only: shown once a link is created. */
export function CopyLinkField({ token }: { token: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="flex gap-2">
      <Input
        readOnly
        value={absoluteLink(token)}
        aria-label="Link chia sẻ"
        className="font-mono text-xs"
        onFocus={(e) => e.currentTarget.select()}
      />
      <Button onClick={() => copy(token)}>
        {copied === token ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
        {copied === token ? "Đã chép" : "Sao chép"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Folder links (inside the share dialog)
// ---------------------------------------------------------------------------

function expiryText(expiresAt: Date | null) {
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
      const res = await createShareLink({ folderId, expiresAt });
      if (res.error || !res.data) {
        setError(res.error);
        return;
      }
      setError(undefined);
      setFresh(res.data.token);
      await reload();
      if (await copyLink(res.data.token)) toast.success("Đã tạo và sao chép link");
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
                  <p className="truncate font-medium">
                    {l.kind === "folder" ? "Cả folder" : `${l.fileCount} file đã chọn`}
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
                    onClick={() => copy(l.token)}
                  >
                    {copied === l.token ? <CheckIcon /> : <CopyIcon />}
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
      const res = await createShareLink({ folderId, fileIds, expiresAt });
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
            Ai có link đều xem và tải được các file này, không cần đăng nhập.
          </DialogDescription>
        </DialogHeader>

        {token ? (
          <div className="flex flex-col gap-2">
            <CopyLinkField token={token} />
            <p className="text-xs text-muted-foreground">
              Xem lại hoặc thu hồi link trong mục Chia sẻ của folder.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <ExpiryPicker value={expiry} onChange={setExpiry} disabled={pending} />
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
