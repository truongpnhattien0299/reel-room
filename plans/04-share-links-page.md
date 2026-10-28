# 04 — Trang quản lý link chia sẻ (`/links`)

> Khi được duyệt: bước đầu là lưu plan này vào `plans/04-share-links-page.md`, tạo nhánh `feat/share-links-page` từ `develop`, PR vào `develop`.

## Context
Hiện tại link chia sẻ chỉ xem được trong dialog Chia sẻ của từng folder (`FolderShareLinks` trong `src/components/folders/share-links.tsx`). Muốn biết mình đã chia sẻ những gì thì phải mở lần lượt từng folder. Link nhiều file còn không xem được bên trong có file nào, và không đổi được hạn.

Link có thể chết mà UI không cho biết: `resolveShareLink` từ chối link khi folder đã vào thùng rác, hoặc người tạo bị ban hay mất quyền editor.

Mục tiêu là một trang `/links` gom mọi link user quản lý được, kèm trạng thái thật của từng link. Trên trang làm được các việc sau:
- copy link;
- đổi hạn;
- thu hồi một link hoặc nhiều link cùng lúc;
- xoá mọi link đã hết hạn;
- xem các file nằm trong link nhiều file.

Không cần migration.

## Phạm vi và quyền
- **Ai thấy link nào:**
  - User thấy mọi link (của mọi người tạo) trong những folder họ có quyền editor trở lên, kể cả folder đã vào thùng rác.
  - Admin thấy tất cả.
  - Điều kiện lọc dùng `grantedOn(session, folders.path, "editor")` (`src/server/queries.ts:187`), giống `listTrash`.
- **Ai sửa được:** đổi hạn và thu hồi theo luật hiện có của `deleteShareLink`: người tạo link, hoặc owner của folder (admin tính là owner).

## Server
`src/server/share-links.ts`:
- **`listAllShareLinks(session)`** trả mỗi dòng gồm:
  - `id, token, kind, expiresAt, createdAt`;
  - `folder: {id, name, deletedAt}`;
  - `creator: {id, name, image}`;
  - `fileCount` (subquery đã có);
  - `status`;
  - `canManage`.
- **`status`** tính bằng SQL để không phải query N lần. Thứ tự ưu tiên:
  1. `folder_trashed`: `folders.deleted_at` khác null.
  2. `creator_banned`: `user.banned`.
  3. `creator_no_access`: người tạo không phải admin và không có grant editor/owner trên folder hoặc folder tổ tiên. Dùng `exists` giống `grantedOn`, nhưng tham số là `share_links.created_by` thay cho session user. Tách thành helper `hasEditGrant(userIdCol, pathCol)` dùng chung với `grantedOn`.
  4. `expired`: `expires_at <= now()`.
  5. `active`.
  - Thứ tự này khớp với `resolveShareLink`.
- **`canManage`:**
  - Người tạo là session user, hoặc session user là owner của folder.
  - Owner check bằng SQL `exists` với role `owner`, dùng chung helper trên với min role. Admin luôn `true`.
- **Sắp xếp:** `createdAt desc`.
- **`listShareLinkFiles(session, linkId)`:**
  - Kiểm editor trên folder của link.
  - Trả `fileColumns` + `toFileItem` cho các file `ready`, chưa xoá, của link kiểu `files`.
- **`type ShareLinkRow`** export cho client.

`src/server/actions.ts`:
- **Helper `requireLinkManager(session, linkIds)`:**
  - Load các link kèm `folder.path`, bỏ qua điều kiện `deletedAt`.
  - Tính quyền bằng `getEffectiveRole` cho từng folder khác nhau (cache theo `folderId`). Cần editor trở lên, và phải là người tạo hoặc owner.
  - Lý do không dùng `requireFolderRole`: nó báo NotFound khi folder đã vào thùng rác, nên sẽ không thu hồi được link trong folder bị xoá.
- **Sửa `deleteShareLink`** cho dùng helper này.
- **Thêm `deleteShareLinks(ids: string[])`:**
  - Validate bằng zod: mảng uuid, 1 đến 500 phần tử.
  - Chỉ cần một link không đủ quyền là báo Forbidden.
  - Xoá bằng `delete ... where inArray`.
- **Thêm `updateShareLinkExpiry(linkId, expiresAt)`:**
  - Dùng lại schema `expiresAt` từ `shareLinkSchema` (tách thành `expirySchema`).
  - Kiểm quyền bằng `requireLinkManager`.
  - Chặn đổi hạn link có status `folder_trashed`.
- **Thêm `getShareLinkFiles(linkId)`** bọc `listShareLinkFiles`.

