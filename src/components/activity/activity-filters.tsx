"use client";

import { XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const GROUPS = [
  { value: "file", label: "File" },
  { value: "folder", label: "Folder" },
  { value: "share", label: "Quyền thành viên" },
  { value: "link", label: "Link chia sẻ" },
  { value: "user", label: "Tài khoản" },
];

const field =
  "h-9 rounded-lg border border-input bg-input/30 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Who / what / when filters for the admin log, kept in the URL. */
export function ActivityFilters({ users }: { users: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = ["actor", "group", "from", "to"].some((k) => params.get(k));

  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }

  return (
    <div role="group" aria-label="Lọc nhật ký" className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Người làm
        <select className={cn(field, "min-w-40")} value={params.get("actor") ?? ""} onChange={(e) => set("actor", e.target.value)}>
          <option value="">Tất cả</option>
          <option value="system">Hệ thống</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Loại
        <select className={cn(field, "min-w-40")} value={params.get("group") ?? ""} onChange={(e) => set("group", e.target.value)}>
          <option value="">Tất cả</option>
          {GROUPS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Từ ngày
        <Input type="date" className="h-9 w-40" value={params.get("from") ?? ""} onChange={(e) => set("from", e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Đến ngày
        <Input type="date" className="h-9 w-40" value={params.get("to") ?? ""} onChange={(e) => set("to", e.target.value)} />
      </label>
      {active && (
        <Button variant="ghost" onClick={() => router.replace(pathname, { scroll: false })}>
          <XIcon data-icon="inline-start" />
          Bỏ lọc
        </Button>
      )}
    </div>
  );
}
