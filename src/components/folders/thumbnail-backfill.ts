import { extractMediaInfoFromUrl, uploadThumbnailBlob } from "@/components/upload/thumbnail";
import { thumbSourceUrl } from "@/lib/media";
import { attachThumbnail, signThumbnailUpload } from "@/server/actions";

// Once per file per page load: formats the browser can't decode would
// otherwise be re-downloaded every time they're opened.
const attempted = new Set<string>();

/**
 * Makes the thumbnail an upload didn't get (it failed to reach storage back
 * then) from the stored original. Silent: the viewer works either way.
 */
export async function backfillThumbnail(file: { id: string; mimeType: string }) {
  if (attempted.has(file.id)) return;
  attempted.add(file.id);

  try {
    const { thumb } = await extractMediaInfoFromUrl(thumbSourceUrl(file.id), file.mimeType);
    if (!thumb) return;
    const uploaded = await uploadThumbnailBlob(file.id, thumb, async () => {
      const res = await signThumbnailUpload(file.id);
      if (!res.data) throw new Error(res.error ?? "Không ký được URL");
      return res.data;
    });
    if (uploaded) await attachThumbnail(file.id);
  } catch (err) {
    console.warn(`[thumbnail] backfill failed for ${file.id}:`, err);
  }
}
