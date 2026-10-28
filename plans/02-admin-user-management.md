# 02 — Admin quản lý user (sửa, đổi vai trò, khoá, reset mật khẩu)

## Context
`/admin/users` hiện chỉ có: danh sách user (tên, email, vai trò, trạng thái kích hoạt), mời user, gửi lại mail đặt mật khẩu. Admin không sửa được gì sau khi user đã tạo.

Mục tiêu: admin cập nhật được user qua **trang chi tiết** `/admin/users/[id]`:
- sửa tên, email;
- đổi vai trò Admin ↔ Member;
- khoá / mở khoá;
- reset mật khẩu.

**Không xoá cứng user.** `folders.createdBy` và `files.uploadedBy` là FK không cascade. Khoá thay cho xoá, giữ lịch sử upload.

### Nền có sẵn
- better-auth 1.7.7 + `admin()` plugin (`src/lib/auth.ts`). Schema `user` đã có `role`, `banned`, `banReason`, `banExpires`, nên **không cần migration**.
- Plugin chặn tạo session khi `user.banned`. `ban-user` hủy luôn session đang có.
- Các endpoint `auth.api` đều cần `headers` của admin:
  - `adminUpdateUser`, `setRole`, `banUser`, `unbanUser`;
  - `setUserPassword`, `listUserSessions`, `revokeUserSessions`.
- Server actions dùng helper `run()` (`src/server/actions.ts:44`) và kiểm `isAdmin(session)` như `inviteUser`/`resendInvite`.
- `getSession` không bật cookie cache. Đổi role hay khoá có hiệu lực ở request kế tiếp.

## Phần A — Server

### Query
Trong `src/server/queries.ts`:
- `listUsers()`: thêm `banned`.
- `getUserDetail(id)`:
  - user, `activated` (có credential account);
  - số file upload và tổng dung lượng (`files.uploadedBy`, chưa xoá);
  - số folder đã tạo;
  - session gần nhất (`max(session.updatedAt)`) và số session còn hạn.
- `listUserGrants(id)`: `folderPermissions` join `folders` (bỏ folder đã xoá), gồm `folderId`, tên, `path`, role, ngày cấp.

### Actions
Thêm vào `src/server/actions.ts`, mục "Users (admin)". Action nào cũng:
- gọi `requireSession` và kiểm `isAdmin`, sai thì `ForbiddenError`;
- validate bằng zod;
- trả qua `run()`.

| Action | Việc làm |
|---|---|
| `updateUser(userId, { name, email })` | Email lowercase. Báo trùng "Email này đã có tài khoản". Nếu có invitation chờ cho email mới thì xoá invitation đó. Gọi `auth.api.adminUpdateUser`. |
| `setUserRole(userId, role)` | Gọi `auth.api.setRole`. |
| `lockUser(userId, reason?)` | `banned=true` và xoá session trong một `db.batch`. Link share do user tạo tự ngừng vì `resolveShareLink` bỏ qua creator bị khoá. |
| `unlockUser(userId)` | `banned=false`, xoá lý do khoá. |
| `sendPasswordReset(userId)` | Thay `resendInvite`, cùng logic `requestPasswordReset`. Dùng cho cả user chưa kích hoạt và user đã kích hoạt. |
| `setUserPassword(userId, password)` | Min 8, max 128. Gọi `auth.api.setUserPassword`, rồi `revokeUserSessions`. Dùng khi chưa cấu hình mail provider. |
| `revokeUserSessions(userId)` | Đăng xuất user khỏi mọi thiết bị. |

Bỏ quyền folder dùng lại `revokeShare(folderId, userId)`. Admin được coi là owner mọi folder nên đã qua kiểm quyền.

### Rào bảo vệ
Viết helper `assertCanChange(session, targetId, change)`:
- Không tự khoá mình. Không tự hạ quyền mình.
- Không hạ quyền hoặc khoá **admin cuối cùng còn hoạt động** (đếm `role='admin' and banned is not true`).
- `setUserPassword` và `revokeUserSessions` lên chính mình: chặn, vì admin sẽ tự đăng xuất mình. Muốn đổi mật khẩu của mình thì dùng luồng reset.

### Thông báo lỗi
Lỗi `APIError` của better-auth là tiếng Anh. Trong `run()`, map sang `{ error }` tiếng Việt.

`login-form.tsx` hiện hiện `error.message`. Thêm nhánh cho code `BANNED_USER`: "Tài khoản đã bị khoá, liên hệ admin". Có thể đặt thêm `bannedUserMessage` trong `admin({...})`.

## Phần B — Trang danh sách `/admin/users`
- Tên user thành `Link` tới `/admin/users/[id]`. Cả dòng click được trên mobile.
- Cột "Trạng thái" có 3 giá trị: Đã kích hoạt / Chờ đặt mật khẩu / **Đã khoá** (badge destructive).
- Bỏ `ResendInviteButton` ở cột cuối. Thay bằng chevron vào trang chi tiết; việc gửi lại nằm trong trang chi tiết.
- Dòng của chính admin có nhãn "Bạn".

## Phần C — Trang chi tiết `/admin/users/[id]`
Đọc doc Next trong `node_modules/next/dist/docs/` trước: dynamic `params` (Promise?), `notFound`, `loading.tsx`.

