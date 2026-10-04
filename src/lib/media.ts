/** URL and type helpers shared by server and client components. */
export const contentUrl = (id: string) => `/api/files/${id}/content`;
export const downloadUrl = (id: string) => `/api/files/${id}/content?download=1`;
export const thumbUrl = (id: string) => `/api/files/${id}/thumb`;
export const isVideo = (file: { mimeType: string }) => file.mimeType.startsWith("video/");
