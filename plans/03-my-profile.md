# 03 — Trang "Hồ sơ của tôi" (đổi tên, avatar)

## Context
User không tự sửa được thông tin của mình. Avatar mới chỉ là initials trên màu `toneFor(email)` trong sidebar. Bảng `user` đã có cột `image` (better-auth), nên **không cần migration**.

Mục tiêu: trang `/profile` cho mọi user đã đăng nhập:
- đổi tên hiển thị;
- tải lên, đổi, xoá ảnh đại diện.

Email và vai trò chỉ hiển thị, không sửa được ở đây (admin đổi ở `/admin/users`).

## Lưu avatar
- **Key R2:** `avatars/{userId}/{uuid}.webp`. `user.image` lưu key này, không lưu URL.
- **Trình duyệt xử lý trước khi upload:**
  - `createImageBitmap` → crop vuông ở giữa → canvas 256×256 → WebP chất lượng 0.85, thường dưới 50KB.
  - File trình duyệt không decode được (vd HEIC ngoài Safari) thì báo lỗi.
- **Upload** dùng presigned PUT giống thumbnail (R2 đã có CORS):
  - `signAvatarUpload()` trả `{ key, url, headers }`, key luôn nằm dưới prefix của chính user.
  - `setMyAvatar(key)`:
    - kiểm regex `^avatars/{ownId}/{uuid}\.webp$`;
    - `headObject` phải có object, ≤ 512KB (quá thì xoá object và báo lỗi);
    - cập nhật `user.image`, rồi xoá object cũ (best effort).
  - `removeMyAvatar()`: đặt `image = null`, xoá object.
- **Đọc ảnh:** `GET /api/avatars/[userId]` (`withSession`, user đăng nhập nào cũng xem được) → 302 tới URL R2 đã ký.
  - URL hiển thị là `/api/avatars/{id}?v={uuid}` (`avatarUrl()` trong `src/lib/avatar.ts`), nên đổi ảnh là đổi URL, cache cũ không dính.
- **Rủi ro:** object mồ côi khi upload xong mà không gọi `setMyAvatar`. Chấp nhận, vì ảnh nhỏ và hiếm gặp.

## UI
- **`UserAvatar`** (`src/components/user-avatar.tsx`): hiện ảnh nếu có, không thì hiện initials trên tone. Dùng ở sidebar và trang profile.
- **Sidebar:** menu tài khoản thêm mục "Hồ sơ của tôi" (link `/profile`) phía trên "Đăng xuất". Avatar dùng `UserAvatar`.
- **Trang `/profile`** (`PageShell` + `PageHeader` "Hồ sơ của tôi"):
  - **Ảnh đại diện:**
    - avatar lớn (96px);
    - nút "Tải ảnh lên" / "Đổi ảnh" (input file `image/*` ẩn);
    - nút "Xoá ảnh";
    - spinner phủ lên avatar khi đang xử lý.
  - **Thông tin:**
    - form Tên + nút Lưu (chỉ bật khi có thay đổi), action `updateMyName`;
    - Email và Vai trò read-only kèm ghi chú "Liên hệ admin để đổi".

## Files
- **Mới:**
  - `src/app/(app)/profile/{page,loading}.tsx`
  - `src/app/api/avatars/[userId]/route.ts`
  - `src/components/profile/{avatar-editor,profile-form}.tsx`
  - `src/components/user-avatar.tsx`
  - `src/lib/avatar.ts`
- **Sửa:**
  - `src/server/actions.ts` (`updateMyName`, `signAvatarUpload`, `setMyAvatar`, `removeMyAvatar`)
  - `src/lib/r2.ts` (`avatarKey`)
  - `src/components/app-sidebar.tsx`
  - `src/app/(app)/layout.tsx` (truyền `id`, `image`)

## Ngoài phạm vi
- Hiện avatar ở trang admin và ở uploader trong viewer. Hai chỗ này nằm ở PR #10 và #11 chưa merge; làm sau khi merge.
- Tự đổi mật khẩu.

## Verification
- `pnpm typecheck && pnpm lint && pnpm build`, chạy với Node 22.
- Browser pane:
  - Đổi tên: sidebar và tiêu đề cập nhật.
  - Upload ảnh JPG và PNG: avatar hiện ở sidebar và trang profile, request `/api/avatars/...` trả 302.
  - Đổi ảnh: object cũ bị xoá. Xoá ảnh: quay về initials.
  - Gọi `setMyAvatar` với key của user khác thì bị từ chối.
  - Mobile 375px. Console không lỗi.
