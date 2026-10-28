# 12 — Nhật ký hoạt động

> Nhánh `feat/activity-log` từ `develop`, PR vào `develop`. Nên làm sau plan 07–08 để ghi luôn thao tác di chuyển và xoá hàng loạt.

## Context
Khi nhiều người dùng chung một folder, không ai biết ai đã upload, xoá, chuyển, chia sẻ hay đổi quyền. `deletedBy` chỉ cho biết người xoá gần nhất, và mất khi khôi phục. Cần một nhật ký chỉ ghi thêm (append-only).

## Schema (migration mới)
```ts
export const activityAction = pgEnum("activity_action", [
  "file.upload", "file.rename", "file.move", "file.trash", "file.restore", "file.purge",
  "folder.create", "folder.rename", "folder.move", "folder.trash", "folder.restore", "folder.purge",
  "share.grant", "share.revoke",            // quyền thành viên
  "link.create", "link.update", "link.revoke",
  "user.invite", "user.role", "user.lock", "user.unlock", "user.password",
]);

export const activity = pgTable("activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
  action: activityAction("action").notNull(),
  /** Folder the event happened in; its path is copied so the log survives moves and purges. */
  folderId: uuid("folder_id"),
  folderPath: text("folder_path"),
  targetUserId: text("target_user_id"),
  /** Names, counts, old/new values — whatever the row needs to read on its own. */
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("activity_created_idx").on(t.createdAt),
  index("activity_folder_path_idx").on(t.folderPath.op("text_pattern_ops")),
  index("activity_actor_idx").on(t.actorId),
]);
```
- Không có khoá ngoại tới `folders` / `files`: nhật ký phải còn sau khi xoá vĩnh viễn.
- `meta` lưu tên tại thời điểm xảy ra (vd `{ fileNames: ["a.jpg", ...], count: 12, from: "Folder A", to: "Folder B" }`). Danh sách tên cắt ở 20 phần tử.
- Thao tác hàng loạt ghi **một** dòng (vd "xoá 37 file"), không ghi 37 dòng.

## Ghi nhật ký
- **`src/server/activity.ts` (mới):** `logActivity(session, action, { folder?, targetUserId?, meta })` trả về **câu insert chưa chạy**, để đưa vào cùng `db.batch([...])` với thao tác chính. Nếu thao tác chính là một câu đơn thì chuyển sang `db.batch`.
- Gọi ở mọi action tương ứng trong `src/server/actions.ts` và route `src/app/api/uploads/[fileId]/complete/route.ts` (upload: gộp các file hoàn tất trong vòng ~1 phút vào một dòng thì phức tạp, **bản đầu ghi một dòng mỗi file**; trang hiển thị sẽ gộp các dòng `file.upload` liền nhau của cùng người, cùng folder).
- Cron (`/api/cron/cleanup`): ghi `file.purge` / `folder.purge` với `actorId = null` ("Hệ thống"), và xoá dòng nhật ký cũ hơn 365 ngày.

## Ai xem được gì
- **Admin:** tất cả, tại `/admin/activity`.
- **Owner của folder:** nhật ký của folder đó và cây con, lọc bằng `folder_path = path or folder_path like path || '/%'`. Editor/viewer: không xem (tránh lộ ai làm gì giữa các thành viên; có thể mở rộng sau).
- Sự kiện `user.*` chỉ admin thấy.

## UI
- **`/admin/activity`:** danh sách theo ngày (nhóm "Hôm nay", "Hôm qua", ngày cụ thể), mỗi dòng: avatar người làm, câu mô tả tiếng Việt ("**Lan** đã chuyển 12 file từ *Sự kiện* sang *Lưu trữ*"), giờ (`formatRelative`, tooltip `formatDateTime`). Bộ lọc: người làm, loại hành động, khoảng thời gian. Phân trang theo con trỏ `createdAt` (50 dòng/lần, nút "Xem thêm").
- **Folder:** owner thấy nút "Hoạt động" (`HistoryIcon`) trên header `/f/[id]`, mở `Sheet` bên phải với cùng danh sách, lọc theo folder.
- **`src/components/activity/activity-item.tsx`:** một hàm `describe(row)` dịch `action + meta` thành câu, dùng chung cho hai nơi.

