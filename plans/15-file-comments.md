# 15 — Bình luận trên file

> Hai giai đoạn, hai PR:
> - **15a** `feat/comments` — thành viên bình luận.
> - **15b** `feat/guest-comments` — khách bình luận qua link chia sẻ.
>
> Từ `develop`, PR vào `develop`. 15b cần plan 13 (tuỳ chọn link).

## Context
Dùng ReelRoom để duyệt ảnh/video với khách thì hiện phải trao đổi ở kênh khác ("ảnh thứ 14 trong folder X"). Cần bình luận gắn ngay trên file. Với video/audio, gắn được mốc thời gian ("0:42 cắt đoạn này").

## Schema (migration mới)
```ts
export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  /** Null for guest comments (15b). */
  authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
  /** 15b: the link a guest commented through, and the name they typed. */
  linkId: uuid("link_id").references(() => shareLinks.id, { onDelete: "set null" }),
  guestName: text("guest_name"),
  body: text("body").notNull(),          // 1–2000 ký tự, văn bản thuần
  /** Video/audio position the comment refers to. */
  timestampMs: integer("timestamp_ms"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
}, (t) => [index("comments_file_idx").on(t.fileId, t.createdAt)]);
```
- Xoá mềm: bình luận đã xoá hiện "Bình luận đã bị xoá" để giữ mạch hội thoại. Một cấp, không trả lời lồng nhau.

## 15a — Thành viên

### Quyền
- **Đọc và viết:** mọi người có quyền **viewer** trở lên ở folder chứa file (người duyệt thường chỉ là viewer).
- **Sửa / xoá:** tác giả. **Xoá bình luận của người khác, đánh dấu đã xử lý:** editor trở lên.

### Server (`src/server/comments.ts`)
- `listComments(fileId)`: `requireFileRole(fileId, "viewer")`; trả kèm `author { id, name, image }`.
- `addComment(fileId, { body, timestampMs? })`, `editComment(id, body)`, `deleteComment(id)`, `setCommentResolved(id, resolved)`.
- `getFolderView` trả thêm `commentCount` (chưa xử lý) cho mỗi file, để hiện huy hiệu trên card.

### UI
- **Viewer:** bảng thông tin (đã có, dạng sheet trên điện thoại) thêm tab "Bình luận (N)":
  - Danh sách, ô nhập ở dưới (Enter gửi, Shift+Enter xuống dòng).
  - Video/audio: ô "Gắn mốc 0:42" bật sẵn, lấy thời điểm đang phát; bấm mốc trong bình luận → tua tới đó.
  - Trên thanh tua của video: chấm nhỏ ở các mốc có bình luận.
  - Bộ lọc "Ẩn đã xử lý".
- **Card file:** huy hiệu `MessageSquareIcon` + số bình luận chưa xử lý.
- Tải danh sách khi mở tab, không tải sẵn cho mọi file.

### Thông báo (tuỳ chọn, cần duyệt)
- Email cho người upload file khi có bình luận mới, gộp tối đa một email mỗi file mỗi 30 phút. Dùng `sendEmail` hiện có. **Mặc định không làm trong 15a**; ghi lại để quyết định sau.

## 15b — Khách bình luận qua link
- Thêm cột `allowComments boolean default false` vào `share_links` (cùng chỗ tuỳ chọn của plan 13).
- Trang `/s/[token]`: nếu bật, viewer công khai có tab Bình luận. Lần đầu gửi phải nhập tên (lưu `localStorage`), lưu `guestName` + `linkId`.
- Khách chỉ thấy bình luận gửi qua **cùng link** đó, cộng các bình luận thành viên trả lời trên file đó **sau khi** bật cho link (thành viên thấy tất cả, có nhãn "Khách · qua link …").
- Chống spam: tối đa 30 bình luận mỗi link mỗi giờ (đếm trong DB), độ dài ≤ 2000, chỉ văn bản thuần.
- Khách không sửa/xoá được; editor xoá được.

## Test
- Viewer bình luận được; không có quyền thì NotFound.
- Viewer không xoá được bình luận người khác; editor xoá được.
- 15b: link tắt `allowComments` → 403; khách không đọc được bình luận gửi qua link khác.

## Files
- 15a — **mới:** migration, `src/server/comments.ts`, `src/components/viewer/comments-panel.tsx`, test; **sửa:** schema, `queries.ts`, `media-viewer.tsx` và bảng thông tin, `file-card.tsx`, thanh tua video trong `src/components/player/`.
- 15b — **mới:** route `src/app/api/s/[token]/files/[fileId]/comments/route.ts`; **sửa:** schema, dialog tuỳ chọn link, `/s/[token]`.

## Verification
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; `pnpm db:migrate`.
- Hai tài khoản (editor + viewer) bình luận qua lại trên một video có mốc thời gian; bấm mốc thì tua đúng; đánh dấu đã xử lý thì huy hiệu trên card giảm.
- 15b: cửa sổ ẩn danh mở link có bật bình luận, nhập tên, gửi → thành viên thấy với nhãn Khách.
