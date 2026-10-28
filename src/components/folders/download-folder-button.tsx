"use client";

import { DownloadIcon } from "lucide-react";
import { startZipDownload } from "@/components/download-progress";
import { Button } from "@/components/ui/button";
import { useMediaUrls } from "./media-urls";

/** Downloads a folder, subfolders included, as `<name>.zip`. */
export function DownloadFolderButton({
  folder,
  label = "Tải về",
}: {
  folder: { id: string; name: string };
  label?: string;
}) {
  const { zip } = useMediaUrls();
  if (!zip) return null;
  return (
    <Button
      variant="outline"
      size="xl"
      onClick={() => void startZipDownload(zip, { folderId: folder.id }, `${folder.name}.zip`)}
    >
      <DownloadIcon data-icon="inline-start" />
      {label}
    </Button>
  );
}
