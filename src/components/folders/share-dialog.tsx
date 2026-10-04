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
import { getFolderMembers, revokeShare, shareFolder } from "@/server/actions";

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

export function ShareDialog({
  folder,
  open,
  onOpenChange,
  currentUserId,
}: {
  folder: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [role, setRole] = useState<FolderRole>("viewer");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const reload = () => getFolderMembers(folder.id).then(setMembers);

  useEffect(() => {
    if (open) void getFolderMembers(folder.id).then(setMembers);
  }, [open, folder.id]);

  function update(email: string, nextRole: FolderRole) {
    startTransition(async () => {
      const res = await shareFolder(folder.id, { email, role: nextRole });
      if (res.error) toast.error(res.error);
      await reload();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chia sẻ “{folder.name}”</DialogTitle>
          <DialogDescription>
            Quyền áp dụng cho folder này và mọi folder con bên trong.
          </DialogDescription>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
