# 17 — Chọn nhiều trong thùng rác, dọn sạch thùng rác

> Nhánh `feat/trash-bulk` từ `develop`, PR vào `develop`.

## Context
Trang `/trash` (`src/components/trash/trash-list.tsx`) chỉ khôi phục / xoá vĩnh viễn từng mục một (`purgeFile`, `purgeFolder`, `restoreFile`, `restoreFolder`). Dọn 200 mục phải bấm 400 lần (nút + xác nhận).

Mục tiêu:
1. Chọn nhiều mục (cả folder lẫn file) để **xoá vĩnh viễn** hoặc **khôi phục** một lần.
2. Nút **"Dọn sạch thùng rác"** xoá vĩnh viễn mọi mục user có quyền xoá.

Không cần migration.

## Quyền (giữ đúng luật hiện có)
- File: editor trên folder chứa (`requireTrashedFile`).
- Folder: editor; **owner** nếu là folder gốc (`requireTrashedFolder`).
- Lưu ý: `listTrash` hiện lọc theo `editor`, nên editor vẫn *thấy* folder gốc dù không khôi phục hay xoá được (cả hai đều cần owner). Plan này:
  - Thêm cờ `canManage` vào `TrashItem` (tính trong `listTrash`: folder gốc cần owner). UI: checkbox và nút của dòng đó disabled, có tooltip "Chỉ owner mới khôi phục/xoá được folder gốc".
  - Server vẫn kiểm tra lại, không tin client.

## Server

### `src/server/purge.ts`
- Tách phần "purge + ghi activity" đang nằm trong cron (`api/cron/cleanup/route.ts`) thành **`purgeTrashed(actor, { folders, files })`**:
  - Bỏ các mục nằm trong một folder cũng đang được purge (so `path` prefix): folder con bị trash riêng trước rồi folder cha bị trash sau → `listTrash` liệt kê cả hai; purge cha đã xoá luôn con, purge con sau đó sẽ `NotFound`.
  - Purge folder trước (`purgeFolderTree` từng cái), rồi file còn lại (`purgeFiles` một lần).
  - Log `folder.purge` mỗi folder, `file.purge` gom theo folder chứa (`someNames`, như cron).
  - `actor = null` cho cron, `session` cho user.
- Cron gọi lại helper này → không đổi hành vi.

### `src/server/actions.ts`
- **`trashItemsSchema`**: zod mảng 1–500 `{ kind: "folder" | "file", id: uuid }`.
- **`requireTrashedItems(session, items)`** (thay cho việc gọi `requireTrashedFolder/File` từng cái):
  - Load một lần mọi folder + file còn trong thùng rác theo id. Thiếu mục nào → `NotFoundError("Không còn trong thùng rác")`.
  - Kiểm tra quyền theo luật ở trên, **cache role theo folder id** (nhiều file chung folder).
  - Một mục không đủ quyền → `ForbiddenError`, **không xoá gì** (giống `trashFiles`).
- **`purgeTrashItems(items)`**: `requireTrashedItems` → `purgeTrashed(session, …)`.
  - `purgeFile` / `purgeFolder` gọi lại hàm này với một mục.
- **`restoreTrashItems(items)`**:
  - File: gọi luồng của `restoreFiles` (đã hỗ trợ nhiều id).
  - Folder: logic của `restoreFolder` cho từng folder. Folder cha cũng đang được khôi phục trong cùng lần chọn → khôi phục cha trước (sắp theo độ sâu `path`), để không vướng lỗi "Folder cha cũng đang trong thùng rác".
  - File có folder chứa cũng nằm trong lựa chọn → khôi phục sau folder.
  - Không atomic giữa các folder (neon-http, mỗi folder một `db.batch`); kiểm tra quyền + điều kiện hết trước rồi mới ghi.
- **`emptyTrash(asOf: Date)`**:
  - Lấy danh sách giống `listTrash(session)` nhưng chỉ mục có `canManage` và `deletedAt <= asOf`. `asOf` = lúc trang render → mục vừa bị xoá ở tab khác sau khi user mở trang **không** bị dọn theo.
  - Mục không đủ quyền: **bỏ qua** (không lỗi), vì user không chọn từng mục.
  - Chia lô 500 nếu nhiều.
  - Trả `{ purged: number }` để toast "Đã xoá vĩnh viễn N mục".
- Tất cả đi qua `run(...)` + `revalidatePath("/trash")` như các action trash hiện có (kiểm tra cách `purgeFile` đang làm mới trang và làm y hệt).

## UI

### `TrashList`
- Mỗi dòng có checkbox ở đầu (luôn hiện — trang này là danh sách, không cần "chế độ chọn" như `FileGrid`). Bấm vào vùng dòng (ngoài nút) cũng chọn/bỏ chọn.
- Hàng đầu danh sách: checkbox "Chọn tất cả" (trạng thái indeterminate khi chọn một phần) + số mục.
- Chọn nhanh, giống plan 08:
  - Shift + bấm: chọn dải từ mục bấm trước.
  - `Ctrl/Cmd + A`: chọn tất cả (chỉ khi đã có ít nhất một mục được chọn, để không cướp phím của trang). `Esc`: bỏ chọn.
- Khi có ≥ 1 mục được chọn: hiện `SelectionToolbar` với
  - **Khôi phục** (primary)
  - **Xoá vĩnh viễn** (destructive)
  - Mục `canManage = false` không chọn được, kể cả bằng "Chọn tất cả" / Shift + bấm.
