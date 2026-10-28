import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { files } from "@/db/schema";
import { resetDb } from "../../test/setup/db";
import { grant, makeFile, makeFolder, makeUser, sessionFor } from "../../test/setup/factories";
import { checkDuplicates } from "./duplicates";

beforeEach(resetDb);

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

async function setup() {
  const owner = await makeUser();
  const member = await makeUser();
  const shared = await makeFolder(owner, { name: "Shared" });
  const secret = await makeFolder(owner, { name: "Secret" });
  await grant(owner, shared, "owner");
  await grant(owner, secret, "owner");
  await grant(member, shared, "viewer");
  return { owner, member, shared, secret };
}

async function withHash(file: { id: string }, sha256: string) {
  await db.update(files).set({ sha256 }).where(eq(files.id, file.id));
}

describe("checkDuplicates", () => {
  it("never reports files in folders the user can't read", async () => {
    const { owner, member, secret } = await setup();
    const hidden = await makeFile(secret, owner, { name: "a.jpg", size: 500 });
    await withHash(hidden, HASH_A);

    const first = await checkDuplicates(sessionFor(member), [{ key: "1", size: 500, name: "a.jpg" }]);
    expect(first["1"]).toEqual({ needsHash: false, matches: [] });
    const second = await checkDuplicates(sessionFor(member), [
      { key: "1", size: 500, name: "a.jpg", sha256: HASH_A },
    ]);
    expect(second["1"].matches).toEqual([]);

    // The owner sees it.
    const mine = await checkDuplicates(sessionFor(owner), [{ key: "1", size: 500, name: "a.jpg", sha256: HASH_A }]);
    expect(mine["1"].matches.map((m) => m.fileId)).toEqual([hidden.id]);
  });

  it("asks for a hash only when a readable file has the same size", async () => {
    const { owner, member, shared } = await setup();
    await makeFile(shared, owner, { name: "x.jpg", size: 500 });
    const res = await checkDuplicates(sessionFor(member), [
      { key: "same", size: 500, name: "other.jpg" },
      { key: "new", size: 501, name: "x.jpg" },
    ]);
    expect(res.same).toEqual({ needsHash: true, matches: [] });
    expect(res.new).toEqual({ needsHash: false, matches: [] });
  });

  it("puts hash matches before size + name matches, and ignores trash", async () => {
    const { owner, member, shared } = await setup();
    const legacy = await makeFile(shared, owner, { name: "IMG_1.jpg", size: 500 });
    const copy = await makeFile(shared, owner, { name: "renamed.jpg", size: 500 });
    await withHash(copy, HASH_A);
    const different = await makeFile(shared, owner, { name: "img_1.JPG", size: 500 });
    await withHash(different, HASH_B);
    await makeFile(shared, owner, { name: "IMG_1.jpg", size: 500, deletedAt: new Date() });

    const res = await checkDuplicates(sessionFor(member), [
      { key: "1", size: 500, name: "IMG_1.jpg", sha256: HASH_A },
    ]);
    expect(res["1"].matches.map((m) => [m.fileId, m.exact])).toEqual([
      [copy.id, true],
      // Same name, but no hash to compare: maybe. A different hash isn't.
      [legacy.id, false],
    ]);
    expect(res["1"].matches[0].folder).toEqual({ id: shared.id, name: "Shared" });

    // Too big to hash: size + name, whatever the stored hash.
    const unhashed = await checkDuplicates(sessionFor(member), [{ key: "1", size: 500, name: "img_1.jpg" }]);
    expect(unhashed["1"].matches.map((m) => m.fileId).sort()).toEqual([legacy.id, different.id].sort());
  });
});
