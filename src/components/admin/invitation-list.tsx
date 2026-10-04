"use client";

import { CheckIcon, CopyIcon, MailIcon, RotateCwIcon, XIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { absoluteUrl, copyText, useCopy } from "@/components/copy-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatRelative } from "@/lib/format";
import { invitePath } from "@/lib/media";
import { cn } from "@/lib/utils";
import { inviteUser, revokeInvite } from "@/server/actions";
import type { InvitationItem } from "@/server/invitations";

/** Invites nobody has used yet: copy the link, renew it, or revoke it. */
export function InvitationList({ invitations }: { invitations: InvitationItem[] }) {
  const [pending, startTransition] = useTransition();
  const { copied, copy } = useCopy();

  function renew(inv: InvitationItem) {
    startTransition(async () => {
      const res = await inviteUser({ email: inv.email, role: inv.role === "admin" ? "admin" : "user" });
      if (res.error || !res.data) {
        toast.error(res.error ?? "Không tạo được link mới");
        return;
      }
      const copiedLink = await copyText(absoluteUrl(invitePath(res.data.token)));
      const parts = [
        "Đã tạo link mới",
        res.data.emailed && "gửi lại email",
        copiedLink && "sao chép link",
      ].filter(Boolean);
      toast.success(parts.join(", "));
    });
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="invitations-heading">
      <h2 id="invitations-heading" className="font-display text-lg font-semibold">
        Lời mời đang chờ
      </h2>
      <ul className="flex flex-col gap-1 rounded-[18px] bg-card p-1.5 ring-1 ring-border">
        {invitations.map((inv) => {
          const { expired, text } = expiryText(inv.expiresAt);
          const path = invitePath(inv.token);
          return (
            <li key={inv.id} className="flex items-center gap-3 rounded-xl px-2.5 py-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-background ring-1 ring-border">
                <MailIcon className="size-4 text-primary" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-medium">
                  {inv.email}
                  {inv.role === "admin" && <Badge>Admin</Badge>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  <span className={cn(expired && "text-destructive")} title={formatDateTime(inv.expiresAt)}>
                    {text}
                  </span>
                  {inv.invitedByName && ` · ${inv.invitedByName} mời`}
                </p>
              </div>
              {!expired && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Sao chép link mời ${inv.email}`}
                  onClick={() => copy(absoluteUrl(path))}
                >
                  {copied?.endsWith(path) ? <CheckIcon /> : <CopyIcon />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Tạo link mới và gửi lại email cho ${inv.email}`}
                title="Tạo link mới, gửi lại email"
                disabled={pending}
                onClick={() => renew(inv)}
              >
                <RotateCwIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Thu hồi lời mời ${inv.email}`}
                title="Thu hồi"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await revokeInvite(inv.id);
                    if (res.error) toast.error(res.error);
                    else toast.success("Đã thu hồi lời mời");
                  })
                }
              >
                <XIcon />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function expiryText(expiresAt: Date) {
  if (expiresAt.getTime() <= Date.now()) return { text: "Đã hết hạn", expired: true };
  return { text: `Hết hạn ${formatRelative(expiresAt)}`, expired: false };
}
