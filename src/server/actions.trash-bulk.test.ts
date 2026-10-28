import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { activity, files, folders } from "@/db/schema";
import { signIn } from "../../test/setup/auth";
import { resetDb } from "../../test/setup/db";
import { grant, makeFile, makeFolder, makeUser, sessionFor } from "../../test/setup/factories";
import { emptyTrash, purgeTrashItems, restoreTrashItems, trashFile, trashFolder } from "./actions";
import { listTrash } from "./queries";

vi.mock("@/lib/r2", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/r2")>()),
  deleteObject: vi.fn(),
}));

beforeEach(resetDb);

const tick = () => new Promise((r) => setTimeout(r, 5));
const folderIds = async (ids: string[]) =>
  (await db.select({ id: folders.id }).from(folders).where(inArray(folders.id, ids))).map((f) => f.id);
const fileRows = async (ids: string[]) => db.select().from(files).where(inArray(files.id, ids));
const loggedActions = async () => (await db.select({ action: activity.action }).from(activity)).map((a) => a.action);

/** root › child › grandchild with a file in each lower level; the user edits root. */
async function setup() {
  const owner = await makeUser();
  const root = await makeFolder(owner);
  await grant(owner, root, "owner");
  const child = await makeFolder(owner, { parent: root });
  const grandchild = await makeFolder(owner, { parent: child });
  const inChild = await makeFile(child, owner);
  const inGrandchild = await makeFile(grandchild, owner);
  const editor = await makeUser();
  await grant(editor, root, "editor");
  signIn(sessionFor(editor));
  return { owner, root, child, grandchild, inChild, inGrandchild, editor };
}

describe("bulk trash actions", () => {
  it("purges nothing when one item is out of reach", async () => {
    const { owner, inChild } = await setup();
    const other = await makeFolder(owner);
    const elsewhere = await makeFile(other, owner, { deletedAt: new Date() });
    await trashFile(inChild.id);

    const res = await purgeTrashItems([
      { kind: "file", id: inChild.id },
      { kind: "file", id: elsewhere.id },
    ]);
    expect(res.error).toBeTruthy();
    expect(await fileRows([inChild.id, elsewhere.id])).toHaveLength(2);
  });

  it("leaves a top-level folder to its owner", async () => {
    const { owner, root } = await setup();
    signIn(sessionFor(owner));
    await trashFolder(root.id);

    const editor = await makeUser();
    await grant(editor, root, "editor");
    signIn(sessionFor(editor));
    const [item] = await listTrash(sessionFor(editor));
    expect(item).toMatchObject({ id: root.id, canManage: false });
    expect((await purgeTrashItems([{ kind: "folder", id: root.id }])).error).toBeTruthy();
    expect((await restoreTrashItems([{ kind: "folder", id: root.id }])).error).toBeTruthy();
    expect(await folderIds([root.id])).toEqual([root.id]);

    signIn(sessionFor(owner));
    expect((await listTrash(sessionFor(owner)))[0].canManage).toBe(true);
  });

  /** A file and a folder trashed on their own, then their ancestor: all three are listed. */
  async function trashNested() {
    const ctx = await setup();
    await trashFile(ctx.inGrandchild.id);
    await tick();
    await trashFolder(ctx.grandchild.id);
    await tick();
    await trashFolder(ctx.child.id);
    const listed = await listTrash(sessionFor(ctx.editor));
    expect(listed.map((i) => i.id).sort()).toEqual([ctx.child.id, ctx.grandchild.id, ctx.inGrandchild.id].sort());
    return { ...ctx, refs: listed.map((i) => ({ kind: i.kind, id: i.id })) };
  }

  it("purges a folder picked together with items trashed inside it", async () => {
    const { child, grandchild, inChild, inGrandchild, refs } = await trashNested();
    expect(await purgeTrashItems(refs)).toEqual({});
    expect(await folderIds([child.id, grandchild.id])).toEqual([]);
    expect(await fileRows([inChild.id, inGrandchild.id])).toEqual([]);
    expect((await loggedActions()).filter((a) => a.endsWith(".purge"))).toEqual(["folder.purge"]);
  });

  it("restores a folder picked together with items trashed inside it", async () => {
    const { child, grandchild, inChild, inGrandchild, editor, refs } = await trashNested();
    expect(await restoreTrashItems(refs)).toEqual({});
    const live = await db.select().from(folders).where(inArray(folders.id, [child.id, grandchild.id]));
    expect(live.every((f) => f.deletedAt === null)).toBe(true);
    expect((await fileRows([inChild.id, inGrandchild.id])).every((f) => f.deletedAt === null)).toBe(true);
    expect(await listTrash(sessionFor(editor))).toEqual([]);
  });

  it("empties only what the user may manage and saw", async () => {
    const { owner, root, inChild, editor } = await setup();
    await trashFile(inChild.id);

    // Someone else's folder, and a top-level folder the user only edits.
    const stranger = await makeUser();
    const theirs = await makeFolder(stranger);
    const theirFile = await makeFile(theirs, stranger, { deletedAt: new Date() });
    const otherRoot = await makeFolder(owner);
    await grant(owner, otherRoot, "owner");
    await grant(editor, otherRoot, "editor");
    signIn(sessionFor(owner));
    await trashFolder(otherRoot.id);
    signIn(sessionFor(editor));

    const asOf = new Date();
    await tick();
    const later = await makeFile(root, owner);
    await trashFile(later.id);

    expect(await emptyTrash(asOf)).toEqual({ data: 1 });
    expect(await fileRows([inChild.id])).toEqual([]);
    expect(await fileRows([theirFile.id, later.id])).toHaveLength(2);
    expect(await folderIds([otherRoot.id])).toEqual([otherRoot.id]);
    const [kept] = await db.select().from(folders).where(eq(folders.id, otherRoot.id));
    expect(kept.deletedAt).not.toBeNull();
  });
});
