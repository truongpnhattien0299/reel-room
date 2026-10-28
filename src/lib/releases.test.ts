import { describe, expect, it } from "vitest";
import { CHANGE_KINDS, CURRENT_VERSION, RELEASES, releaseDate } from "./releases";

const parse = (v: string) => v.split(".").map(Number);
const newer = (a: string, b: string) => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

describe("RELEASES", () => {
  it("has an entry for the version in package.json", () => {
    // Fails when a release PR bumps the version but forgets the notes.
    expect(RELEASES.map((r) => r.version)).toContain(CURRENT_VERSION);
  });

  it("is newest first, with unique semver versions and ordered dates", () => {
    for (const r of RELEASES) expect(r.version).toMatch(/^\d+\.\d+\.\d+$/);
    for (let i = 1; i < RELEASES.length; i++) {
      expect(newer(RELEASES[i - 1].version, RELEASES[i].version)).toBe(true);
      expect(releaseDate(RELEASES[i - 1]) >= releaseDate(RELEASES[i])).toBe(true);
    }
  });

  it("has valid dates and at least one change of a known kind each", () => {
    const kinds = new Set(CHANGE_KINDS.map((k) => k.kind));
    for (const r of RELEASES) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(releaseDate(r).getTime())).toBe(false);
      expect(r.changes.length).toBeGreaterThan(0);
      for (const c of r.changes) expect(kinds.has(c.kind)).toBe(true);
    }
  });
});
