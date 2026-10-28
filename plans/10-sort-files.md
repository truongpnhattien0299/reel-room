# 10 — Sắp xếp file và folder

> Nhánh `feat/sort` từ `develop`, PR vào `develop`. Độc lập, làm lúc nào cũng được (nhỏ).

## Context
Lọc theo loại (Tất cả / Ảnh / Video / Audio) đã có trong `FileGrid`. Thiếu sắp xếp:
- file luôn mới nhất trước (`getFolderView` sắp `createdAt desc`);
- folder con luôn theo tên (`asc(folders.name)`).

Mọi file của một folder đã được tải về client, nên sắp xếp làm hoàn toàn ở client, không đổi query. Không cần migration.

## Tuỳ chọn
- **File:**
  - Mới nhất (mặc định) / Cũ nhất
  - Tên A→Z / Z→A — `Intl.Collator("vi", { numeric: true, sensitivity: "base" })` để `IMG_2` đứng trước `IMG_10`
  - Dung lượng lớn → nhỏ
  - Thời lượng dài → ngắn (chỉ hiện khi đang lọc Video hoặc Audio)
- **Folder con:** Tên A→Z (mặc định) / Mới cập nhật. "Mới cập nhật" dùng `lastUpload` trong `FolderStats` (đã có), rồi `updatedAt`.
- Thư viện gốc (`listRootFoldersWithStats`) giữ thứ tự hiện tại (upload gần nhất), thêm lựa chọn Tên A→Z.

## Lưu lựa chọn
- `localStorage` key `reelroom:sort:files` và `reelroom:sort:folders`, dùng chung mọi folder (giống cách nhớ âm lượng ở viewer). Bọc `try/catch`.
- Đọc trong `useEffect` để tránh lệch hydration: render đầu dùng mặc định, sau đó áp lựa chọn đã lưu.

## UI
- **`src/components/folders/sort-menu.tsx` (mới):** `DropdownMenu` với `DropdownMenuRadioGroup`, nút trigger kiểu `outline` icon `ArrowUpDownIcon` + nhãn ngắn ("Mới nhất"). Đặt cạnh nhóm chip lọc trong `FileGrid`.
- Thứ tự trong `MediaViewer` theo đúng thứ tự đang hiển thị (đã truyền `visible`, chỉ cần sắp trước khi lọc).
- `FolderGrid` (cả trang gốc và folder con) thêm menu sắp xếp ở góc phải tiêu đề phần "Folder".
- Trang chia sẻ công khai dùng chung `FileGrid` nên có luôn.
- Shift + bấm của plan 08 dùng thứ tự đã sắp.

## Files
- **Mới:** `src/components/folders/sort-menu.tsx`, `src/lib/sort.ts` (hàm so sánh thuần + test).
- **Sửa:** `src/components/folders/{file-grid,folder-grid}.tsx`, `src/app/(app)/page.tsx`.

## Test
- `src/lib/sort.test.ts`: tên có số sắp tự nhiên, tiếng Việt có dấu (`Đà Lạt` cạnh `Da Nang`), file không có thời lượng xếp cuối.

## Verification
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- Trình duyệt: đổi sang Tên A→Z, tải lại trang → vẫn giữ. Mở viewer, bấm mũi tên → đi theo thứ tự mới. Console không có cảnh báo hydration.