- Xoá vĩnh viễn hàng loạt dùng `ConfirmDialog`:
  - Tiêu đề: "Xoá vĩnh viễn N mục?"
  - Mô tả: "Gồm X folder (cùng mọi thứ bên trong) và Y file. Không thể hoàn tác."
- Sau thao tác thành công: bỏ chọn, toast kết quả. Mục biến mất khỏi danh sách do revalidate → lọc `selected` theo `items` hiện tại để không giữ id cũ.
- Nút xoá từng dòng vẫn giữ.

### `SelectionToolbar`
- Thêm prop `label` (hiện cứng `aria-label="File đã chọn"`) — trash truyền "Mục đã chọn". `FileGrid` truyền giá trị cũ.

### Nút "Dọn sạch thùng rác"
- `src/app/(app)/trash/page.tsx`: đặt ở slot action của `PageHeader` (thêm slot nếu chưa có). Chỉ hiện khi có ít nhất một mục `canManage`.
- Component client nhỏ `src/components/trash/empty-trash-button.tsx`: nút `variant="destructive"` outline + `ConfirmDialog`:
  - "Dọn sạch thùng rác?"
  - "N mục sẽ bị xoá vĩnh viễn khỏi hệ thống. Không thể hoàn tác." (+ "M mục bạn không có quyền xoá sẽ được giữ lại." nếu M > 0)
- Truyền `asOf` = `new Date()` lúc page render (server) xuống làm prop.

## Test (`src/server/actions.trash-bulk.test.ts`)
- `purgeTrashItems` với file ở hai folder, user chỉ là editor ở một folder → `ForbiddenError`, không mục nào bị xoá.
- Editor (không phải owner) chọn folder gốc đã trash → `ForbiddenError`; `listTrash` trả `canManage: false` cho mục đó.
- Chọn cả folder cha lẫn folder con / file bị trash riêng bên trong → không `NotFound`, tất cả biến mất khỏi DB, mỗi folder chỉ một dòng `folder.purge`.
- `restoreTrashItems` với folder cha + folder con trash riêng → cả hai được khôi phục (không lỗi "folder cha đang trong thùng rác").
- `emptyTrash`:
  - Chỉ xoá mục user có quyền; mục trong folder của user khác còn nguyên; folder gốc mà user chỉ là editor còn nguyên.
  - Mục có `deletedAt > asOf` còn nguyên.
- Cron cleanup vẫn pass test cũ sau khi chuyển sang `purgeTrashed`.

## Files
- **Sửa:** `src/server/purge.ts`, `src/server/actions.ts`, `src/server/queries.ts` (`canManage`), `src/app/api/cron/cleanup/route.ts`, `src/app/(app)/trash/page.tsx`, `src/components/trash/trash-list.tsx`, `src/components/folders/selection-toolbar.tsx`, `src/components/folders/file-grid.tsx` (truyền `label`), có thể `src/components/page-header.tsx` (slot action).
- **Mới:** `src/components/trash/empty-trash-button.tsx`, `src/server/actions.trash-bulk.test.ts`.

## Ngoài phạm vi
- Admin dọn thùng rác của mọi người (trang `/admin/storage` đã có số liệu trash; có thể làm sau).
- Hoàn tác sau khi xoá vĩnh viễn (không thể — object R2 đã xoá).
- Lọc / sắp xếp trong thùng rác.

## Verification
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- Trình duyệt:
  - Chọn 3 mục bằng Shift + bấm (1 folder, 2 file) → Xoá vĩnh viễn → xác nhận → biến mất, toast đúng số.
  - Chọn tất cả → Khôi phục → thùng rác trống, mục về đúng folder.
  - Trash vài mục → "Dọn sạch thùng rác" → trang hiện trạng thái trống.
  - Đăng nhập editor không phải owner: folder gốc đã trash có checkbox disabled, "Chọn tất cả" bỏ qua nó; "Dọn sạch" giữ lại folder đó.
- Bề rộng 375px: checkbox + nút dòng không tràn, toolbar vừa.

## Ghi chú khi làm
- `restoreFolder`, `restoreFiles`, `purgeFolder`, `purgeFile` giờ chỉ gọi lại `restoreTrashItems` / `purgeTrashItems` với một mục. `requireTrashedFolder` / `requireTrashedFile` được thay bằng `requireTrashedItems`.
- Khôi phục nhiều mục không atomic giữa các folder: nếu hỏng giữa chừng, phần đã khôi phục vẫn giữ nguyên, phần còn lại ở trong thùng rác (khôi phục không mất dữ liệu nên chấp nhận được).
- `emptyTrash` không chia lô 500: lô sau có thể chứa mục đã bị purge cùng folder ở lô trước → `NotFound`. Gọi `requireTrashedItems` một lần cho cả danh sách.
- Thêm `src/components/ui/checkbox.tsx` (shadcn, Base UI). Sửa import `cn` mà CLI sinh sai, và tô màu cho trạng thái indeterminate (cả `dark:`).
- `ConfirmDialog.onConfirm` nhận `ActionResult<unknown>` để `emptyTrash` trả về số mục.
- Cron: số `purgedFolders` / `purgedFiles` lấy từ `purgeTrashed`. File bị trash cùng folder hết hạn không còn bị log thêm một dòng `file.purge` thừa.
- Chưa có test riêng cho route cron (trước giờ cũng chưa có).
