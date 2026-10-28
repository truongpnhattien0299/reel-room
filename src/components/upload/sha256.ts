import { createSHA256 } from "hash-wasm";

/** Hex SHA-256 of a stream, without holding it all in memory. */
export async function sha256Stream(stream: ReadableStream<Uint8Array>) {
  const hasher = await createSHA256();
  hasher.init();
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    hasher.update(value);
  }
  return hasher.digest("hex");
}
