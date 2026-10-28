import { beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { files, folders } from "@/db/schema";
import { signIn } from "../../test/setup/auth";
import { resetDb } from "../../test/setup/db";
import { grant, makeFile, makeFolder, makeUser, sessionFor } from "../../test/setup/factories";
import { restoreFolder, trashFile, trashFolder } from "./actions";

beforeEach(resetDb);

/** root › child › grandchild, one file in each lower level; the user edits root. */
async function setup() {
  const owner = await makeUser();
  const root = await makeFolder(owner);
  const child = await makeFolder(owner, { parent: root });
  const grandchild = await makeFolder(owner, { parent: child });
  const inChild = await makeFile(child, owner);
  const inGrandchild = await makeFile(grandchild, owner);
  const editor = await makeUser();
  await grant(editor, root, "editor");
  signIn(sessionFor(editor));
  return { owner, root, child, grandchild, inChild, inGrandchild, editor };
}

const deletedFolders = async (ids: string[]) =>
  (await db.select().from(folders).where(inArray(folders.id, ids))).filter((f) => f.deletedAt).map((f) => f.id);
const deletedFiles = async (ids: string[]) =>
  (await db.select().from(files).where(inArray(files.id, ids))).filter((f) => f.deletedAt).map((f) => f.id);

describe("trash", () => {
  it("trashes a folder's whole subtree and restores it", async () => {
    const { child, grandchild, inChild, inGrandchild } = await setup();
    expect(await trashFolder(child.id)).toEqual({});
    expect(await deletedFolders([child.id, grandchild.id])).toHaveLength(2);
    expect(await deletedFiles([inChild.id, inGrandchild.id])).toHaveLength(2);

    expect(await restoreFolder(child.id)).toEqual({});
    expect(await deletedFolders([child.id, grandchild.id])).toEqual([]);
    expect(await deletedFiles([inChild.id, inGrandchild.id])).toEqual([]);
  });

  it("leaves items trashed on their own before the folder in the trash", async () => {
    const { child, inChild, inGrandchild } = await setup();
    // Distinct timestamps: the earlier, separate deletion must not match the folder's.
    expect(await trashFile(inChild.id)).toEqual({});
    await new Promise((r) => setTimeout(r, 5));
    await trashFolder(child.id);

    await restoreFolder(child.id);
    expect(await deletedFiles([inChild.id, inGrandchild.id])).toEqual([inChild.id]);
  });

  it("won't restore a folder whose parent is still in the trash", async () => {
    const { owner, root, child } = await setup();
    await trashFolder(child.id);
    signIn(sessionFor(owner));
    await grant(owner, root, "owner");
    await trashFolder(root.id);

    const res = await restoreFolder(child.id);
    expect(res.error).toMatch(/Folder cha/);
    expect(await deletedFolders([child.id])).toEqual([child.id]);
  });

  it("needs an owner to trash a top-level folder", async () => {
    const { root } = await setup();
    expect((await trashFolder(root.id)).error).toBeTruthy();
    const [row] = await db.select().from(folders).where(eq(folders.id, root.id));
    expect(row.deletedAt).toBeNull();
  });

  it("refuses viewers", async () => {
    const { child, root } = await setup();
    const viewer = await makeUser();
    await grant(viewer, root, "viewer");
    signIn(sessionFor(viewer));
    expect((await trashFolder(child.id)).error).toBeTruthy();
    expect(await deletedFolders([child.id])).toEqual([]);
  });
});
