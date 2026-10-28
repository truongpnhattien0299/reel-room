# 06 — Nền tảng test (Vitest + Postgres trong bộ nhớ)

> Nhánh `chore/tests` từ `develop`, PR vào `develop`. Làm trước các plan 07–16, vì các plan đó đụng vào quyền truy cập và đường dẫn folder.

## Context
Project chưa có test nào: không có thư mục test, `package.json` không có script `test`, cũng không có workflow GitHub Actions (check duy nhất trên PR là Vercel preview). Phần dễ hỏng nhất lại không nhìn thấy trên UI:
- `getUserRole` / `requireFolderRole` (`src/server/permissions.ts`): quyền kế thừa từ folder tổ tiên, admin luôn là owner.
- `hasGrant` / `grantedOn` (`src/server/queries.ts`): điều kiện SQL dùng ở thư viện, tìm kiếm, thùng rác, trang link.
- `resolveShareLink` và trạng thái link trong `listAllShareLinks` (`src/server/share-links.ts`): hai chỗ phải cho cùng kết quả.
- Thùng rác: `trashFolder` / `restoreFolder` dựa vào `deletedAt` bằng nhau để khôi phục đúng nhóm.

Plan 07 (di chuyển) sẽ viết lại `path` của cả cây con, nên cần test trước khi làm.

## Công cụ
- **Vitest**, môi trường `node`. Alias `@/` khai báo thẳng trong `vitest.config.mts` (không cần `vite-tsconfig-paths`).
- **PGlite** (`@electric-sql/pglite`) làm Postgres trong bộ nhớ, dùng `drizzle-orm/pglite`. Không cần Docker hay DB thật.
  - Chạy các file trong `drizzle/` theo thứ tự `meta/_journal.json` để có đúng schema.
  - Migration `0002_search_unaccent.sql` cần extension `unaccent`: nạp `@electric-sql/pglite/contrib/unaccent` (đã kiểm: chạy được).
- **Thay `@/db`:** `vi.mock("@/db")` trả về instance drizzle PGlite.
  - Driver thật là `neon-http`, có `db.batch([...])`. Drizzle PGlite không có `batch`, nên mock thêm `batch = (qs) => db.transaction(async (tx) => { for (const q of qs) await q })`. Ghi chú trong file setup rằng đây là bản giả lập.
- **`server-only`:** alias sang file rỗng trong `vitest.config.ts`.
- **Session giả:** helper `fakeSession({ id, role })` trả object đúng kiểu `Session` ở các field code dùng (`user.id`, `user.role`).
- Server action gọi `requireSession()` và `refresh()`: mock `@/lib/auth` (`requireSession` trả session đang đặt cho test) và `next/cache` (`refresh` no-op).

## Cấu trúc
- `vitest.config.mts` (`.mts` để Vite không cảnh báo ESM trong file CommonJS)
- `test/setup/db.ts`: tạo PGlite, chạy migration, `resetDb()` (truncate mọi bảng app + `user`) trước mỗi test.
- `test/setup/factories.ts`: `makeUser`, `makeFolder(parent?)` (tự tính `path`), `grant(user, folder, role)`, `makeFile(folder, opts)`, `makeShareLink(...)`.
- Test đặt cạnh code: `src/**/*.test.ts`.

## Test đầu tiên (phạm vi PR này)
1. **`permissions.test.ts`**
   - Grant ở folder cha áp dụng cho folder cháu; lấy role cao nhất khi có nhiều grant.
   - Admin là owner ở mọi nơi.
   - `requireFolderRole`: không có quyền → `NotFoundError` (giấu sự tồn tại); có quyền nhưng thấp → `ForbiddenError`; folder trong thùng rác → `NotFoundError`.
2. **`queries.test.ts`**: `hasGrant` cho cùng kết quả với `getUserRole` trên cùng một cây (test dạng bảng: mỗi cặp user × folder).
3. **`share-links.test.ts`**: mỗi trạng thái (`active`, `expired`, `folder_trashed`, `creator_banned`, `creator_no_access`) của `listAllShareLinks` khớp với `resolveShareLink` cho cùng link.
4. **`actions.trash.test.ts`**: xoá folder rồi khôi phục; file đã xoá riêng trước đó vẫn ở thùng rác; không khôi phục được folder con khi folder cha còn trong thùng rác.
5. **`releases.test.ts`** (thuần, không DB): `RELEASES` xếp version giảm dần, không trùng, ngày hợp lệ, và có entry cho `CURRENT_VERSION`. Bắt lỗi quên thêm entry khi release.
6. **`format.test.ts`**: `formatBytes`, `formatDuration`, `formatRelative` (truyền `now` cố định).

## CI
- Script mới: `"test": "vitest run"`, `"test:watch": "vitest"`.
- Thêm `.github/workflows/ci.yml`: chạy trên PR vào `develop` và `main`, Node từ `.nvmrc`, pnpm, rồi `pnpm typecheck && pnpm lint && pnpm test`. Không chạy `build` ở đây (Vercel preview đã build).
- AGENTS.md: sửa dòng Verify thành `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, thêm một dòng: logic quyền mới phải có test.

## Files
- **Mới:** `vitest.config.mts`, `test/setup/{db,auth,mocks,factories,empty}.ts`, các file `*.test.ts` ở trên, `.github/workflows/ci.yml`.
- **Sửa:** `package.json` (devDeps + scripts), `AGENTS.md`. Test import tường minh từ `vitest`, không đổi `tsconfig.json`.

## Lỗi tìm ra khi viết test
- `listAllShareLinks` xét "người tạo mất quyền" trước "hết hạn", ngược với `resolveShareLink`. Link vừa hết hạn vừa mất quyền thì `/links` báo "Người tạo mất quyền" trong khi khách thấy "Link đã hết hạn". Đã đổi thứ tự trong SQL cho khớp.

## Verification
- `pnpm test` pass ở máy local; cố ý sửa sai một điều kiện trong `hasGrant` thì test đỏ.
- Push nhánh: workflow CI chạy và xanh trên PR.
- Thời gian chạy toàn bộ dưới ~20 giây.
