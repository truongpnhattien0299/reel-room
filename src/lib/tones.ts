/**
 * Muted "contact sheet" tones used where there is no picture yet: empty
 * folder covers, files without a thumbnail, the login collage.
 */
export const TONES = [
  { sky: "#3a3f47", ground: "#23272d" },
  { sky: "#5b4b3e", ground: "#3a2f26" },
  { sky: "#2e4642", ground: "#1c2c29" },
  { sky: "#4b3f57", ground: "#2e2636" },
  { sky: "#6a5f49", ground: "#463e2f" },
  { sky: "#384a5e", ground: "#22303d" },
  { sky: "#574036", ground: "#372820" },
  { sky: "#44503a", ground: "#2b3324" },
] as const;

/** Stable tone for an id, so a folder keeps its color across renders. */
export function toneFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return TONES[Math.abs(hash) % TONES.length];
}
