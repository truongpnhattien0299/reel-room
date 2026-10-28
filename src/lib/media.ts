/** URL and type helpers shared by server and client components. */
export const contentUrl = (id: string) => `/api/files/${id}/content`;
export const downloadUrl = (id: string) => `/api/files/${id}/content?download=1`;
export const thumbUrl = (id: string) => `/api/files/${id}/thumb`;
/** Uncached original, readable by a canvas (to make a missing thumbnail). */
export const thumbSourceUrl = (id: string) => `/api/files/${id}/content?fresh=1`;
export const isVideo = (file: { mimeType: string }) => file.mimeType.startsWith("video/");
export const isAudio = (file: { mimeType: string }) => file.mimeType.startsWith("audio/");

export type MediaKind = "image" | "video" | "audio";
export const mediaKind = (file: { mimeType: string }): MediaKind =>
  isVideo(file) ? "video" : isAudio(file) ? "audio" : "image";

export type MediaUrls = {
  content: (id: string) => string;
  download: (id: string) => string;
  thumb: (id: string) => string;
  /** POST endpoint listing what goes into a zip (see `src/lib/zip-download.ts`). */
  zip: string;
};

export const memberMediaUrls: MediaUrls = {
  content: contentUrl,
  download: downloadUrl,
  thumb: thumbUrl,
  zip: "/api/downloads",
};

/** Same files, served through a public link instead of the member's session. */
export function sharedMediaUrls(token: string): MediaUrls {
  const base = `/api/s/${encodeURIComponent(token)}/files`;
  return {
    content: (id) => `${base}/${id}/content`,
    download: (id) => `${base}/${id}/content?download=1`,
    thumb: (id) => `${base}/${id}/thumb`,
    zip: `/api/s/${encodeURIComponent(token)}/downloads`,
  };
}

export const shareLinkPath = (token: string) => `/s/${token}`;

/** Sign-up page for an invited user. */
export const invitePath = (token: string) => `/invite/${token}`;
