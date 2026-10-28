import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { favorites, folderPermissions } from "@/db/schema";
import { signIn } from "../../test/setup/auth";
import { resetDb } from "../../test/setup/db";
import { grant, makeFile, makeFolder, makeUser, sessionFor } from "../../test/setup/factories";
import { setFavorite, trashFiles } from "./actions";
import { listFavoriteIds, listFavorites } from "./favorites";

beforeEach(resetDb);

async function setup() {
  const owner = await makeUser();
  const member = await makeUser();
  const shared = await makeFolder(owner, { name: "Shared" });
  const sub = await makeFolder(owner, { parent: shared, name: "Sub" });
  const secret = await makeFolder(owner, { name: "Secret" });
  await grant(owner, shared, "owner");
  await grant(owner, secret, "owner");
  await grant(member, shared, "viewer");
  const file = await makeFile(sub, owner, { name: "a.jpg" });
  const hidden = await makeFile(secret, owner, { name: "secret.jpg" });
  return { owner, member, shared, sub, secret, file, hidden };
}

const names = (f: Awaited<ReturnType<typeof listFavorites>>) => ({
  folders: f.folders.map((x) => x.name),
  files: f.files.map((x) => x.name),
});

describe("favorites", () => {
  it("stars only what the user can read, and only for them", async () => {
    const { owner, member, sub, secret, file, hidden } = await setup();
    signIn(sessionFor(member));

    expect((await setFavorite({ fileId: file.id }, true)).error).toBeUndefined();
    expect((await setFavorite({ folderId: sub.id }, true)).error).toBeUndefined();
    // Starring twice is harmless.
    expect((await setFavorite({ folderId: sub.id }, true)).error).toBeUndefined();
    expect((await setFavorite({ fileId: hidden.id }, true)).error).toBeDefined();
    expect((await setFavorite({ folderId: secret.id }, true)).error).toBeDefined();

    expect(names(await listFavorites(sessionFor(member)))).toEqual({ folders: ["Sub"], files: ["a.jpg"] });
    expect(await listFavoriteIds(sessionFor(member))).toEqual({ files: [file.id], folders: [sub.id] });
    // Stars are personal.
    expect(names(await listFavorites(sessionFor(owner)))).toEqual({ folders: [], files: [] });
  });

  it("hides what the user lost access to or trashed, without deleting the star", async () => {
    const { owner, member, sub, file } = await setup();
    const other = await makeFile(sub, owner, { name: "b.jpg" });
    signIn(sessionFor(member));
    await setFavorite({ fileId: file.id }, true);
    await setFavorite({ fileId: other.id }, true);
    await setFavorite({ folderId: sub.id }, true);

    signIn(sessionFor(owner));
    await trashFiles([other.id]);
    expect(names(await listFavorites(sessionFor(member)))).toEqual({ folders: ["Sub"], files: ["a.jpg"] });

    await db.delete(folderPermissions).where(eq(folderPermissions.userId, member.id));
    expect(names(await listFavorites(sessionFor(member)))).toEqual({ folders: [], files: [] });
    expect(await db.select().from(favorites).where(eq(favorites.userId, member.id))).toHaveLength(3);

    // Unstarring still works without access.
    signIn(sessionFor(member));
    expect((await setFavorite({ fileId: file.id }, false)).error).toBeUndefined();
    expect(await db.select().from(favorites).where(eq(favorites.userId, member.id))).toHaveLength(2);
  });
});
