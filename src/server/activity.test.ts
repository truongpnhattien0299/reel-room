import { beforeEach, describe, expect, it } from "vitest";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { activity } from "@/db/schema";
import { signIn } from "../../test/setup/auth";
import { resetDb } from "../../test/setup/db";
import { grant, makeFile, makeFolder, makeUser, sessionFor } from "../../test/setup/factories";
import {
  createFolder,
  createShareLink,
  deleteShareLinks,
  moveFiles,
  moveFolder,
  renameFile,
  renameFolder,
  restoreFiles,
  restoreFolder,
  revokeShare,
  shareFolder,
  trashFiles,
  trashFolder,
  updateShareLink,
} from "./actions";
import { listActivity, logActivity } from "./activity";
import { ForbiddenError } from "./permissions";

beforeEach(resetDb);

const logged = () =>
  db
    .select({ action: activity.action, folderPath: activity.folderPath, meta: activity.meta })
    .from(activity)
    .orderBy(asc(activity.createdAt), asc(activity.id));

/** Root `a` (with `sub`) and root `b`; `owner` owns both, `editor` edits both. */
async function setup() {
  const owner = await makeUser({ name: "Owner" });
  const editor = await makeUser({ name: "Editor" });
  const a = await makeFolder(owner, { name: "A" });
  const sub = await makeFolder(owner, { parent: a, name: "Sub" });
  const b = await makeFolder(owner, { name: "B" });
  for (const f of [a, b]) {
    await grant(owner, f, "owner");
    await grant(editor, f, "editor");
  }
  return { owner, editor, a, sub, b };
}

describe("logging", () => {
  it("records each change once, at the folder it happened in", async () => {
    const { owner, editor, a, sub, b } = await setup();
    const x = await makeFile(sub, editor, { name: "x.jpg" });
    const y = await makeFile(b, editor, { name: "y.jpg" });
    signIn(sessionFor(editor));

    await renameFolder(sub.id, "Sub 2");
    await renameFile(x.id, "x2.jpg");
    // Files of two folders: one row each.
    await trashFiles([x.id, y.id]);
    await restoreFiles([x.id, y.id]);
    await moveFiles([x.id], b.id);
    await moveFolder(sub.id, b.id);
    const link = await createShareLink({ folderId: a.id, expiresAt: null });
    expect(link.error).toBeUndefined();

    const rows = await logged();
    expect(rows.map((r) => r.action)).toEqual([
      "folder.rename",
      "file.rename",
      "file.trash",
      "file.trash",
      "file.restore",
      "file.restore",
      "file.move",
      "folder.move",
      "link.create",
    ]);
    // Rows of one batch share a timestamp, so compare places regardless of order.
    const pairs = (xs: { action: string; folderPath: string | null }[]) =>
      xs.map((r) => `${r.action} ${r.folderPath}`).sort();
    expect(pairs(rows)).toEqual(pairs([
      ["folder.rename", sub.path],
      ["file.rename", sub.path],
      ["file.trash", sub.path],
      ["file.trash", b.path],
      ["file.restore", sub.path],
      ["file.restore", b.path],
      // Moves are logged where things were.
      ["file.move", sub.path],
      ["folder.move", sub.path],
      ["link.create", a.path],
    ].map(([action, folderPath]) => ({ action, folderPath }))));
    expect(rows.find((r) => r.action === "folder.rename")!.meta).toEqual({ from: "Sub", to: "Sub 2" });
    expect(rows.find((r) => r.action === "file.move")!.meta).toMatchObject({ names: ["x2.jpg"], count: 1, from: "Sub 2", to: "B" });
    expect(rows.find((r) => r.action === "folder.move")!.meta).toMatchObject({ name: "Sub 2", from: "A", to: "B" });

    signIn(sessionFor(owner));
    await shareFolder(a.id, { email: (await makeUser({ name: "Guest" })).email, role: "viewer" });
    await trashFolder(a.id);
    await restoreFolder(a.id);
    await createFolder(a.id, "New");

    const more = (await logged()).slice(rows.length);
    expect(more.map((r) => r.action)).toEqual(["share.grant", "folder.trash", "folder.restore", "folder.create"]);
    expect(more[0].meta).toMatchObject({ name: "Guest", role: "viewer", folderName: "A" });
    expect(more[3].folderPath).toMatch(new RegExp(`^${a.path}/`));
  });

  it("logs link changes and member removal", async () => {
    const { owner, editor, a } = await setup();
    signIn(sessionFor(owner));
    await createShareLink({ folderId: a.id, expiresAt: null });
    const [link] = await db.query.shareLinks.findMany();
    await updateShareLink(link.id, { expiresAt: new Date(Date.now() + 86_400_000) });
    await deleteShareLinks([link.id]);
    await revokeShare(a.id, editor.id);
    // Removing someone who isn't a member changes nothing and logs nothing.
    await revokeShare(a.id, editor.id);

    expect((await logged()).map((r) => r.action)).toEqual([
      "link.create",
      "link.update",
      "link.revoke",
      "share.revoke",
    ]);
  });

  it("logs nothing when the change is refused", async () => {
    const { a } = await setup();
    const viewer = await makeUser();
    await grant(viewer, a, "viewer");
    const f = await makeFile(a, viewer);
    signIn(sessionFor(viewer));

    expect((await trashFiles([f.id])).error).toBeDefined();
    expect((await renameFolder(a.id, "Nope")).error).toBeDefined();
    expect(await logged()).toEqual([]);
  });
});

