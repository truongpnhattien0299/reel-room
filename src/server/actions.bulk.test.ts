import { beforeEach, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { signIn } from "../../test/setup/auth";
import { resetDb } from "../../test/setup/db";
import { grant, makeFile, makeFolder, makeUser, sessionFor } from "../../test/setup/factories";
import { restoreFiles, trashFiles, trashFolder } from "./actions";

beforeEach(resetDb);

/** Two folders with two files each; the user edits `a` and only views `b`. */
async function setup() {
  const owner = await makeUser();
  const a = await makeFolder(owner);
  const b = await makeFolder(owner);
  const [a1, a2, b1, b2] = await Promise.all([
    makeFile(a, owner),
    makeFile(a, owner),
    makeFile(b, owner),
    makeFile(b, owner),
  ]);
  const user = await makeUser();
  await grant(user, a, "editor");
  await grant(user, b, "viewer");
  signIn(sessionFor(user));
  return { owner, a, b, a1, a2, b1, b2, user };
}

const trashed = async (ids: string[]) =>
  (await db.select().from(files).where(inArray(files.id, ids)))
    .filter((f) => f.deletedAt)
    .map((f) => f.id)
    .sort();

describe("trashFiles / restoreFiles", () => {
  it("trashes files across folders and the undo brings them all back", async () => {
    const { a1, a2, b1, b2 } = await setup();
    signIn(sessionFor(await makeUser({ role: "admin" })));
    const ids = [a1.id, a2.id, b1.id, b2.id];
    expect(await trashFiles(ids)).toEqual({});
    expect(await trashed(ids)).toEqual([...ids].sort());
    expect(await restoreFiles(ids)).toEqual({});
    expect(await trashed(ids)).toEqual([]);
  });

  it("trashes nothing when the user can't edit one of the folders", async () => {
    const { a1, a2, b1 } = await setup();
    const res = await trashFiles([a1.id, a2.id, b1.id]);
    expect(res.error).toBe("Bạn không có quyền thực hiện thao tác này");
    expect(await trashed([a1.id, a2.id, b1.id])).toEqual([]);
  });

  it("restores nothing when the user can't edit one of the folders", async () => {
    const { a1, b1, user } = await setup();
    signIn(sessionFor(await makeUser({ role: "admin" })));
    await trashFiles([a1.id, b1.id]);
    signIn(sessionFor(user));
    expect((await restoreFiles([a1.id, b1.id])).error).toBe("Bạn không có quyền thực hiện thao tác này");
    expect(await trashed([a1.id, b1.id])).toEqual([a1.id, b1.id].sort());
  });

  it("refuses files that are already trashed or missing", async () => {
    const { a1, a2 } = await setup();
    await trashFiles([a1.id]);
    expect((await trashFiles([a1.id, a2.id])).error).toBe("File không tồn tại");
    expect(await trashed([a2.id])).toEqual([]);
    expect((await restoreFiles([a1.id, a2.id])).error).toBe("Không còn trong thùng rác");
    expect(await trashed([a1.id])).toEqual([a1.id]);
  });

  it("won't restore into a trashed folder", async () => {
    const { a, a1, user } = await setup();
    await trashFiles([a1.id]);
    // Top-level folders need an owner to trash them.
    signIn(sessionFor(await makeUser({ role: "admin" })));
    expect(await trashFolder(a.id)).toEqual({});
    signIn(sessionFor(user));
    expect((await restoreFiles([a1.id])).error).toMatch(/đang trong thùng rác/);
  });
});
