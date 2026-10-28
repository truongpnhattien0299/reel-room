"use client";

import { ChevronRightIcon, FolderIcon, InfoIcon, Loader2Icon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getMoveTargets, moveFiles, moveFolder } from "@/server/actions";

type Target = { id: string; name: string; parentId: string | null; path: string };

export type MoveItems =
  | { kind: "files"; ids: string[]; label: string }
  | { kind: "folder"; id: string; name: string };

const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/**
 * Picks a destination folder (one the user can edit) for some files of one
 * folder or for one subfolder, then moves them there.
 */
export function MoveDialog({
  open,
  onOpenChange,
  items,
  sourceFolderId,
  onMoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MoveItems;
  /** The folder the items sit in now. */
  sourceFolderId: string;
  onMoved?: () => void;
}) {
  const router = useRouter();
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [linkedFiles, setLinkedFiles] = useState(0);
  const [loadError, setLoadError] = useState<string>();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [destId, setDestId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fileKey = items.kind === "files" ? items.ids.join(",") : "";
  useEffect(() => {
    if (!open) return;
    let live = true;
    void getMoveTargets(fileKey ? fileKey.split(",") : []).then((res) => {
      if (!live) return;
      if (res.error || !res.data) return setLoadError(res.error ?? "Không tải được danh sách folder");
      setTargets(res.data.folders);
      setTruncated(res.data.truncated);
      setLinkedFiles(res.data.linkedFiles);
      // Start with the current folder in view.
      const source = res.data.folders.find((f) => f.id === sourceFolderId);
      if (source) setExpanded(new Set(source.path.split("/")));
    });
    return () => {
      live = false;
    };
  }, [open, fileKey, sourceFolderId]);

  const tree = useMemo(() => {
    const byId = new Map((targets ?? []).map((t) => [t.id, t]));
    const children = new Map<string | null, Target[]>();
    for (const t of targets ?? []) {
      // Folders whose parent the user can't edit start their own branch.
      const parent = t.parentId && byId.has(t.parentId) ? t.parentId : null;
      children.set(parent, [...(children.get(parent) ?? []), t]);
    }
    return { byId, children };
  }, [targets]);

  const movedPath = items.kind === "folder" ? tree.byId.get(items.id)?.path : undefined;
  const disabled = (t: Target) =>
    t.id === sourceFolderId ||
    (movedPath !== undefined && (t.path === movedPath || t.path.startsWith(`${movedPath}/`)));

  const pathLabel = (t: Target) =>
    t.path
      .split("/")
      .slice(0, -1)
      .map((id) => tree.byId.get(id)?.name)
      .filter(Boolean)
      .join(" / ");

  const term = fold(query.trim());
  const matches = term && targets ? targets.filter((t) => fold(t.name).includes(term)).slice(0, 100) : null;
  const dest = destId ? tree.byId.get(destId) : undefined;
  const source = tree.byId.get(sourceFolderId);
  const leavesRoot = dest && source && dest.path.split("/")[0] !== source.path.split("/")[0];
  // Access is inherited, so it changes wherever the two ancestor chains differ.
  const within = (inner: Target, outer: Target) =>
    inner.path === outer.path || inner.path.startsWith(`${outer.path}/`);
  const losesAccess = dest && source && !within(dest, source);
  const gainsAccess = dest && source && !within(source, dest);

  function close(next: boolean) {
    if (!next) {
      setQuery("");
      setDestId(null);
      setLoadError(undefined);
    }
    onOpenChange(next);
  }

  function submit() {
    if (!dest) return;
    startTransition(async () => {
      const res =
        items.kind === "files" ? await moveFiles(items.ids, dest.id) : await moveFolder(items.id, dest.id);
      if (res.error) return void toast.error(res.error);
      const what = items.kind === "files" ? items.label : `“${items.name}”`;
      toast.success(`Đã chuyển ${what} tới “${dest.name}”`, {
        action: { label: "Mở folder", onClick: () => router.push(`/f/${dest.id}`) },
      });
      onMoved?.();
      close(false);
    });
  }

  function row(t: Target, depth: number) {
    const kids = tree.children.get(t.id) ?? [];
    const isOpen = expanded.has(t.id);
    const off = disabled(t);
    return (
      <li key={t.id}>
        <div
          className={cn(
            "flex min-h-10 items-center gap-1 rounded-lg py-0.5 pr-2 transition-colors",
            destId === t.id ? "bg-primary/20 ring-1 ring-primary/60" : !off && "hover:bg-muted",
          )}
          style={{ paddingLeft: depth * 18 + 4 }}
        >
          {kids.length > 0 && !matches ? (
            <button
              type="button"
              aria-label={isOpen ? `Thu gọn ${t.name}` : `Mở ${t.name}`}
              aria-expanded={isOpen}
              onClick={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(t.id)) next.delete(t.id);
                  else next.add(t.id);
                  return next;
                })
              }
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRightIcon className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
            </button>
          ) : (
            <span className="size-7 shrink-0" />
          )}
          <button
            type="button"
            disabled={off}
            aria-pressed={destId === t.id}
            onClick={() => setDestId(t.id)}
            className="flex h-full min-w-0 flex-1 items-center gap-2 text-left text-sm outline-none focus-visible:underline disabled:cursor-not-allowed disabled:opacity-45"
          >
            <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate" title={t.name}>
                {t.name}
                {t.id === sourceFolderId && <span className="text-muted-foreground"> · đang ở đây</span>}
              </span>
              {matches && pathLabel(t) && (
                <span className="truncate text-xs text-muted-foreground">{pathLabel(t)}</span>
              )}
            </span>
          </button>
        </div>
        {!matches && isOpen && kids.length > 0 && <ul>{kids.map((k) => row(k, depth + 1))}</ul>}
      </li>
    );
  }

  const title =
    items.kind === "files" ? `Di chuyển ${items.label}` : `Di chuyển “${items.name}”`;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{title}</DialogTitle>
          <DialogDescription>Chọn folder đích. Chỉ hiện folder bạn có quyền chỉnh sửa.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm folder theo tên"
            aria-label="Tìm folder"
            className="pl-9"
          />
        </div>

        <div className="h-72 overflow-y-auto rounded-xl bg-background/40 p-1 ring-1 ring-border">
          {loadError ? (
            <p className="p-4 text-sm text-destructive">{loadError}</p>
          ) : !targets ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" /> Đang tải…
            </p>
          ) : matches ? (
            matches.length ? (
              <ul>{matches.map((t) => row(t, 0))}</ul>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">Không có folder nào khớp.</p>
            )
          ) : truncated ? (
            <p className="p-4 text-sm text-muted-foreground">Có quá nhiều folder. Gõ tên để tìm.</p>
          ) : (
            <ul>{(tree.children.get(null) ?? []).map((t) => row(t, 0))}</ul>
          )}
        </div>

        {dest && (losesAccess || gainsAccess || linkedFiles > 0) && (
          <div className="flex gap-2.5 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-1">
              {(losesAccess || gainsAccess) && (
                <p>
                  {leavesRoot && <strong className="text-foreground">Chuyển sang folder gốc khác. </strong>}
                  Quyền xem đi theo chỗ mới:
                  {losesAccess && ` người chỉ có quyền ở “${source.name}” sẽ không còn thấy`}
                  {losesAccess && gainsAccess && ";"}
                  {gainsAccess && ` người có quyền ở “${dest.name}” sẽ thấy`}.
                </p>
              )}
              {linkedFiles > 0 && (
                <p>{linkedFiles} file đang nằm trong link chia sẻ sẽ bị gỡ khỏi link.</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Huỷ
          </Button>
          <Button type="button" disabled={!dest || pending} onClick={submit}>
            Chuyển tới đây
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
