import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { folders } from "@/db/schema";
import { resetDb } from "../../test/setup/db";
import { grant, makeFolder, makeUser, sessionFor } from "../../test/setup/factories";
import { ForbiddenError, getUserRole, NotFoundError, requireFolderRole, roleAtLeast } from "./permissions";

beforeEach(resetDb);

/** root → child → grandchild, created by `owner`. */
async function tree() {
  const owner = await makeUser();
  const root = await makeFolder(owner);
  const child = await makeFolder(owner, { parent: root });
  const grandchild = await makeFolder(owner, { parent: child });
  return { owner, root, child, grandchild };
}

describe("roleAtLeast", () => {
  it("ranks viewer < editor < owner", () => {
    expect(roleAtLeast("owner", "editor")).toBe(true);
    expect(roleAtLeast("editor", "editor")).toBe(true);
    expect(roleAtLeast("viewer", "editor")).toBe(false);
    expect(roleAtLeast(null, "viewer")).toBe(false);
  });
});

describe("getUserRole", () => {
  it("inherits a grant from any ancestor", async () => {
    const { root, grandchild } = await tree();
    const u = await makeUser();
    await grant(u, root, "viewer");
    expect(await getUserRole(u, grandchild)).toBe("viewer");
  });

  it("takes the highest of several grants", async () => {
    const { root, child, grandchild } = await tree();
    const u = await makeUser();
    await grant(u, root, "viewer");
    await grant(u, child, "editor");
    expect(await getUserRole(u, grandchild)).toBe("editor");
    expect(await getUserRole(u, root)).toBe("viewer");
  });

  it("does not flow upwards or sideways", async () => {
    const { owner, root, child } = await tree();
    const sibling = await makeFolder(owner, { parent: root });
    const u = await makeUser();
    await grant(u, child, "owner");
    expect(await getUserRole(u, root)).toBeNull();
    expect(await getUserRole(u, sibling)).toBeNull();
  });

  it("treats admins as owners everywhere", async () => {
    const { grandchild } = await tree();
    const admin = await makeUser({ role: "admin" });
    expect(await getUserRole(admin, grandchild)).toBe("owner");
  });
});

describe("requireFolderRole", () => {
  it("returns the folder and role when allowed", async () => {
    const { child } = await tree();
    const u = await makeUser();
    await grant(u, child, "editor");
    const res = await requireFolderRole(sessionFor(u), child.id, "viewer");
    expect(res.folder.id).toBe(child.id);
    expect(res.role).toBe("editor");
  });

  it("hides folders the user has no access to", async () => {
    const { child } = await tree();
    const u = await makeUser();
    await expect(requireFolderRole(sessionFor(u), child.id, "viewer")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("forbids a role below the minimum", async () => {
    const { child } = await tree();
    const u = await makeUser();
    await grant(u, child, "viewer");
    await expect(requireFolderRole(sessionFor(u), child.id, "editor")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("treats trashed folders as missing, even for admins", async () => {
    const { child } = await tree();
    await db.update(folders).set({ deletedAt: new Date() }).where(eq(folders.id, child.id));
    const admin = await makeUser({ role: "admin" });
    await expect(requireFolderRole(sessionFor(admin), child.id, "viewer")).rejects.toBeInstanceOf(NotFoundError);
  });
});
