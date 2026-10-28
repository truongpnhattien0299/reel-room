# 09 — Tải nhiều file / cả folder thành file zip

> Nhánh `feat/zip-download` từ `develop`, PR vào `develop`. Nên làm sau plan 08 (dùng thanh chọn nhiều file).

## Context
Hiện chỉ tải được từng file (`?download=1` trên `/api/files/[id]/content` và `/api/s/[token]/files/[id]/content`). Người nhận link chia sẻ một folder 200 ảnh phải bấm 200 lần.

**Ràng buộc chính:** theo AGENTS.md, file không bao giờ đi qua Next.js. Tạo zip trên server (Vercel function) sẽ phải kéo hết file qua function, vướng giới hạn thời gian và băng thông. Vì vậy **zip được tạo ngay trong trình duyệt**:
1. Server chỉ trả danh sách file + URL đã ký (R2 presigned GET).
2. Trình duyệt tải từng file trực tiếp từ R2 và ghép thành zip dạng stream.

Không cần migration.

## Server
- **`src/server/downloads.ts` (mới):**
  - `listFolderDownload(session, folderId)`: `requireFolderRole(folderId, "viewer")`, rồi lấy mọi file `ready` còn sống trong cả cây con (folder con còn sống). Mỗi dòng gồm `id, name, size, mimeType, relPath` — `relPath` là đường dẫn theo tên folder tính từ folder được tải (vd `Sự kiện/Ngày 1/IMG_001.jpg`).
  - `listFilesDownload(session, fileIds)`: các file đã chọn, mọi file phải user đọc được (gom theo folder, kiểm `viewer`).
  - Tên trùng trong cùng thư mục zip: thêm hậu tố ` (2)`, ` (3)` trước phần mở rộng.
  - Giới hạn: tối đa 5000 file hoặc 50 GB mỗi lần; quá thì báo lỗi rõ.
- **Route `POST /api/downloads` (mới):** body `{ folderId } | { fileIds }`. Trả `{ zipName, entries: [{ path, size, url }] }`, trong đó `url` là `presignRead(r2Key, { contentType })` (thời hạn ký đủ dài cho lượt tải lớn, vd 1 giờ).
- **Route `POST /api/s/[token]/downloads` (mới):** giống trên cho link công khai, phạm vi giới hạn trong link (dùng `resolveShareLink` + logic của `getSharedFolderView` / `getSharedFiles`). Sau plan 13, tôn trọng tuỳ chọn "không cho tải".
- Dùng `withSession` như các route hiện có.

## Client
- **Thư viện:** `client-zip` (~6 kB, tạo zip dạng stream, hỗ trợ file > 4 GB qua ZIP64). Không nén lại (ảnh/video đã nén) — chế độ "store".
- **`src/lib/zip-download.ts` (mới):** `downloadZip(request)`:
  1. Gọi route lấy danh sách.
  2. Tạo async generator: với mỗi entry, `fetch(url)` rồi `yield { name: path, input: response, size }`.
  3. Ghi ra đĩa:
     - **Chromium** (có `showSaveFilePicker`): hỏi chỗ lưu, pipe stream thẳng vào file → không giới hạn dung lượng, không tốn RAM.
     - **Trình duyệt khác:** gom thành `Blob` rồi tải về. Chỉ cho phép khi tổng ≤ 2 GB; quá thì đề nghị tải từng file (hoặc dùng Chrome).
  4. Hỗ trợ huỷ (`AbortController`).
- **Tiến trình:** dùng lại khung panel upload (`src/components/upload/upload-panel.tsx`) hoặc một toast có thanh tiến trình: "Đang nén 34/200 file · 1,2/4,8 GB", nút Huỷ.
- **CORS:** R2 phải cho phép `GET` từ domain app. README đã có bước cấu hình CORS cho upload; kiểm tra `AllowedMethods` có `GET` và cập nhật README nếu thiếu.

## UI (lối vào)
- Header trang folder `/f/[id]`: nút "Tải về" (icon `DownloadIcon`) → zip cả folder (`<tên folder>.zip`).
- Menu của `SubfolderCard` / `FolderCard`: "Tải về (.zip)".
- Thanh chọn nhiều file (plan 08): "Tải về" → zip các file đã chọn (`<tên folder> - N file.zip`); chọn đúng 1 file thì tải file gốc, không zip.
- Trang chia sẻ `/s/[token]`: nút "Tải tất cả" ở header, và "Tải về" trong thanh chọn.

## Test
- `listFolderDownload`: `relPath` đúng với cây 3 tầng; bỏ qua file trong folder con đã vào thùng rác; tên trùng được thêm hậu tố.
- Route công khai không trả file nằm ngoài phạm vi link.

## Files
- **Mới:** `src/server/downloads.ts`, `src/app/api/downloads/route.ts`, `src/app/api/s/[token]/downloads/route.ts`, `src/lib/zip-download.ts`, `src/components/download-progress.tsx`, test.
- **Sửa:** `src/app/(app)/f/[folderId]/page.tsx`, `src/app/s/[token]/page.tsx`, `src/components/folders/{folder-grid,selection-toolbar}.tsx`, `README.md` (CORS), `package.json` (`client-zip`).

## Verification
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- Chrome: tải folder có folder con → mở zip, cấu trúc thư mục đúng, file mở được, kích thước khớp.
- Safari: folder nhỏ tải được bằng Blob; folder > 2 GB hiện thông báo thay vì treo tab.
- Link công khai: tải tất cả hoạt động khi chưa đăng nhập.
- Network tab: không có request tải file nào đi qua domain app (chỉ R2).
