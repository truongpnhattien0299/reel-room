import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { folderPermissions, folders, shareLinks, user, type ShareLink } from "@/db/schema";
import { resetDb } from "../../test/setup/db";
import { grant, makeFolder, makeShareLink, makeUser, sessionFor } from "../../test/setup/factories";
import { listAllShareLinks, resolveShareLink, type ShareLinkStatus } from "./share-links";

beforeEach(resetDb);

const HOUR = 60 * 60 * 1000;

/** What a visitor gets for each status shown on /links. */
const VISITOR_SEES: Record<ShareLinkStatus, "ok" | "expired" | "invalid"> = {
  active: "ok",
  expired: "expired",
  folder_trashed: "invalid",
  creator_banned: "invalid",
  creator_no_access: "invalid",
};

/** A folder with an editor who shares it; `setup` then breaks the link in one way. */
async function scenario(setup: (ctx: { link: ShareLink; folderId: string; creatorId: string }) => Promise<void>) {
  const owner = await makeUser();
  const folder = await makeFolder(owner);
  const creator = await makeUser();
  await grant(creator, folder, "editor");
  const link = await makeShareLink(folder, creator);
  await setup({ link, folderId: folder.id, creatorId: creator.id });
  return link;
}

async function setExpired(linkId: string) {
  await db.update(shareLinks).set({ expiresAt: new Date(Date.now() - HOUR) }).where(eq(shareLinks.id, linkId));
}

async function revokeAccess(userId: string) {
  await db.delete(folderPermissions).where(eq(folderPermissions.userId, userId));
}

const cases: [string, Parameters<typeof scenario>[0]][] = [
  ["active", async () => {}],
  ["expired", async ({ link }) => setExpired(link.id)],
  ["folder in trash", async ({ folderId }) => {
    await db.update(folders).set({ deletedAt: new Date() }).where(eq(folders.id, folderId));
  }],
  ["creator banned", async ({ creatorId }) => {
    await db.update(user).set({ banned: true }).where(eq(user.id, creatorId));
  }],
  ["creator lost access", async ({ creatorId }) => revokeAccess(creatorId)],
  ["expired and creator lost access", async ({ link, creatorId }) => {
    await setExpired(link.id);
    await revokeAccess(creatorId);
  }],
];

describe("share link status", () => {
  it.each(cases)("/links matches what visitors get: %s", async (_, setup) => {
    const link = await scenario(setup);
    const admin = await makeUser({ role: "admin" });
    const [row] = (await listAllShareLinks(sessionFor(admin))).filter((r) => r.id === link.id);
    const resolved = await resolveShareLink(link.token);
    expect(VISITOR_SEES[row.status]).toBe(resolved.status);
  });

  it("lists only links in folders the user can edit", async () => {
    const owner = await makeUser();
    const shared = await makeFolder(owner);
    const other = await makeFolder(owner);
    await makeShareLink(shared, owner);
    await makeShareLink(other, owner);
    const editor = await makeUser();
    await grant(editor, shared, "editor");
    const viewer = await makeUser();
    await grant(viewer, other, "viewer");

    expect((await listAllShareLinks(sessionFor(editor))).map((r) => r.folder.id)).toEqual([shared.id]);
    expect(await listAllShareLinks(sessionFor(viewer))).toEqual([]);
  });
});
