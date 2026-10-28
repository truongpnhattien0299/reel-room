import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sha256Stream } from "./sha256";

const streamOf = (...chunks: Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const chunk of chunks) c.enqueue(chunk);
      c.close();
    },
  });

describe("sha256Stream", () => {
  it("matches known digests", async () => {
    expect(await sha256Stream(streamOf(new TextEncoder().encode("abc")))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(await sha256Stream(streamOf())).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("hashes across chunk boundaries", async () => {
    const bytes = new Uint8Array(3 * 1024 * 1024 + 7).map((_, i) => i % 251);
    const expected = createHash("sha256").update(bytes).digest("hex");
    const chunks = [bytes.subarray(0, 5), bytes.subarray(5, 2_000_000), bytes.subarray(2_000_000)];
    expect(await sha256Stream(streamOf(...chunks))).toBe(expected);
  });
});
