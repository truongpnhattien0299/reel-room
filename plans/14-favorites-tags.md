# 14 — Yêu thích và tag

> Hai PR riêng, cùng plan này:
> - **14a** `feat/favorites` — yêu thích (nhỏ, làm trước).
> - **14b** `feat/tags` — tag.
>
> Cả hai từ `develop`, PR vào `develop`. Độc lập với các plan khác.

## Context
Thư viện chỉ tổ chức được bằng cây folder. Muốn giữ nhanh những file/folder hay dùng, hoặc nhóm file theo chủ đề xuyên folder ("cưới", "bìa", "đã duyệt") thì chưa có cách.

## 14a — Yêu thích
**Mang tính cá nhân:** mỗi user có danh sách riêng, người khác không thấy.

### Schema
```ts
export const favorites = pgTable("favorites", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "cascade" }),
  folderId: uuid("folder_id").references(() => folders.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("favorites_file_uq").on(t.userId, t.fileId).where(sql`${t.fileId} is not null`),
  uniqueIndex("favorites_folder_uq").on(t.userId, t.folderId).where(sql`${t.folderId} is not null`),
  check("favorites_one_target", sql`(${t.fileId} is null) <> (${t.folderId} is null)`),
]);
```

### Server
- `toggleFavorite({ fileId } | { folderId })`: kiểm quyền viewer (qua `requireFileRole` / `requireFolderRole`), insert hoặc delete.
- `listFavorites(session)`: file và folder còn sống **mà user vẫn còn quyền đọc** (lọc bằng `grantedOn(session, folders.path)`). Mất quyền thì mục đó tự ẩn, không xoá dòng.
- `getFolderView` và `listRecentFiles` trả thêm `isFavorite` cho từng file/folder (left join `favorites` theo `session.user.id`).

### UI
- Biểu tượng sao (`StarIcon`, tô màu khi đã thích) ở góc card file, card folder, và trên thanh của `MediaViewer`. Phím tắt `F` trong viewer.
- Mục mới trong menu "…": "Thêm vào yêu thích" / "Bỏ yêu thích".
- Trang `/favorites` ("Yêu thích", sidebar dưới "Thư viện"): phần Folder rồi phần File (dùng `FileGrid`, mở viewer được). Bỏ thích ngay trên trang thì cập nhật lạc quan.

## 14b — Tag
**Dùng chung:** tag gắn lên file thì mọi người xem được file đó đều thấy.

### Quyết định cần duyệt
- **Phạm vi tên tag:** tag là danh sách **chung toàn app** (đơn giản, gợi ý tự động dùng được ở mọi folder). Tên tag lộ cho mọi user, nên đừng đặt tag chứa thông tin nhạy cảm. Phương án khác: tag theo từng folder gốc (kín hơn, phức tạp hơn). Mặc định chọn **chung toàn app**.
- **Ai gắn/gỡ tag:** editor của folder chứa file. **Ai tạo tag mới:** bất kỳ editor nào (tạo khi gõ tên chưa có). **Đổi tên / xoá tag:** chỉ admin.

### Schema
```ts
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull().default("slate"),  // một trong vài màu định sẵn
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("tags_name_uq").on(sql`lower(${t.name})`)]);

export const fileTags = pgTable("file_tags", {
  fileId: uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.fileId, t.tagId] }), index("file_tags_tag_idx").on(t.tagId)]);
```

### Server
- `setFileTags(fileIds[], { add: string[], remove: string[] })` (tên tag; tạo tag nếu chưa có). Dùng được cho một file và cho chọn nhiều (plan 08).
- `listTags()` cho ô gợi ý; `renameTag`, `deleteTag`, `setTagColor` (admin).
- `getFolderView` trả `tags` cho mỗi file (một query phụ `file_tags` join `tags` cho các file của folder).
- `searchLibrary` hỗ trợ cú pháp `#tên-tag` và trang `/tags/[id]` liệt kê mọi file mang tag mà user đọc được (lọc `grantedOn`).

### UI
- Bảng thông tin file trong viewer: dòng "Tag" với các chip, ô thêm tag có gợi ý (combobox) cho editor.
- Card file: tối đa 2 chip nhỏ ở góc dưới, "+N" nếu nhiều hơn.
- `FileGrid`: thêm bộ lọc theo tag (dropdown nhiều lựa chọn) cạnh chip loại.
- Thanh chọn nhiều: "Gắn tag".
- Admin: trang `/admin/tags` để đổi tên, đổi màu, xoá, xem số file mỗi tag.

## Test
- 14a: không thích được file mình không đọc được; mất quyền thì mục biến khỏi `/favorites`.
- 14b: viewer không gắn tag được; trùng tên khác hoa/thường dùng lại tag cũ; `/tags/[id]` không trả file ngoài quyền.

## Files
- 14a — **mới:** migration, `src/app/(app)/favorites/{page,loading}.tsx`, `src/components/favorite-button.tsx`; **sửa:** schema, `actions.ts`, `queries.ts`, các card, `media-viewer.tsx`, `app-sidebar.tsx`.
- 14b — **mới:** migration, `src/server/tags.ts`, `src/components/tags/*`, `src/app/(app)/tags/[id]/page.tsx`, `src/app/(app)/admin/tags/page.tsx`; **sửa:** schema, `queries.ts` (search), `file-grid.tsx`, viewer info panel, `selection-toolbar.tsx`.

## Verification
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; `pnpm db:migrate`.
- 14a: thích một file và một folder → hiện ở `/favorites`; thu quyền user đó ở folder → biến mất.
- 14b: gắn tag "cưới" cho 5 file ở 2 folder → tìm `#cưới` ra đủ 5; lọc theo tag trong folder đúng.
