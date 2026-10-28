import { FolderIcon } from "lucide-react";
import { formatBytes, formatDateTime, formatDuration } from "@/lib/format";
import { mediaKind } from "@/lib/media";
import { toneFor } from "@/lib/tones";
import { cn } from "@/lib/utils";
import type { FileItem } from "@/server/queries";

const KIND_LABEL = { image: "Ảnh", video: "Video", audio: "Audio" };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

/** File details: the viewer's side panel on desktop, a bottom sheet on phones. */
export function InfoPanel({ file, folderName }: { file: FileItem; folderName: string }) {
  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-[13px]">
        <InfoRow label="Loại">
          {KIND_LABEL[mediaKind(file)]} · {file.mimeType.split("/")[1]?.toUpperCase()}
        </InfoRow>
        <InfoRow label="Dung lượng" mono>
          {formatBytes(file.size)}
        </InfoRow>
        {file.width && file.height && (
          <InfoRow label="Độ phân giải" mono>
            {file.width} × {file.height}
          </InfoRow>
        )}
        {file.durationMs !== null && (
          <InfoRow label="Thời lượng" mono>
            {formatDuration(file.durationMs)}
          </InfoRow>
        )}
        <InfoRow label="Tải lên">{formatDateTime(file.createdAt)}</InfoRow>
      </dl>
      <div className="h-px shrink-0 bg-[#1f2229]" />
      {/* Public links leave the uploader out. */}
      {file.uploaderName && (
        <div className="flex flex-col gap-3">
          <SectionLabel>Người tải lên</SectionLabel>
          <div className="flex items-center gap-3">
            <span
              className="flex size-9 items-center justify-center rounded-full text-xs font-semibold"
              style={{ background: toneFor(file.uploaderName).sky }}
            >
              {initials(file.uploaderName)}
            </span>
            <span className="font-medium">{file.uploaderName}</span>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-3">
        <SectionLabel>Vị trí</SectionLabel>
        <span className="flex items-center gap-2.5 rounded-xl bg-card px-3 py-2.5 ring-1 ring-border">
          <FolderIcon className="size-[18px] shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate font-medium">{folderName}</span>
        </span>
      </div>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
      {children}
    </span>
  );
}

function InfoRow({
  label,
  mono,
  children,
}: {
  label: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("m-0 text-right", mono && "font-mono")}>{children}</dd>
    </>
  );
}