## Test
- Mỗi action đã nối ghi đúng `action` và `folderPath`.
- Owner folder A không thấy sự kiện của folder B; owner thấy sự kiện của folder cháu.
- Thao tác thất bại (thiếu quyền) không ghi dòng nào.

## Files
- **Mới:** migration `drizzle/0005_activity.sql` (qua `pnpm db:generate`), `src/server/activity.ts`, `src/app/(app)/admin/activity/{page,loading}.tsx`, `src/components/activity/*`, test.
- **Sửa:** `src/db/schema.ts`, `src/server/actions.ts`, route upload complete, cron cleanup, `src/app/(app)/f/[folderId]/page.tsx`, `src/components/app-sidebar.tsx`.

## Verification
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; `pnpm db:migrate` trên DB dev.
- Upload, đổi tên, chuyển, xoá, khôi phục, tạo link, cấp quyền → mỗi việc hiện đúng một dòng ở `/admin/activity` và trong sheet của folder.
- Xoá vĩnh viễn folder → dòng cũ vẫn đọc được tên folder.

## Ghi chú khi làm
- **Nhánh tạo từ `develop`.** Sẽ xung đột nhẹ với #19 (header `/f/[id]`) và #21 (sidebar): cả hai cùng thêm nút/mục ở đúng chỗ đó.
- **Ghi cùng batch:** `logActivity` trả câu insert; mọi action đổi DB bằng một câu đã chuyển sang `db.batch([..., log])`. Thao tác bị từ chối (thiếu quyền, dữ liệu sai) ném lỗi trước batch nên không ghi gì; có test cho việc này.
- **Ngoại lệ không cùng batch:**
  - Xoá vĩnh viễn (`purgeFolderTree` / `purgeFiles` tự chạy batch rồi xoá R2) → ghi ngay sau.
  - `sendPasswordReset` và `setUserPassword` gọi Better Auth trước → ghi sau.
- **Hàng loạt:**
  - Xoá/khôi phục file có thể trải nhiều folder → **một dòng mỗi folder**, để sheet của từng folder vẫn đúng.
  - Thu hồi nhiều link cũng vậy.
- **Di chuyển** ghi ở **folder nguồn** (path tại lúc chuyển), meta có `from`/`to`. Owner folder đích chỉ thấy file mới xuất hiện, không thấy dòng nhật ký. Muốn cả hai bên thấy thì ghi 2 dòng; để sau nếu cần.
- **Upload:** một dòng mỗi file. `ActivityList` gộp các upload liền nhau của cùng người, cùng folder, cùng ngày thành "đã upload N file".
- **Không ghi** những thao tác ngoài enum của plan: đổi hồ sơ user, thu hồi lời mời, đăng xuất mọi phiên, đổi avatar, thumbnail. Revoke một người không còn là thành viên → không làm gì, không ghi.
- **`createdAt` đặt từ JS** (độ chính xác mili-giây), để con trỏ phân trang `(created_at, id)` khớp chính xác. Postgres `now()` có micro-giây sẽ làm lệch con trỏ.
- **Ngày / giờ:**
  - Bộ lọc ngày và nhóm "Hôm nay"/"Hôm qua" theo giờ Việt Nam (`+07:00`, `Asia/Ho_Chi_Minh`), để server render (UTC trên Vercel) và client ra cùng kết quả.
  - Giờ tương đối có `suppressHydrationWarning`.
- **Sidebar:** "Quản lý user" giờ chỉ sáng ở `/admin/users*`; thêm "Hoạt động" (`HistoryIcon`).
- **Nút "Hoạt động"** trên header folder chỉ hiện cho owner (admin là owner mọi nơi). Server vẫn kiểm `owner` trong `listActivity`.
- **Bộ lọc admin** nằm trên URL (`?actor=&group=&from=&to=`). Giá trị sai bị bỏ qua thay vì làm lỗi trang.
- **Đã chạy `pnpm db:migrate`** trên DB dev.
- **Thử trên trình duyệt:**
  - Tạo folder → xoá file → khôi phục từ thùng rác → xoá folder → xoá vĩnh viễn. Mỗi việc ra đúng một dòng ở `/admin/activity` và trong sheet của folder.
  - Dòng của folder đã xoá vĩnh viễn vẫn đọc được tên.
  - Lọc `group=folder` đúng.
  - Không có cảnh báo hydration; ở 375px không tràn ngang.
