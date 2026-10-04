"use client";

import { XIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { FolderRole } from "@/db/schema";
import { cn } from "@/lib/utils";
import { getFolderMembers, revokeShare, shareFolder } from "@/server/actions";
import { FolderShareLinks } from "./share-links";

const ROLE_LABELS: Record<FolderRole, string> = {
  viewer: "Chỉ xem",
  editor: "Chỉnh sửa",
  owner: "Chủ sở hữu",
};

type Member = Awaited<ReturnType<typeof getFolderMembers>>[number];

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: FolderRole;
  onChange: (role: FolderRole) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      items={ROLE_LABELS}
      value={value}
      onValueChange={(v) => v && onChange(v as FolderRole)}
      disabled={disabled}
    >
      <SelectTrigger className="w-32" aria-label="Quyền">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(ROLE_LABELS) as FolderRole[]).map((role) => (
          <SelectItem key={role} value={role}>
            {ROLE_LABELS[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type Tab = "members" | "links";

/**
 * Owners manage who has access and public links; editors only get the
 * public links tab.
 */
export function ShareDialog({
  folder,
  role,
  open,
  onOpenChange,
  currentUserId,
}: {
  folder: { id: string; name: string };
  role: FolderRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
}) {
  const isOwner = role === "owner";
  const [tab, setTab] = useState<Tab>(isOwner ? "members" : "links");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chia sẻ “{folder.name}”</DialogTitle>
          <DialogDescription>
            {tab === "members"
              ? "Quyền áp dụng cho folder này và mọi folder con bên trong."
              : "Ai có link đều xem và tải được, không cần đăng nhập. Link cả folder gồm luôn các folder con."}
          </DialogDescription>
        </DialogHeader>

        {isOwner && (
          <div role="tablist" aria-label="Kiểu chia sẻ" className="flex gap-1 rounded-xl bg-card p-1 ring-1 ring-border">
            {(
              [
                ["members", "Thành viên"],
                ["links", "Link chia sẻ"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={cn(
                  "h-8 flex-1 rounded-[9px] text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tab === value
                    ? "bg-[#2a2e37] font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {tab === "members" ? (
          <Members folder={folder} currentUserId={currentUserId} />
        ) : (
          <FolderShareLinks folderId={folder.id} currentUserId={currentUserId} isOwner={isOwner} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Members({
  folder,
  currentUserId,
}: {
  folder: { id: string; name: string };
  currentUserId: string;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [role, setRole] = useState<FolderRole>("viewer");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const reload = () => getFolderMembers(folder.id).then(setMembers);

  useEffect(() => {
    void getFolderMembers(folder.id).then(setMembers);
  }, [folder.id]);

  function update(email: string, nextRole: FolderRole) {
    startTransition(async () => {
      const res = await shareFolder(folder.id, { email, role: nextRole });
      if (res.error) toast.error(res.error);
      await reload();
    });
  }

  return (
    <>
      <form
        className="flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const email = String(new FormData(form).get("email"));
          startTransition(async () => {
            const res = await shareFolder(folder.id, { email, role });
            if (res.error) {
              setError(res.error);
              return;
            }
            setError(undefined);
            form.reset();
            await reload();
          });
        }}
      >
        <Field data-invalid={error ? true : undefined} className="flex-1">
          <Input name="email" type="email" placeholder="email@congty.com" aria-label="Email" required />
          {error && <FieldError>{error}</FieldError>}
        </Field>
        <RoleSelect value={role} onChange={setRole} />
        <Button type="submit" disabled={pending}>
          Mời
        </Button>
      </form>

      <Separator />

      <ul className="max-h-72 space-y-3 overflow-y-auto">
        {members === null ? (
          <li className="text-muted-foreground">Đang tải…</li>
        ) : members.length === 0 ? (
          <li className="text-muted-foreground">
            Chưa chia sẻ trực tiếp với ai. Người có quyền ở folder cha vẫn truy cập được.
          </li>
        ) : (
          members.map((m) => {
            const isSelf = m.userId === currentUserId;
            return (
              <li key={m.userId} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.name}
                    {isSelf && " (bạn)"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                <RoleSelect
                  value={m.role}
                  onChange={(r) => update(m.email, r)}
                  disabled={pending || isSelf}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Gỡ quyền của ${m.name}`}
                  disabled={pending || isSelf}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await revokeShare(folder.id, m.userId);
                      if (res.error) toast.error(res.error);
                      await reload();
                    })
                  }
                >
                  <XIcon />
                </Button>
              </li>
            );
          })
        )}
      </ul>
    </>
  );
}
