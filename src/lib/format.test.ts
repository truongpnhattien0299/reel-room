import { describe, expect, it } from "vitest";
import { formatBytes, formatDuration, formatRelative } from "./format";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [1023, "1023 B"],
    [1536, "1.5 KB"],
    [10 * 1024, "10 KB"],
    [5.25 * 1024 ** 3, "5.3 GB"],
    [3 * 1024 ** 5, "3072 TB"],
  ])("%d → %s", (bytes, text) => expect(formatBytes(bytes)).toBe(text));
});

describe("formatDuration", () => {
  it.each([
    [0, "00:00"],
    [252_000, "04:12"],
    [3_725_000, "1:02:05"],
    [59_600, "01:00"],
  ])("%d → %s", (ms, text) => expect(formatDuration(ms)).toBe(text));
});

describe("formatRelative", () => {
  const now = Date.UTC(2026, 9, 28, 12);
  it("says just now under a minute", () => {
    expect(formatRelative(new Date(now - 30_000), now)).toBe("vừa xong");
  });
  it("picks the largest unit", () => {
    expect(formatRelative(new Date(now - 2 * 3600_000), now)).toBe("2 giờ trước");
    expect(formatRelative(new Date(now - 24 * 3600_000), now)).toBe("Hôm qua");
    expect(formatRelative(new Date(now + 3 * 24 * 3600_000), now)).toBe("sau 3 ngày nữa");
  });
});
