import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test/setup/db";
import { makeFile, makeFolder, makeUser } from "../../test/setup/factories";
import { estimateMonthlyCost, getMonthlyGrowth, getStorageByUploader, getStorageOverview } from "./storage";

beforeEach(resetDb);

describe("storage stats", () => {
  let alice: Awaited<ReturnType<typeof makeUser>>;
  let bob: Awaited<ReturnType<typeof makeUser>>;
  let folder: Awaited<ReturnType<typeof makeFolder>>;

  beforeEach(async () => {
    alice = await makeUser({ name: "Alice" });
    bob = await makeUser({ name: "Bob" });
    folder = await makeFolder(alice);
  });

  it("splits live, trashed and unfinished uploads", async () => {
    await makeFile(folder, alice, { size: 100, mimeType: "image/jpeg" });
    await makeFile(folder, alice, { size: 200, mimeType: "video/mp4" });
    await makeFile(folder, bob, { size: 40, mimeType: "audio/wav" });
    await makeFile(folder, alice, { size: 1000, deletedAt: new Date() });
    await makeFile(folder, bob, { size: 5000, status: "uploading" });

    const o = await getStorageOverview();
    expect(o.live).toEqual({ bytes: 340, files: 3 });
    expect(o.trash).toEqual({ bytes: 1000, files: 1 });
    expect(o.pending).toEqual({ bytes: 5000, files: 1 });
    expect(o.byKind).toEqual({
      image: { bytes: 100, files: 1 },
      video: { bytes: 200, files: 1 },
      audio: { bytes: 40, files: 1 },
    });
  });

  it("counts only live files per uploader, largest first", async () => {
    await makeFile(folder, alice, { size: 100 });
    await makeFile(folder, bob, { size: 300 });
    await makeFile(folder, alice, { size: 9999, deletedAt: new Date() });
    await makeFile(folder, alice, { size: 9999, status: "uploading" });

    const rows = await getStorageByUploader();
    expect(rows.map((r) => [r.name, r.bytes, r.files])).toEqual([
      ["Bob", 300, 1],
      ["Alice", 100, 1],
    ]);
  });

  it("groups live uploads by month, with empty months filled in", async () => {
    await makeFile(folder, alice, { size: 10, createdAt: new Date("2026-10-27T23:00:00Z") });
    await makeFile(folder, alice, { size: 5, createdAt: new Date("2026-10-01T00:00:00Z") });
    await makeFile(folder, alice, { size: 7, createdAt: new Date("2026-08-31T23:59:59Z") });
    // Before the window, and trashed: both left out.
    await makeFile(folder, alice, { size: 99, createdAt: new Date("2026-07-15T00:00:00Z") });
    await makeFile(folder, alice, { size: 99, createdAt: new Date("2026-10-02T00:00:00Z"), deletedAt: new Date() });

    const growth = await getMonthlyGrowth(3, new Date("2026-10-28T12:00:00Z"));
    expect(growth).toEqual([
      { month: "2026-08", bytes: 7, files: 1 },
      { month: "2026-09", bytes: 0, files: 0 },
      { month: "2026-10", bytes: 15, files: 2 },
    ]);
  });
});

describe("estimateMonthlyCost", () => {
  it("charges only past the free 10 GB", () => {
    expect(estimateMonthlyCost(5 * 1024 ** 3, 0.015)).toBe(0);
    expect(estimateMonthlyCost(110 * 1024 ** 3, 0.015)).toBeCloseTo(1.5);
  });
});