## UI
- **Sidebar** (`src/components/app-sidebar.tsx`):
  - Thêm mục "Link chia sẻ" (`Link2Icon`, `/links`) giữa "Thư viện" và "Thùng rác".
- **Trang `src/app/(app)/links/page.tsx`:**
  - `PageShell` + `PageHeader`, mô tả: "Mọi link công khai trong các folder bạn quản lý."
  - Khi không có link: hiện `Empty` giống trang trash. Có thêm `loading.tsx`.
- **Component mới `src/components/links/share-link-list.tsx`** (client):
  - **Thanh filter:**
    - `ToggleGroup` theo trạng thái: Tất cả / Đang hoạt động / Hết hạn / Không hoạt động (gồm 3 trạng thái chết), mỗi lựa chọn kèm số lượng;
    - toggle "Của tôi";
    - nút "Xoá link hết hạn (n)", có `ConfirmDialog`.
  - **Mỗi dòng** (danh sách `rounded-[18px] bg-card ring-1` giống `TrashList`):
    - checkbox chọn, chỉ hiện khi `canManage`;
    - icon kind;
    - tiêu đề "Cả folder" hoặc "N file", kèm link tới `/f/{folderId}` (tên folder);
    - `UserAvatar` cùng tên người tạo;
    - thời gian tạo;
    - badge trạng thái:
      - `active`: "Hết hạn {relative}" hoặc "Không hết hạn";
      - `expired`: "Đã hết hạn", màu destructive;
      - `folder_trashed`: "Folder trong thùng rác";
      - `creator_banned`: "Người tạo bị khoá";
      - `creator_no_access`: "Người tạo mất quyền".
    - **Hành động:**
      - Copy, chỉ khi `active`;
      - menu `…` với "Đổi hạn" và "Thu hồi", khi `canManage`.
  - **Chọn nhiều:** thanh nổi "Đã chọn n · Thu hồi" (giống selection bar ở file grid), có `ConfirmDialog` rồi gọi `deleteShareLinks`.
  - **Đổi hạn:**
    - Dialog dùng lại `ExpiryPicker`, `expiryDate` và `DEFAULT_EXPIRY`. Export `expiryDate` từ `share-links.tsx`.
    - Gọi `updateShareLinkExpiry`.
  - **Xem file:**
    - Link kiểu `files` có nút mở rộng dòng. Lần đầu mở mới lazy-load bằng `getShareLinkFiles`.
    - Hiện lưới thumbnail nhỏ dùng `MediaThumb` (cùng URL member như trash) kèm tên file; bấm vào thì tới `/f/{folderId}`.
    - Nếu số file còn lại ít hơn `fileCount` (file đã bị xoá) thì ghi chú thêm.
- **Dialog Chia sẻ của folder:** giữ nguyên, thêm link nhỏ "Quản lý mọi link" tới `/links`. Gợi ý trong `ShareFilesDialog` đổi thành "Xem lại hoặc thu hồi link ở trang Link chia sẻ".

## Files
- **Mới:**
  - `src/app/(app)/links/{page,loading}.tsx`
  - `src/components/links/{share-link-list,expiry-dialog,link-files}.tsx`
  - `plans/04-share-links-page.md`
- **Sửa:**
  - `src/server/share-links.ts`
  - `src/server/queries.ts` (tách helper grant)
  - `src/server/actions.ts`
  - `src/components/folders/share-links.tsx` (export `expiryDate` và `expiryText`, link "Quản lý mọi link")
  - `src/components/app-sidebar.tsx`
- **Tái dùng:**
  - `CopyLinkField`, `useCopy`, `absoluteUrl` (`src/components/copy-link.tsx`)
  - `ConfirmDialog`
  - `UserAvatar`
  - `MediaThumb`
  - `formatRelative`, `formatDateTime`
  - `shareLinkPath`
  - `ToggleGroup`, `DropdownMenu`, `Badge`, `Empty`

## Verification
- Chạy `pnpm typecheck && pnpm lint && pnpm build` (Node 22).
- `preview_start` dev server, rồi kiểm tra trong browser pane:
  - Tạo link cả folder, link nhiều file và một link sắp hết hạn → cả 3 hiện ở `/links` với đúng badge.
  - Đổi hạn → badge cập nhật, và `/s/{token}` vẫn mở được.
  - Thu hồi 1 link, rồi thu hồi nhiều link → `/s/{token}` báo link không hợp lệ.
  - "Xoá link hết hạn" chỉ xoá link đã hết hạn.
  - Xoá folder vào thùng rác → link hiện "Folder trong thùng rác" và vẫn thu hồi được.
  - Mở rộng link nhiều file → thấy thumbnail.
  - Đăng nhập user editor (không phải owner) → không có checkbox/menu cho link người khác tạo.
  - Console không lỗi.
