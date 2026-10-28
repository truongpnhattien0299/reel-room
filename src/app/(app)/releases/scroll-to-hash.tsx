"use client";

import { useEffect } from "react";

/** The page streams in after the loading skeleton, so the browser's own jump to `#…` misses. */
export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
  return null;
}