describe("listActivity", () => {
  it("shows owners their folder's subtree only, and the whole log to admins", async () => {
    const { owner, editor, a, sub, b } = await setup();
    const admin = await makeUser({ role: "admin" });
    await db.batch([
      logActivity(sessionFor(editor), "file.upload", { folder: sub, meta: { names: ["in-sub.jpg"] } }),
      logActivity(sessionFor(editor), "file.upload", { folder: b, meta: { names: ["in-b.jpg"] } }),
      logActivity(sessionFor(admin), "user.role", { targetUserId: editor.id }),
    ]);

    const names = (res: Awaited<ReturnType<typeof listActivity>>) => res.rows.map((r) => r.meta.names?.[0] ?? r.action);
    expect(names(await listActivity(sessionFor(owner), { folderId: a.id }))).toEqual(["in-sub.jpg"]);
    expect(names(await listActivity(sessionFor(admin), {}))).toHaveLength(3);
    // Editors don't see who did what; only admins see the whole log.
    await expect(listActivity(sessionFor(editor), { folderId: a.id })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(listActivity(sessionFor(owner), {})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("pages with a cursor, newest first, without gaps or repeats", async () => {
    const admin = await makeUser({ role: "admin" });
    const session = sessionFor(admin);
    for (let i = 0; i < 55; i++) await logActivity(session, "user.invite", { meta: { email: `u${i}@x` } });

    const first = await listActivity(session, {});
    expect(first.rows).toHaveLength(50);
    expect(first.nextCursor).not.toBeNull();
    const second = await listActivity(session, { cursor: first.nextCursor! });
    expect(second.rows).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    const emails = [...first.rows, ...second.rows].map((r) => r.meta.email);
    expect(new Set(emails).size).toBe(55);
  });

  it("filters by actor, kind of action and day", async () => {
    const { owner, editor, a } = await setup();
    const admin = sessionFor(await makeUser({ role: "admin" }));
    await db.batch([
      logActivity(sessionFor(owner), "folder.rename", { folder: a }),
      logActivity(sessionFor(editor), "file.upload", { folder: a }),
      logActivity(null, "file.purge", { folder: a }),
    ]);
    const actions = async (f: Parameters<typeof listActivity>[1]) =>
      (await listActivity(admin, f)).rows.map((r) => r.action);

    expect(await actions({ actor: editor.id })).toEqual(["file.upload"]);
    expect(await actions({ actor: "system" })).toEqual(["file.purge"]);
    expect((await actions({ group: "file" })).sort()).toEqual(["file.purge", "file.upload"]);
    expect(await actions({ to: "2000-01-01" })).toEqual([]);
  });
});
