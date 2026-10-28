type Reply = { id: number; hash?: string; error?: string };

let worker: Worker | undefined;
let nextId = 0;
const waiting = new Map<number, (reply: Reply) => void>();
// One file at a time: hashing is disk-bound, and parallel reads only fight.
let queue: Promise<unknown> = Promise.resolve();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./hash-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<Reply>) => {
      waiting.get(e.data.id)?.(e.data);
      waiting.delete(e.data.id);
    };
  }
  return worker;
}

/** Hashes `file` in a Web Worker so big videos don't freeze the page. */
export function hashFile(file: File): Promise<string> {
  const run = () =>
    new Promise<string>((resolve, reject) => {
      const id = ++nextId;
      waiting.set(id, (r) => (r.hash ? resolve(r.hash) : reject(new Error(r.error ?? "Hash failed"))));
      getWorker().postMessage({ id, file });
    });
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}
