"use client";

import { HistoryIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { loadActivity } from "@/server/actions";
import type { listActivity } from "@/server/activity";
import { ActivityList } from "./activity-list";

type Page = Awaited<ReturnType<typeof listActivity>>;

/** Header button for folder owners: the folder's activity in a side sheet. */
export function FolderActivityButton({ folder }: { folder: { id: string; name: string } }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState<string>();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    // Fresh on every open: things may have happened since.
    setPage(null);
    setError(undefined);
    void loadActivity({ folderId: folder.id }).then((res) =>
      res.data ? setPage(res.data) : setError(res.error ?? "Không tải được"),
    );
  }

  return (
    <>
      <Button variant="outline" size="xl" onClick={() => onOpenChange(true)}>
        <HistoryIcon data-icon="inline-start" />
        Hoạt động
      </Button>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b border-border">
            <SheetTitle className="font-display text-lg">Hoạt động</SheetTitle>
            <SheetDescription className="truncate">“{folder.name}” và các folder con</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : page ? (
              <ActivityList filter={{ folderId: folder.id }} initial={page} />
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" /> Đang tải…
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