**Server page:**
- `requireSession` + `isAdmin`, sai thì `notFound()`.
- `getUserDetail`, không có thì `notFound()`.
- `metadata` động lấy tên user.

**Bố cục** (`PageShell` + `PageHeader`):
- **Header**
  - Breadcrumb "Quản lý user / {tên}".
  - Avatar initials dùng `toneFor` (giống `info-panel.tsx`), tên, email.
  - Badge vai trò và trạng thái.
- **Thông tin**: form tên, email, vai trò (`Select`: Member / Admin).
  - Nút "Lưu" chỉ bật khi có thay đổi.
  - Role đổi qua `setUserRole`; tên và email qua `updateUser`, gọi tuần tự.
  - `toast` khi xong.
  - Trường role disabled kèm gợi ý khi đó là chính mình hoặc admin cuối.
- **Mật khẩu & đăng nhập**
  - "Gửi email đặt lại mật khẩu", có confirm. Với user chưa kích hoạt, nhãn là "Gửi lại email kích hoạt".
  - "Đặt mật khẩu mới": dialog gồm input password và nút hiện/ẩn, kèm cảnh báo "user sẽ bị đăng xuất".
  - Số phiên đăng nhập đang hoạt động, lần hoạt động cuối, nút "Đăng xuất mọi thiết bị".
- **Quyền truy cập folder**: bảng folder, role, ngày cấp.
  - Tên folder link tới `/f/[id]`.
  - Nút "Bỏ quyền" (`ConfirmDialog`) gọi `revokeShare`.
  - Empty state: "Chưa được chia sẻ folder nào".
  - Admin có ghi chú "Admin xem được mọi folder".
- **Hoạt động**: ngày tạo, số file đã upload và dung lượng (`formatBytes`), số folder đã tạo.
- **Vùng nguy hiểm**
- Khi user chưa bị khoá: "Khoá tài khoản" mở dialog gồm lý do (tuỳ chọn) và giải thích hậu quả (đăng xuất ngay, link share ngừng tới khi mở khoá).
  - Khi user đã bị khoá: hiện lý do, ngày khoá (`updatedAt`) và nút "Mở khoá".

**Component mới** trong `src/components/admin/`:
- `user-profile-form.tsx`
- `user-password-actions.tsx` (gộp gửi mail, đặt mật khẩu, đăng xuất)
- `user-grants.tsx`
- `user-lock-card.tsx`

Tái dùng `Field`, `Input`, `Select`, `Dialog`, `ConfirmDialog` (`src/components/folders/confirm-dialog.tsx`), `Badge`, `Table`, `Card`, `Breadcrumb`, `sonner`. Base UI: dùng `render` prop, menu dùng `onClick`.

Mobile: các section xếp dọc. Bảng grants đổi thành list ở `< sm`.

## Files
- **Mới:**
  - `src/app/(app)/admin/users/[id]/page.tsx`
  - `src/app/(app)/admin/users/[id]/loading.tsx`
  - `src/components/admin/{user-profile-form,user-password-actions,user-grants,user-lock-card}.tsx`
- **Sửa:**
  - `src/server/actions.ts`
  - `src/server/queries.ts`
  - `src/app/(app)/admin/users/page.tsx`
  - `src/components/auth/login-form.tsx`
  - `src/lib/auth.ts` (`bannedUserMessage`)
- **Xoá:** `src/components/admin/resend-invite-button.tsx`, sau khi chuyển sang `sendPasswordReset`.

## Thứ tự làm
1. Query + actions + rào bảo vệ.
2. Trang danh sách.
3. Trang chi tiết: thông tin, mật khẩu, folder, khoá.
4. Login báo bị khoá.

## Verification
- `pnpm typecheck && pnpm lint && pnpm build`, chạy với Node 22: `export PATH=~/.nvm/versions/node/v22.13.0/bin:$PATH`.
- Trong browser pane (admin đã đăng nhập), làm trên user test tạo qua invite:
  - Sửa tên/email: danh sách cập nhật. Email trùng báo lỗi.
  - Đổi role Member → Admin → Member. Không hạ được chính mình. Không hạ được admin cuối.
  - Khoá: user bị đăng xuất (session bị xoá trong DB). Đăng nhập lại báo "Tài khoản đã bị khoá". Link share của user bị thu hồi. Mở khoá xong đăng nhập lại được.
  - Đặt mật khẩu mới: đăng nhập bằng mật khẩu mới được, session cũ bị hủy.
  - Gửi mail reset: toast thành công. Kiểm log mail provider/dev.
  - Bỏ quyền folder: dòng biến mất, user không còn thấy folder đó.
  - User thường vào `/admin/users/[id]` thì ra 404. Gọi action trực tiếp thì nhận `ForbiddenError`.
  - Mobile 375px: layout không tràn ngang.
  - Console không có lỗi.

## Ghi chú khi làm
- Profile/role/khoá/session ghi thẳng DB bằng drizzle (`db.batch` cho atomic), không qua `auth.api` admin endpoint; chỉ `setUserPassword` dùng `auth.api` để hash và tạo credential account nếu chưa có.
- Bỏ checkbox "thu hồi link share": `resolveShareLink` đã coi creator bị khoá là link invalid.
- "Hoạt động" dùng `max(session.createdAt)` = lần đăng nhập gần nhất (`updatedAt` chỉ refresh mỗi ngày).
