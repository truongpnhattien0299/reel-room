/** Where a user's avatar is served, or null. The key's uuid busts caches on change. */
export function avatarUrl(user: { id: string; image?: string | null }) {
  if (!user.image) return null;
  const version = user.image.split("/").pop()?.replace(/\.webp$/, "") ?? "";
  return `/api/avatars/${encodeURIComponent(user.id)}?v=${version}`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
