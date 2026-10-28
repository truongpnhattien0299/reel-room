import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: here("./src/") },
      // Server modules import it to fail client builds; tests run on the server.
      { find: "server-only", replacement: here("./test/setup/empty.ts") },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["test/setup/mocks.ts"],
  },
});
