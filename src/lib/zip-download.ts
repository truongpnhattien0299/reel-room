import { downloadZip as zipResponse } from "client-zip";

/** Without a file picker the zip is built in memory; past this the tab may crash. */
export const BLOB_ZIP_LIMIT = 2 * 1024 ** 3;

export type ZipProgress = { files: number; totalFiles: number; bytes: number; totalBytes: number };

type Listing = { zipName: string; entries: { path: string; size: number; url: string }[] };

// Chromium's File System Access API; not in TypeScript's DOM lib yet.
type SaveFilePicker = (opts: {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{ createWritable: () => Promise<WritableStream<Uint8Array>> }>;

export class ZipCancelled extends Error {}

/**
 * Downloads files as one zip built in the browser: `endpoint` lists signed R2
 * URLs, each file streams from R2 straight into the zip, so nothing passes
 * through the app server. Where the browser can write to disk (Chromium) the
 * zip streams to a file the user picks; elsewhere it's built in memory, up to
 * `BLOB_ZIP_LIMIT`. Throws `ZipCancelled` when the user backs out.
 */
export async function downloadZip(
  endpoint: string,
  body: object,
  opts: { suggestedName: string; signal: AbortSignal; onProgress: (p: ZipProgress) => void },
) {
  const { signal } = opts;
  // Ask where to save first, while the click still counts as a user gesture.
  const picker = (window as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  let writable: WritableStream<Uint8Array> | null = null;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: opts.suggestedName,
        types: [{ description: "File zip", accept: { "application/zip": [".zip"] } }],
      });
      writable = await handle.createWritable();
    } catch (err) {
      if ((err as Error).name === "AbortError") throw new ZipCancelled();
      throw err;
    }
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const data = (await res.json().catch(() => ({}))) as Partial<Listing> & { error?: string };
    if (!res.ok || !data.entries) throw new Error(data.error ?? "Không lấy được danh sách file");
    const { entries } = data;

    const progress: ZipProgress = {
      files: 0,
      totalFiles: entries.length,
      bytes: 0,
      totalBytes: entries.reduce((sum, e) => sum + e.size, 0),
    };
    if (!writable && progress.totalBytes > BLOB_ZIP_LIMIT) {
      throw new Error("Trình duyệt này chỉ nén được tối đa 2 GB. Hãy dùng Chrome hoặc Edge, hoặc tải từng phần.");
    }
    let lastReport = 0;
    const report = (force = false) => {
      const now = performance.now();
      if (force || now - lastReport > 150) {
        lastReport = now;
        opts.onProgress({ ...progress });
      }
    };
    report(true);

    async function* files() {
      for (const e of entries) {
        const file = await fetch(e.url, { signal });
        if (!file.ok || !file.body) throw new Error(`Không tải được “${e.path}”`);
        const counted = file.body.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, ctrl) {
              progress.bytes += chunk.byteLength;
              report();
              ctrl.enqueue(chunk);
            },
            flush() {
              progress.files++;
              report(true);
            },
          }),
        );
        yield { name: e.path, input: counted, size: e.size };
      }
    }

    // Stored, not deflated: photos and videos are compressed already.
    const zip = zipResponse(files(), { metadata: entries.map((e) => ({ name: e.path, size: e.size })) }).body!;
    if (writable) {
      await zip.pipeTo(writable, { signal });
    } else {
      const blob = await new Response(zip).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = data.zipName ?? opts.suggestedName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    }
  } catch (err) {
    // pipeTo already aborts the file on errors; this covers failures before it.
    await writable?.abort().catch(() => {});
    if (signal.aborted) throw new ZipCancelled();
    throw err;
  }
}
