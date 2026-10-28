import { beforeEach, describe, expect, it } from "vitest";
import { signIn } from "../../test/setup/auth";
import { resetDb } from "../../test/setup/db";
import { grant, makeFile, makeFolder, makeShareLink, makeUser, sessionFor } from "../../test/setup/factories";
import { trashFolder } from "./actions";
import { dedupePaths, listFilesDownload, listFolderDownload, listSharedDownload, safeSegment } from "./downloads";
import { NotFoundError } from "./permissions";
import { resolveShareLink } from "./share-links";

beforeEach(resetDb);

/** Sự kiện › Ngày 1 › Sáng, plus a sibling "Khác"; a viewer on the root. */
async function setup() {
  const owner = await makeUser();
  const root = await makeFolder(owner, { name: "Sự kiện" });
  const day = await makeFolder(owner, { parent: root, name: "Ngày 1" });
  const morning = await makeFolder(owner, { parent: day, name: "Sáng" });
  const other = await makeFolder(owner, { parent: root, name: "Khác" });
  const viewer = await makeUser();
  await grant(viewer, root, "viewer");
  return { owner, root, day, morning, other, viewer };
}

const paths = (list: { entries: { path: string }[] }) => list.entries.map((e) => e.path);

describe("listFolderDownload", () => {
  it("lays files out by folder name below the downloaded folder", async () => {
    const { owner, root, day, morning, viewer } = await setup();
    await makeFile(root, owner, { name: "cover.jpg" });
    await makeFile(day, owner, { name: "a.jpg" });
    await makeFile(morning, owner, { name: "b.mp4" });

    const all = await listFolderDownload(sessionFor(viewer), root.id);
    expect(all.zipName).toBe("Sự kiện.zip");
    expect(paths(all)).toEqual(["cover.jpg", "Ngày 1/a.jpg", "Ngày 1/Sáng/b.mp4"]);

    const sub = await listFolderDownload(sessionFor(viewer), day.id);
    expect(paths(sub)).toEqual(["a.jpg", "Sáng/b.mp4"]);
  });

  it("skips trashed subfolders and files", async () => {
    const { owner, root, day, morning, viewer } = await setup();
    await makeFile(day, owner, { name: "keep.jpg" });
    await makeFile(morning, owner, { name: "gone.jpg" });
    signIn(sessionFor(await makeUser({ role: "admin" })));
    expect(await trashFolder(morning.id)).toEqual({});
    expect(paths(await listFolderDownload(sessionFor(viewer), root.id))).toEqual(["Ngày 1/keep.jpg"]);
  });

  it("numbers clashing names", async () => {
    const { owner, day, viewer } = await setup();
    await makeFile(day, owner, { name: "IMG.jpg" });
    await makeFile(day, owner, { name: "img.jpg" });
    await makeFile(day, owner, { name: "IMG.jpg" });
    // Clashes ignore case (Windows and macOS file systems do too).
    const got = paths(await listFolderDownload(sessionFor(viewer), day.id));
    expect(new Set(got.map((p) => p.toLowerCase())).size).toBe(3);
    expect(got.filter((p) => /^img \([23]\)\.jpg$/i.test(p))).toHaveLength(2);
  });

  it("hides folders the user can't see", async () => {
    const { root } = await setup();
    const stranger = await makeUser();
    await expect(listFolderDownload(sessionFor(stranger), root.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("listFilesDownload", () => {
  it("refuses when one picked file is out of reach", async () => {
    const { owner, root, viewer } = await setup();
    const mine = await makeFile(root, owner);
    const elsewhere = await makeFile(await makeFolder(owner), owner);
    await expect(listFilesDownload(sessionFor(viewer), [mine.id, elsewhere.id])).rejects.toBeInstanceOf(
      NotFoundError,
    );
    const ok = await listFilesDownload(sessionFor(viewer), [mine.id]);
    expect(ok.entries).toHaveLength(1);
    expect(ok.zipName).toBe("Sự kiện - 1 file.zip");
  });
});

describe("listSharedDownload", () => {
  it("stays inside a folder link's subtree", async () => {
    const { owner, root, day, other } = await setup();
    await makeFile(day, owner, { name: "in.jpg" });
    const outside = await makeFile(other, owner, { name: "out.jpg" });
    const link = await makeShareLink(day, owner);
    await grant(owner, root, "owner");
    const resolved = await resolveShareLink(link.token);
    if (resolved.status !== "ok") throw new Error("link should resolve");

    expect(paths(await listSharedDownload(resolved.link, resolved.root, {}))).toEqual(["in.jpg"]);
    await expect(
      listSharedDownload(resolved.link, resolved.root, { folderId: other.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      listSharedDownload(resolved.link, resolved.root, { fileIds: [outside.id] }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("only gives a files link's own files", async () => {
    const { owner, root } = await setup();
    const shared = await makeFile(root, owner, { name: "shared.jpg" });
    const notShared = await makeFile(root, owner, { name: "private.jpg" });
    const link = await makeShareLink(root, owner, { fileIds: [shared.id] });
    await grant(owner, root, "owner");
    const resolved = await resolveShareLink(link.token);
    if (resolved.status !== "ok") throw new Error("link should resolve");

    expect(paths(await listSharedDownload(resolved.link, resolved.root, {}))).toEqual(["shared.jpg"]);
    await expect(
      listSharedDownload(resolved.link, resolved.root, { fileIds: [notShared.id] }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("path helpers", () => {
  it("makes names safe and unique", () => {
    expect(safeSegment('a/b:c*?"<>|.jpg')).toBe("a_b_c______.jpg");
    expect(safeSegment("..")).toBe("_");
    expect(dedupePaths([{ path: "x/.env" }, { path: "x/.env" }, { path: "noext" }, { path: "NOEXT" }]).map((e) => e.path)).toEqual([
      "x/.env",
      "x/.env (2)",
      "noext",
      "NOEXT (2)",
    ]);
  });
});
