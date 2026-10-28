"use client";

import { useEffect } from "react";

/** Counts this visit once per page load (the server dedupes per browser and day). */
export function ViewBeacon({ token }: { token: string }) {
  useEffect(() => {
    void fetch(`/api/s/${encodeURIComponent(token)}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [token]);
  return null;
}
