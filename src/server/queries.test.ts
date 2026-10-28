import { beforeEach, expect, it } from "vitest";
import { db } from "@/db";
import { folders, type FolderRole } from "@/db/schema";
import { resetDb } from "../../test/setup/db";
import { grant, makeFolder, makeUser } from "../../test/setup/factories";
import { getUserRole, roleAtLeast } from "./permissions";
import { hasGrant } from "./queries";

beforeEach(resetDb);

it("hasGrant (SQL) agrees with getUserRole for every user, folder and minimum role", async () => {
  const owner = await makeUser();
  const a = await makeFolder(owner);
  const a1 = await makeFolder(owner, { parent: a });
  const a1x = await makeFolder(owner, { parent: a1 });
  const a2 = await makeFolder(owner, { parent: a });
  const b = await makeFolder(owner);
  const tree = [a, a1, a1x, a2, b];

  const viewerOfA = await makeUser();
  await grant(viewerOfA, a, "viewer");
  const mixed = await makeUser();
  await grant(mixed, a, "viewer");
  await grant(mixed, a1, "owner");
  await grant(mixed, b, "editor");
  const editorOfA2 = await makeUser();
  await grant(editorOfA2, a2, "editor");
  const outsider = await makeUser();
  const users = [viewerOfA, mixed, editorOfA2, outsider];

  const mins: FolderRole[] = ["viewer", "editor", "owner"];
  for (const u of users) {
    for (const min of mins) {
      const rows = await db.select({ id: folders.id }).from(folders).where(hasGrant(u.id, folders.path, min));
      const viaSql = new Set(rows.map((r) => r.id));
      for (const f of tree) {
        const expected = roleAtLeast(await getUserRole(u, f), min);
        expect(viaSql.has(f.id), `${u.id} ${min} on ${f.name}`).toBe(expected);
      }
    }
  }
});
