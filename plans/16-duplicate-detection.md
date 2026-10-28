# 16 — Phát hiện file trùng khi upload

> Nhánh `feat/duplicate-detection` từ `develop`, PR vào `develop`. Độc lập; làm cuối vì lợi ích nhỏ nhất so với công sức.

## Context
Upload lại một file đã có (thường gặp khi chép cả thẻ nhớ) tốn dung lượng R2 và làm rối thư viện. App hiện không biết hai file có giống nhau không.

## Cách làm
- **Băm ở trình duyệt, trước khi upload:** SHA-256 theo kiểu stream bằng `hash-wasm` (`createSHA256`, đọc file từng khối 8 MB qua `file.stream()`), chạy trong Web Worker để không đơ giao diện. `crypto.subtle.digest` phải đọc cả file vào RAM nên không dùng được với video lớn.
- **Lọc nhanh trước khi băm:** chỉ băm những file có **cùng kích thước** với một file đã có. Gọi server một lần với danh sách kích thước; đa số file không trùng kích thước nên không cần băm.
- Server không bao giờ đọc nội dung file (giữ nguyên quy tắc file không đi qua Next.js). Vì vậy hash do client gửi lên **chỉ dùng để gợi ý**, không dùng cho quyết định bảo mật nào.

## Schema (migration mới)
```ts
// trong bảng files
sha256: text("sha256"),
// index
index("files_size_idx").on(t.size),
index("files_sha256_idx").on(t.sha256),
```
- File cũ không có `sha256`. Không backfill (phải tải toàn bộ R2 về). Với file cũ, chỉ so được kích thước + tên → hiển thị "có thể trùng".

## Server
- **`POST /api/uploads/check`** (mới), body `{ folderId, items: [{ key, size, name, sha256? }] }`, tối đa 1000 item.
  - Bước 1 (chỉ có `size`): trả các `key` có file cùng kích thước **trong những folder user đọc được** (`grantedOn`), để client biết cần băm file nào.
  - Bước 2 (có `sha256`): trả cho mỗi `key` danh sách trùng `{ fileId, name, folder: { id, name } }`, tối đa 3 kết quả. Trùng hash = "trùng chắc chắn"; file cũ không có hash nhưng cùng kích thước + tên = "có thể trùng".
  - Chỉ trả file user có quyền xem, để không lộ file ở folder khác.
- Route đăng ký upload (`src/app/api/uploads/route.ts`) nhận và lưu thêm `sha256` nếu client đã tính.

## UI (luồng upload, `src/components/upload/upload-provider.tsx`)
1. User thả file → gọi check bước 1 → băm các file cùng kích thước (panel upload hiện "Đang kiểm tra trùng…") → check bước 2.
2. Có trùng → dialog trước khi upload: danh sách file trùng, mỗi dòng có thumbnail file đã có + chỗ của nó (link mở folder).
   - Lựa chọn chung: **Bỏ qua file trùng** (mặc định) / **Vẫn upload tất cả**; có thể đổi từng dòng.
3. File không trùng upload ngay, không chờ dialog.
- Thêm tuỳ chọn trong panel upload: "Không kiểm tra trùng" (lưu `localStorage`) cho người upload số lượng rất lớn.
- File > 4 GB: bỏ qua bước băm (quá lâu), chỉ cảnh báo theo kích thước + tên.

## Test
- Check route không trả file ở folder user không có quyền.
- Trùng hash ưu tiên hơn trùng kích thước + tên.
- Worker băm: test thuần với file nhỏ, so với hash đã biết.

## Files
- **Mới:** migration, `src/app/api/uploads/check/route.ts`, `src/components/upload/{hash-worker,duplicate-dialog}.ts(x)`, test.
- **Sửa:** `src/db/schema.ts`, `src/app/api/uploads/route.ts`, `src/components/upload/{upload-provider,upload-panel}.tsx`, `package.json` (`hash-wasm`).

## Verification
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; `pnpm db:migrate`.
- Upload một ảnh, upload lại chính ảnh đó vào folder khác → dialog báo trùng và chỉ đúng chỗ; chọn bỏ qua → không có file mới.
- Upload 100 ảnh mới hoàn toàn → không có dialog, thời gian thêm không đáng kể (không băm file nào vì không trùng kích thước).
- Video 2 GB trùng → băm chạy trong worker, giao diện vẫn mượt.
