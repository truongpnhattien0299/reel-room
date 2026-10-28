import { sha256Stream } from "./hash";

self.onmessage = async (e: MessageEvent<{ id: number; file: File }>) => {
  const { id, file } = e.data;
  try {
    self.postMessage({ id, hash: await sha256Stream(file.stream()) });
  } catch (err) {
    self.postMessage({ id, error: (err as Error).message });
  }
};
