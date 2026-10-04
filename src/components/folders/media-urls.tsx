"use client";

import { createContext, useContext, useMemo } from "react";
import { memberMediaUrls, sharedMediaUrls } from "@/lib/media";

const MediaUrlsContext = createContext(memberMediaUrls);

/** Where thumbnails, previews and downloads load from (session or public link). */
export const useMediaUrls = () => useContext(MediaUrlsContext);

/** Serves everything below through the public link `token`. */
export function SharedMediaUrls({ token, children }: { token: string; children: React.ReactNode }) {
  const urls = useMemo(() => sharedMediaUrls(token), [token]);
  return <MediaUrlsContext value={urls}>{children}</MediaUrlsContext>;
}
