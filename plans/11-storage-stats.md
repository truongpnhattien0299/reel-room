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
