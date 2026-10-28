# 08 — Thao tác hàng loạt trong folder

> Nhánh `feat/bulk-actions` từ `develop`, PR vào `develop`. Cần plan 07 (di chuyển) đã merge.

## Context
`FileGrid` (`src/components/folders/file-grid.tsx`) đã có chế độ chọn nhiều file, nhưng chỉ để tạo link chia sẻ, và chỉ bật khi user là editor (`shareFolderId`). Xoá hay di chuyển 50 file vẫn phải làm từng file một.

Mục tiêu: dùng lại chế độ chọn hiện có, thêm thao tác hàng loạt, và bật chọn cho cả viewer (để tải về, sau khi có plan 09).

Không cần migration.

## Thao tác trên thanh công cụ
Thanh nổi ở đáy (`role="toolbar"`, đã có) hiện số file đã chọn và các nút:

| Nút | Ai thấy | Làm gì |
|---|---|---|
| Tạo link | editor | như hiện tại (`ShareFilesDialog`) |
| Di chuyển | editor | mở `MoveDialog` của plan 07 với các file đã chọn |
| Xoá | editor | xác nhận rồi chuyển vào thùng rác; toast có nút "Hoàn tác" |
| Tải về | mọi người | thêm ở plan 09 |

- Trên điện thoại thanh quá hẹp: hiện 2 nút chính (Tải về, Di chuyển), các nút còn lại vào menu "…".
- Chọn nhanh:
  - Shift + bấm: chọn một dải từ file bấm trước đến file vừa bấm, theo thứ tự đang hiển thị (sau lọc và sắp xếp).
  - `Ctrl/Cmd + A` khi đang ở chế độ chọn: chọn tất cả file đang hiển thị. `Esc` thoát (đã có).
- Sau thao tác thành công: bỏ chọn và thoát chế độ chọn.

## Server (`src/server/actions.ts`)
- **`trashFiles(fileIds: string[])`**
  - zod 1–500 uuid. Load file còn sống, gom theo `folderId`, `requireFolderRole(folder, "editor")` cho từng folder khác nhau.
  - Một câu `update ... set deleted_at = now, deleted_by = user where id in (...) and deleted_at is null`.
  - Trả `{ deletedAt }` để client làm "Hoàn tác".
  - `trashFile` hiện có gọi lại hàm này với một id.
- **`restoreFiles(fileIds: string[])`**
  - Cho "Hoàn tác". Dùng cùng kiểm tra quyền như `restoreFile` (`requireTrashed...` hiện có), báo lỗi nếu folder chứa đã vào thùng rác.
  - `restoreFile` gọi lại hàm này.
- `moveFiles` đã có từ plan 07.

## UI
- **`FileGrid`:**
  - Tách `canSelect` (luôn true khi có ít nhất một thao tác dùng được) khỏi `shareFolderId`.
  - Prop mới `folderId` (thay vì suy ra từ `shareFolderId`), để truyền cho `MoveDialog`.
  - Thêm state `lastClickedId` cho Shift + bấm.
- **`src/components/folders/selection-toolbar.tsx` (mới):** tách thanh công cụ ra khỏi `FileGrid` cho dễ đọc. Nhận danh sách action giống kiểu `MenuAction` ở `item-menu.tsx`.
- Xoá hàng loạt dùng `ConfirmDialog`: "Chuyển N file vào thùng rác? Có thể khôi phục trong 30 ngày." (lấy `TRASH_RETENTION_DAYS`).
- Trang chia sẻ công khai `/s/[token]` dùng chung `FileGrid`: ở đó chỉ hiện "Tải về" (sau plan 09), không có thao tác sửa.
- Chọn **folder con** để thao tác hàng loạt: **ngoài phạm vi**; folder vẫn thao tác từng cái qua menu.

## Test
- `trashFiles` với file ở hai folder, user chỉ là editor ở một folder → `ForbiddenError`, không file nào bị xoá.
- `trashFiles` rồi `restoreFiles` cùng danh sách → về như cũ.

## Files
- **Sửa:** `src/server/actions.ts`, `src/components/folders/file-grid.tsx`, `src/app/(app)/f/[folderId]/page.tsx` (truyền `folderId`).
- **Mới:** `src/components/folders/selection-toolbar.tsx`, `src/server/actions.bulk.test.ts`.

## Verification
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- Trình duyệt: chọn 3 file bằng Shift + bấm → xoá → toast "Hoàn tác" khôi phục đủ 3. Chọn tất cả → di chuyển sang folder khác.
- User viewer: vào chế độ chọn được nhưng không thấy Di chuyển / Xoá / Tạo link.
- Bề rộng 375px: thanh công cụ không tràn.
