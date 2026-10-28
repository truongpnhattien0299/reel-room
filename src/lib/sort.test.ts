import { describe, expect, it } from "vitest";
import { sortFiles, sortFolders } from "./sort";

let seq = 0;
const file = (name: string, opts: { size?: number; durationMs?: number | null; at?: string } = {}) => ({
  id: `00000000-0000-0000-0000-${String(++seq).padStart(12, "0")}`,
  name,
  size: opts.size ?? 1,
  durationMs: opts.durationMs ?? null,
  createdAt: new Date(opts.at ?? "2026-10-01T00:00:00Z"),
});
const names = (xs: { name: string }[]) => xs.map((x) => x.name);

describe("sortFiles", () => {
  it("orders names naturally, numbers by value", () => {
    const files = ["IMG_10.jpg", "img_2.jpg", "IMG_1.jpg"].map((n) => file(n));
    expect(names(sortFiles(files, "name-asc"))).toEqual(["IMG_1.jpg", "img_2.jpg", "IMG_10.jpg"]);
    expect(names(sortFiles(files, "name-desc"))).toEqual(["IMG_10.jpg", "img_2.jpg", "IMG_1.jpg"]);
  });

  it("keeps Vietnamese names with marks next to their plain spelling", () => {
    const files = ["Huế", "Đà Lạt", "An Giang", "Da Nang", "Ba Vì"].map((n) => file(n));
    expect(names(sortFiles(files, "name-asc"))).toEqual(["An Giang", "Ba Vì", "Da Nang", "Đà Lạt", "Huế"]);
  });

  it("puts files without a duration last", () => {
    const files = [
      file("photo"),
      file("short", { durationMs: 1_000 }),
      file("long", { durationMs: 60_000 }),
    ];
    expect(names(sortFiles(files, "duration"))).toEqual(["long", "short", "photo"]);
  });

  it("orders by size, then newest", () => {
    const files = [
      file("small", { size: 10 }),
      file("big-old", { size: 99, at: "2026-01-01T00:00:00Z" }),
      file("big-new", { size: 99, at: "2026-06-01T00:00:00Z" }),
    ];
    expect(names(sortFiles(files, "size"))).toEqual(["big-new", "big-old", "small"]);
  });

  it("gives files uploaded at the same moment a fixed order", () => {
    const a = file("a");
    const b = file("b");
    expect(sortFiles([a, b], "newest")).toEqual(sortFiles([b, a], "newest"));
    expect(sortFiles([a, b], "oldest")).toEqual(sortFiles([a, b], "newest").reverse());
  });

  it("leaves the input untouched", () => {
    const files = [file("b"), file("a")];
    sortFiles(files, "name-asc");
    expect(names(files)).toEqual(["b", "a"]);
  });
});

describe("sortFolders", () => {
  const folder = (name: string, lastUpload: string | null, updatedAt?: string) => ({
    id: name,
    name,
    lastUpload: lastUpload ? new Date(lastUpload) : null,
    updatedAt: updatedAt ? new Date(updatedAt) : null,
  });

  it("puts folders with recent uploads first, then recently changed ones", () => {
    const folders = [
      folder("Empty old", null, "2026-01-01T00:00:00Z"),
      folder("Busy", "2026-10-01T00:00:00Z"),
      folder("Empty new", null, "2026-09-01T00:00:00Z"),
      folder("Quiet", "2026-02-01T00:00:00Z"),
    ];
    expect(names(sortFolders(folders, "recent"))).toEqual(["Busy", "Quiet", "Empty new", "Empty old"]);
    expect(names(sortFolders(folders, "name"))).toEqual(["Busy", "Empty new", "Empty old", "Quiet"]);
  });
});
