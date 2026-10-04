<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project notes

- Node ≥ 22.13 (`.nvmrc`); the system default Node 20 breaks pnpm 11. Use `export PATH=~/.nvm/versions/node/v22.13.0/bin:$PATH`.
- shadcn/ui uses the **Base UI** preset (`base-nova`): compose with the `render` prop, not `asChild`; menu items use `onClick`, not `onSelect`.
- Every server action / route handler must check access via `requireFolderRole` (src/server/permissions.ts). `proxy.ts` is only an optimistic redirect.
- Files never pass through Next.js: the browser uploads to R2 with URLs signed by `/api/uploads/sign`, which only signs keys of the caller's own in-progress uploads.
- DB driver is `neon-http`: no interactive transactions; use `db.batch([...])` for atomic multi-statement writes.
- Verify with `pnpm typecheck && pnpm lint && pnpm build`.
