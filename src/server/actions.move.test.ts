import { beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { files, folders, shareLinkFiles } from "@/db/schema";
import { signIn } from "../../test/setup/auth";
import { resetDb } from "../../test/setup/db";
import { grant, makeFile, makeFolder, makeShareLink, makeUser, sessionFor } from "../../test/setup/factories";
import { getMoveTargets, moveFiles, moveFolder, trashFolder } from "./actions";
import { NotFoundError, requireFolderRole } from "./permissions";

beforeEach(resetDb);

/**
 * Two top-level folders. `a` holds a › b › c (c trashed later in one test);
 * `dest` lives under the other root. The editor edits both roots.
 */
async function setup() {
  const owner = await makeUser();
  const rootA = await makeFolder(owner);
  const a = await makeFolder(owner, { parent: rootA });
  const b = await makeFolder(owner, { parent: a });
  const c = await makeFolder(owner, { parent: b });
  const rootB = await makeFolder(owner);
  const dest = await makeFolder(owner, { parent: rootB });
  const editor = await makeUser();
  await grant(editor, rootA, "editor");
  await grant(editor, rootB, "editor");
  signIn(sessionFor(editor));
  return { owner, rootA, a, b, c, rootB, dest, editor };
}

const folderById = async (id: string) => (await db.select().from(folders).where(eq(folders.id, id)))[0];

describe("moveFolder", () => {
  it("rewrites the path of the whole subtree, trashed folders included", async () => {
    const { a, b, c, dest, rootA } = await setup();
    await trashFolder(c.id);
    expect(await moveFolder(a.id, dest.id)).toEqual({});

    const [movedA, movedB, movedC] = await Promise.all([folderById(a.id), folderById(b.id), folderById(c.id)]);
    expect(movedA.path).toBe(`${dest.path}/${a.id}`);
    expect(movedB.path).toBe(`${dest.path}/${a.id}/${b.id}`);
    expect(movedC.path).toBe(`${dest.path}/${a.id}/${b.id}/${c.id}`);
    expect(movedA.parentId).toBe(dest.id);
    expect(movedB.parentId).toBe(a.id);
    expect(movedC.parentId).toBe(b.id);
    expect((await folderById(rootA.id)).path).toBe(rootA.id);
  });

  it("refuses to move a folder into itself or below itself", async () => {
    const { a, c } = await setup();
    expect((await moveFolder(a.id, a.id)).error).toMatch(/chính nó/);
    expect((await moveFolder(a.id, c.id)).error).toMatch(/chính nó/);
    expect((await folderById(a.id)).parentId).not.toBe(c.id);
  });

  it("refuses to move a top-level folder", async () => {
    const { rootA, dest } = await setup();
    expect((await moveFolder(rootA.id, dest.id)).error).toMatch(/folder gốc/);
  });

  it("needs editor on the folder and on the destination", async () => {
    const { a, dest, rootB } = await setup();
    const viewerAtDest = await makeUser();
    await grant(viewerAtDest, a, "editor");
    await grant(viewerAtDest, rootB, "viewer");
    signIn(sessionFor(viewerAtDest));
    expect((await moveFolder(a.id, dest.id)).error).toBe("Bạn không có quyền thực hiện thao tác này");

    const noAccessAtDest = await makeUser();
    await grant(noAccessAtDest, a, "editor");
    signIn(sessionFor(noAccessAtDest));
    expect((await moveFolder(a.id, dest.id)).error).toBe("Folder không tồn tại");

    const viewerAtSource = await makeUser();
    await grant(viewerAtSource, a, "viewer");
    await grant(viewerAtSource, dest, "editor");
    signIn(sessionFor(viewerAtSource));
    expect((await moveFolder(a.id, dest.id)).error).toBe("Bạn không có quyền thực hiện thao tác này");

    expect((await folderById(a.id)).parentId).not.toBe(dest.id);
  });

  it("reports a name clash with a folder already at the destination", async () => {
    const { owner, a, dest } = await setup();
    await makeFolder(owner, { parent: dest, name: a.name.toUpperCase() });
    expect((await moveFolder(a.id, dest.id)).error).toBe("Đã có folder cùng tên ở đây");
  });

  it("takes inherited access along: old-only grants lose it, the destination's gain it", async () => {
    const { rootA, a, b, dest } = await setup();
    const oldViewer = await makeUser();
    await grant(oldViewer, rootA, "viewer");
    const newViewer = await makeUser();
    await grant(newViewer, dest, "viewer");
    const direct = await makeUser();
    await grant(direct, a, "viewer");

    expect(await moveFolder(a.id, dest.id)).toEqual({});
    await expect(requireFolderRole(sessionFor(oldViewer), b.id, "viewer")).rejects.toBeInstanceOf(NotFoundError);
    await expect(requireFolderRole(sessionFor(newViewer), b.id, "viewer")).resolves.toBeTruthy();
    await expect(requireFolderRole(sessionFor(direct), b.id, "viewer")).resolves.toBeTruthy();
  });
});

describe("moveFiles", () => {
  it("moves files and drops them from the old folder's file links", async () => {
    const { owner, a, b, dest } = await setup();
    const f1 = await makeFile(a, owner);
    const f2 = await makeFile(a, owner);
    const keep = await makeFile(a, owner);
    const linkA = await makeShareLink(a, owner, { fileIds: [f1.id, keep.id] });
    // A link elsewhere (ill-formed, but it must not be touched).
    const linkB = await makeShareLink(b, owner, { fileIds: [f2.id] });

    const preview = await getMoveTargets([f1.id, f2.id]);
    expect(preview.data?.linkedFiles).toBe(1);

    expect(await moveFiles([f1.id, f2.id], dest.id)).toEqual({});
    const moved = await db.select().from(files).where(inArray(files.id, [f1.id, f2.id, keep.id]));
    expect(Object.fromEntries(moved.map((f) => [f.id, f.folderId]))).toEqual({
      [f1.id]: dest.id,
      [f2.id]: dest.id,
      [keep.id]: a.id,
    });
    const links = await db.select().from(shareLinkFiles);
    expect(links.map((l) => [l.linkId, l.fileId]).sort()).toEqual(
      [
        [linkA.id, keep.id],
        [linkB.id, f2.id],
      ].sort(),
    );
  });

  it("refuses files from different folders", async () => {
    const { owner, a, b, dest } = await setup();
    const f1 = await makeFile(a, owner);
    const f2 = await makeFile(b, owner);
    expect((await moveFiles([f1.id, f2.id], dest.id)).error).toMatch(/cùng một folder/);
  });

  it("needs editor on the source and the destination", async () => {
    const { owner, a, dest, rootB } = await setup();
    const f = await makeFile(a, owner);
    const u = await makeUser();
    await grant(u, a, "editor");
    await grant(u, rootB, "viewer");
    signIn(sessionFor(u));
    expect((await moveFiles([f.id], dest.id)).error).toBe("Bạn không có quyền thực hiện thao tác này");

    const v = await makeUser();
    await grant(v, a, "viewer");
    await grant(v, dest, "editor");
    signIn(sessionFor(v));
    expect((await moveFiles([f.id], dest.id)).error).toBe("Bạn không có quyền thực hiện thao tác này");

    expect((await db.select().from(files).where(eq(files.id, f.id)))[0].folderId).toBe(a.id);
  });

  it("refuses trashed files and a trashed destination", async () => {
    const { owner, a, b, c } = await setup();
    const f = await makeFile(a, owner);
    await trashFolder(c.id);
    expect((await moveFiles([f.id], c.id)).error).toBe("Folder không tồn tại");
    await trashFolder(a.id);
    expect((await moveFiles([f.id], b.id)).error).toBe("File không tồn tại");
  });
});

describe("getMoveTargets", () => {
  it("lists only live folders the user can edit", async () => {
    const { owner, rootA, a, b, c } = await setup();
    const u = await makeUser();
    await grant(u, a, "editor");
    await grant(u, rootA, "viewer");
    await trashFolder(c.id);
    const other = await makeFolder(owner);
    signIn(sessionFor(u));
    const res = await getMoveTargets();
    expect(res.data?.folders.map((f) => f.id).sort()).toEqual([a.id, b.id].sort());
    expect(res.data?.folders.some((f) => f.id === other.id)).toBe(false);
  });
});
