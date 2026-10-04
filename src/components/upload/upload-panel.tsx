"use client";

import { CheckIcon, ChevronDownIcon, ChevronUpIcon, RotateCwIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/format";
import { useUploads, type UploadItem } from "./upload-provider";

export function UploadPanel() {
  const { items, cancel, retry, clearFinished } = useUploads();
  const [collapsed, setCollapsed] = useState(false);
  if (items.length === 0) return null;

  const running = items.filter((it) => it.status === "uploading" || it.status === "finishing");
  const failed = items.filter((it) => it.status === "error").length;
  const total = items.reduce((sum, it) => sum + it.size, 0);
  const sent = items.reduce((sum, it) => sum + it.bytesUploaded, 0);

  const title = running.length
    ? `Đang upload ${running.length} file`
    : failed
      ? `${failed} file lỗi`
      : "Upload hoàn tất";

  return (
    <Card size="sm" className="fixed right-4 bottom-4 z-40 w-[calc(100%-2rem)] gap-2 shadow-lg sm:w-96">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardAction className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={collapsed ? "Mở rộng" : "Thu gọn"}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </Button>
          {running.length === 0 && (
            <Button variant="ghost" size="icon-sm" aria-label="Đóng" onClick={clearFinished}>
              <XIcon />
            </Button>
          )}
        </CardAction>
        {running.length > 0 && (
          <Progress value={total ? (sent / total) * 100 : 0} className="col-span-2" />
        )}
      </CardHeader>
      {!collapsed && (
        <CardContent className="max-h-72 space-y-3 overflow-y-auto">
          {items.map((it) => (
            <UploadRow key={it.id} item={it} onCancel={cancel} onRetry={retry} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function UploadRow({
  item,
  onCancel,
  onRetry,
}: {
  item: UploadItem;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const percent = item.size ? (item.bytesUploaded / item.size) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm" title={item.name}>
          {item.name}
        </p>
        {item.status === "error" ? (
          <p className="truncate text-xs text-destructive" title={item.error}>
            {item.error ?? "Lỗi upload"}
          </p>
        ) : item.status === "done" ? (
          <p className="text-xs text-muted-foreground">{formatBytes(item.size)}</p>
        ) : (
          <>
            <Progress value={percent} />
            <p className="text-xs text-muted-foreground">
              {item.status === "finishing"
                ? "Đang hoàn tất…"
                : `${formatBytes(item.bytesUploaded)} / ${formatBytes(item.size)}`}
            </p>
          </>
        )}
      </div>
      {item.status === "done" ? (
        <CheckIcon className="size-4 text-emerald-600" />
      ) : (
        <div className="flex">
          {item.status === "error" && (
            <Button variant="ghost" size="icon-xs" aria-label="Thử lại" onClick={() => onRetry(item.id)}>
              <RotateCwIcon />
            </Button>
          )}
          {item.status !== "finishing" && (
            <Button variant="ghost" size="icon-xs" aria-label="Huỷ" onClick={() => onCancel(item.id)}>
              <XIcon />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
