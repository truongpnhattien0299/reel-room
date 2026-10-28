# 11 — Thống kê dung lượng (admin)

> Nhánh `feat/storage-stats` từ `develop`, PR vào `develop`. Độc lập.

## Context
Chi phí R2 tính theo dung lượng lưu, nhưng admin không có chỗ nào xem tổng dung lượng, ai/folder nào chiếm nhiều, hay thùng rác đang giữ bao nhiêu. Mọi số liệu đều có sẵn trong bảng `files` (`size`, `mimeType`, `status`, `deletedAt`, `uploadedBy`, `createdAt`).

Lưu ý: số liệu DB chỉ tính file gốc. Thumbnail (`thumbs/*.webp`) và avatar không có kích thước trong DB → ghi chú "chưa tính thumbnail" trên trang thay vì gọi R2 để đếm.

Không cần migration.

## Trang `/admin/storage`
Chỉ admin (giống `/admin/users`: kiểm `isAdmin` trong page, không phải admin → `notFound()`).

1. **Hàng số tổng (stat tiles):**
   - Đang dùng: tổng `size` file `ready` còn sống + số file.
   - Trong thùng rác: tổng file có `deletedAt`, kèm "tự xoá sau tối đa 30 ngày".
   - Upload dở: file `uploading` (cron dọn sau 1 ngày).
   - Ước tính chi phí/tháng: `GB × giá` với giá lấy từ biến môi trường `R2_PRICE_PER_GB_MONTH` (mặc định `0.015`), trừ 10 GB miễn phí. Ghi rõ là ước tính.
2. **Theo folder gốc:** bảng tên folder, dung lượng, số file, % tổng, kèm thanh ngang nhỏ. Dùng `getFolderStats` cho các folder gốc (đã tính cả cây con). Bấm → `/f/{id}`.
3. **Theo người upload:** avatar + tên, dung lượng, số file. Link tới `/admin/users/{id}`.
4. **Theo loại:** ảnh / video / audio (theo tiền tố `mimeType`).
5. **Tăng trưởng:** dung lượng upload thêm mỗi tháng, 12 tháng gần nhất, dạng cột. Vẽ bằng div/SVG đơn giản theo token màu hiện có, không thêm thư viện chart.

## Server (`src/server/storage.ts`, mới)
- `getStorageOverview()`: một query `select ... sum(size) filter (where ...)` cho các tổng ở mục 1 và mục 4.
- `getStorageByUploader()`: `group by uploaded_by` join `user`.
- `getMonthlyGrowth()`: `group by date_trunc('month', created_at)` cho file `ready`, 12 tháng.
- Mục 2 dùng `listRootFolders` của admin + `getFolderStats`.
- Mọi hàm có `import "server-only"`; page gọi song song bằng `Promise.all`.

## Lối vào
- Sidebar mục Admin thêm "Dung lượng" (`HardDriveIcon`) dưới "Người dùng".
- Trang chi tiết user (`/admin/users/[id]`) thêm một dòng "Đã upload: X GB · N file".

## Files
- **Mới:** `src/server/storage.ts`, `src/app/(app)/admin/storage/{page,loading}.tsx`, `src/components/admin/storage-*.tsx` (tile, bảng, biểu đồ cột).
- **Sửa:** `src/components/app-sidebar.tsx`, `src/app/(app)/admin/users/[id]/page.tsx`, `.env.example` (`R2_PRICE_PER_GB_MONTH`).

## Test
- `storage.test.ts`: file trong thùng rác không tính vào "Đang dùng"; file `uploading` tách riêng; nhóm theo tháng đúng.

## Verification
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- So tổng "Đang dùng" với tổng dung lượng các folder gốc trên trang thư viện → khớp.
- Đăng nhập user thường, vào `/admin/storage` → 404. Bề rộng 375px: bảng cuộn ngang trong khung riêng, trang không tràn.

## Ghi chú khi làm
- **Nhánh tạo từ `develop`**, không phụ thuộc #19/#20.
- **Phân nhóm:**
  - "Đang dùng" = `ready` và chưa xoá.
  - "Thùng rác" = có `deleted_at` (mọi status). Xoá folder đã đóng dấu `deleted_at` xuống từng file, nên không cần join `folders`.
  - "Upload dở" = `uploading` chưa xoá. Đây là kích thước khai báo, R2 có thể chưa nhận đủ.
- **Chi phí ước tính** tính trên toàn bộ dung lượng còn nằm trong bucket (đang dùng + thùng rác + upload dở), trừ 10 GB miễn phí. 1 GB = 1024³ byte, khớp với `formatBytes`.
- **Biểu đồ tháng:**
  - Chỉ tính file còn đang dùng, để cộng lại ra đúng "Đang dùng" (file đã purge thì không còn trong DB).
  - Tháng tính theo UTC. `generate_series` điền các tháng trống.
  - Một series nên dùng một màu (primary), không cần chú thích. Có tooltip khi hover/focus từng cột, và "Xem dạng bảng" (`<details>`) cho số liệu.
  - Ở màn hẹp, nhãn tháng hiện xen kẽ, luôn giữ tháng mới nhất.
- **Theo loại:** chỉ ảnh/video/audio; app chỉ cho upload ba loại này.
- **Trang chi tiết user** đã có dòng "File đã upload: N · X" (chỉ tính file đang dùng), nên không thêm gì.
- **Sidebar:** "Quản lý user" giờ chỉ sáng ở `/admin/users*`; thêm "Dung lượng" sáng ở `/admin/storage`.
- **Factory `makeFile`** nhận thêm `status`, `createdAt`, `deletedAt`.
- **Thử trên trình duyệt:**
  - "Đang dùng" 1.4 MB / 6 file khớp tổng folder gốc "Viewer test".
  - Tooltip cột tháng 10 đúng.
  - Ở 375px: trang không tràn, các bảng cuộn trong khung riêng.
  - Chặn user thường: cùng kiểm tra `isAdmin` → `notFound()` như `/admin/users`. Không đăng nhập thử bằng tài khoản thường vì chưa có sẵn tài khoản đó.
