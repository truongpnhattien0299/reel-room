# 05 — Trang release note (`/releases`)

> Khi được duyệt: bước đầu là lưu plan vào `plans/05-release-notes.md`. Làm trên nhánh `feat/release-notes` (đã tạo từ `develop`), PR vào `develop`.

## Context
Hiện chưa có nơi nào cho user biết từng phiên bản đã đổi những gì. Cần một trang tĩnh để xem phiên bản hiện tại và các phiên bản trước. Mỗi phiên bản có:
- số version;
- ngày release;
- tiêu đề;
- mô tả;
- các thay đổi, chia theo loại: Tính năng mới / Cải tiến / Sửa lỗi.

Dữ liệu viết tay trong một file TS, không lưu DB, không cần migration.

**Đã làm trước khi lên plan, giữ lại nếu plan được duyệt:**
- Tạo nhánh `feat/release-notes`.
- Nâng version trong `package.json` từ `0.1.0` lên `0.2.0`.
- Tạo `src/lib/releases.ts` với dữ liệu 2 phiên bản (mô tả ở dưới).

## Phân chia phiên bản (lấy từ lịch sử git và các PR)
- **v0.1.0 — 04/10/2026, "Ra mắt ReelRoom".** Gồm phần dựng app ban đầu và PR #1–#9:
  - share link;
  - invite;
  - SMTP;
  - skeleton/perf;
  - hiện/ẩn mật khẩu;
  - bấm ô folder trống để upload;
  - icon;
  - các fix về upload, thumbnail, tên dài, hydration.
- **v0.2.0 — 28/10/2026, "Trình xem media, hồ sơ cá nhân và quản lý link"** (phiên bản hiện tại). Gồm PR #10–#14:
  - media viewer và audio;
  - quản lý user;
  - hồ sơ cá nhân và avatar;
  - avatar ở các trang khác;
  - trang link chia sẻ.

Nội dung viết bằng tiếng Việt, theo góc nhìn người dùng, không nhắc tên hàm hay bảng DB.

## Dữ liệu: `src/lib/releases.ts`
- **Kiểu:**
  - `type ChangeKind = "feature" | "improvement" | "fix"`
  - `type Release = { version, date ("YYYY-MM-DD"), title, description, changes: { kind, text }[] }`
- **`CHANGE_KINDS`:** thứ tự hiển thị kèm nhãn tiếng Việt.
- **`RELEASES`:** xếp mới nhất trước.
- **`CURRENT_VERSION`:** import `version` từ `package.json` (tsconfig đã bật `resolveJsonModule`).
- **`releaseDate(r)`:** trả `new Date(\`${date}T12:00:00Z\`)`. Chọn 12h UTC để `formatDate` (`src/lib/format.ts`) ra cùng một ngày dù server chạy múi giờ UTC hay +07.
- **Quy ước release** ghi trong comment của file và trong AGENTS.md: PR release (develop → main) phải nâng version trong `package.json` và thêm entry vào `RELEASES`.

## UI
- **Trang `src/app/(app)/releases/{page,loading,scroll-to-hash}.tsx`** (server component; dữ liệu tĩnh, không query):
  - `PageShell` + `PageHeader`:
    - title: "Có gì mới"
    - description: "Phiên bản hiện tại v{CURRENT_VERSION} · lịch sử thay đổi của ReelRoom."
  - `metadata.title`: "Có gì mới".
  - **Danh sách release** dạng timeline dọc, mỗi release là một `<article>` dạng card (`rounded-[18px] bg-card ring-1 ring-border`, giống `TrashList`):
    - **Đầu card:**
      - version (`font-mono`), kèm badge "Hiện tại" khi `version === CURRENT_VERSION`;
      - ngày dạng `<time dateTime>` qua `formatDate`.
    - **Thân card:**
      - tiêu đề (`font-display`, h2);
      - mô tả;
      - một hàng chip đếm theo loại, chỉ hiện loại có thay đổi (vd "7 tính năng mới · 4 cải tiến · 2 sửa lỗi").
    - **Nhóm thay đổi:** mỗi loại có thay đổi được một `h3` có icon, rồi đến `<ul>`:
      - Tính năng mới: `SparklesIcon`, màu primary;
      - Cải tiến: `TrendingUpIcon`;
      - Sửa lỗi: `BugIcon`.
  - Mỗi release có `id="v0-2-0"` để dẫn link thẳng tới (`/releases#v0-2-0`).
- **Lối vào:**
  - Menu tài khoản ở chân sidebar (`src/components/app-sidebar.tsx`) thêm mục "Có gì mới" (`SparklesIcon`), đặt sau "Hồ sơ của tôi".
  - Phía phải mục này hiện `v{CURRENT_VERSION}` chữ nhỏ, màu muted.
  - Không thêm mục vào menu chính, để sidebar gọn.
- **`loading.tsx`:** dùng `PageSkeleton variant="rows"`. Skeleton stream trước nên trình duyệt không tự cuộn tới `#v…`; component client `ScrollToHash` cuộn lại sau khi render.

## Files
- **Mới:**
  - `src/lib/releases.ts` (đã có)
  - `src/app/(app)/releases/{page,loading,scroll-to-hash}.tsx`
  - `plans/05-release-notes.md`
- **Sửa:**
  - `package.json` (version, đã sửa)
  - `src/components/app-sidebar.tsx`
  - `AGENTS.md` (quy ước release)
- **Tái dùng:**
  - `PageShell`, `PageHeader` (`src/components/page-header.tsx`)
  - `Badge`
  - `formatDate`
  - `PageSkeleton`

## Verification
- Chạy `pnpm typecheck && pnpm lint && pnpm build` (Node 22).
- `preview_start`, mở `/releases`:
  - v0.2.0 nằm trên cùng, có badge "Hiện tại";
  - ngày hiện đúng 28/10/2026 và 04/10/2026;
  - số đếm trên chip khớp với số mục trong từng nhóm;
  - `/releases#v0-1-0` cuộn tới đúng phiên bản.
- Menu tài khoản có mục "Có gì mới · v0.2.0", bấm vào thì tới trang.
- Ở bề rộng 375px không bị tràn ngang; console không có lỗi.
