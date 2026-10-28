# 13 — Link chia sẻ: mật khẩu, tắt tải về, đếm lượt xem

> Nhánh `feat/share-link-options` từ `develop`, PR vào `develop`. Nên làm sau plan 09 (để tuỳ chọn "tắt tải về" chặn cả tải zip).

## Context
Link chia sẻ hiện chỉ có token và hạn dùng. Ai có link là xem và tải được hết, và người tạo không biết link đã được mở hay chưa. Ba tuỳ chọn thêm:
1. **Mật khẩu** (tuỳ chọn).
2. **Cho phép tải về** (mặc định bật).
3. **Thống kê:** số lượt xem, lượt xem gần nhất, số lượt tải.

## Schema (migration mới, thêm cột vào `share_links`)
```ts
passwordHash: text("password_hash"),               // null: không có mật khẩu
allowDownload: boolean("allow_download").notNull().default(true),
viewCount: integer("view_count").notNull().default(0),
downloadCount: integer("download_count").notNull().default(0),
lastViewedAt: timestamp("last_viewed_at"),
failedAttempts: integer("failed_attempts").notNull().default(0),
lockedUntil: timestamp("locked_until"),
```

## Mật khẩu
- **Băm:** `scrypt` của `node:crypto` (salt ngẫu nhiên 16 byte, lưu `salt:hash` base64). So sánh bằng `timingSafeEqual`. Mật khẩu 4–128 ký tự.
- **Mở khoá:** server action `unlockShareLink(token, password)`:
  - Sai → tăng `failedAttempts`; sai 10 lần liên tiếp → `lockedUntil = now + 15 phút` (báo "Thử lại sau 15 phút"). Đúng → reset về 0.
  - Đúng → đặt cookie `rr_link_<linkId>` = HMAC-SHA256(`BETTER_AUTH_SECRET`, `linkId + passwordHash`), `httpOnly`, `secure`, `sameSite=lax`, `path=/`, hết hạn 7 ngày (hoặc sớm hơn nếu link hết hạn trước).
  - Vì HMAC có `passwordHash`, **đổi mật khẩu là mọi cookie cũ mất hiệu lực**.
- **Kiểm tra:** `resolveShareLink` thêm trạng thái `{ status: "locked", linkId }` khi link có mật khẩu mà cookie không hợp lệ. Đọc cookie bằng `cookies()` của `next/headers`.
  - Trang `/s/[token]`: trạng thái `locked` → hiện form nhập mật khẩu (giữ header logo như trang link hết hạn).
  - Mọi route `/api/s/[token]/...` (content, thumb, downloads): `locked` → 404, giống link không hợp lệ.
- Nhược điểm biết trước: khoá 15 phút áp cho cả link, nên người đoán mò có thể làm người nhận thật bị chặn tạm thời. Chấp nhận được với app nội bộ; ghi trong comment.

## Tắt tải về
- `allowDownload = false`:
  - Trang công khai ẩn mọi nút tải (từng file, chọn nhiều, "Tải tất cả").
  - `/api/s/[token]/files/[id]/content?download=1` → 403; route zip công khai (plan 09) → 403.
- Ghi rõ trong UI: "Người xem vẫn có thể lưu ảnh khi đang xem; tuỳ chọn này chỉ ẩn nút tải."

## Đếm lượt xem
- Server component không đặt được cookie, nên dùng beacon phía client:
  - Component nhỏ `<ViewBeacon token>` trên trang `/s/[token]` gọi `POST /api/s/[token]/view` một lần khi mở trang.
  - Route: nếu chưa có cookie `rr_seen_<linkId>` → `view_count + 1`, `last_viewed_at = now()`, rồi đặt cookie 24 giờ. Mỗi người xem tính tối đa một lượt mỗi ngày.
  - Không đếm khi người xem là thành viên đã đăng nhập có quyền ở folder (tránh tự đếm khi người tạo kiểm tra link).
- Tải: route content tăng `download_count` khi có `?download=1`; route zip tăng 1 mỗi lần tải zip.

## Server
- Gộp `updateShareLinkExpiry` thành `updateShareLink(id, { expiresAt?, password?: string | null, allowDownload? })`, giữ kiểm tra `requireLinkManager` hiện có. `password: null` = gỡ mật khẩu.
- `createShareLink` nhận thêm `password?` và `allowDownload?`.
- `listAllShareLinks` / `listShareLinks` trả thêm `hasPassword` (không bao giờ trả hash), `allowDownload`, `viewCount`, `downloadCount`, `lastViewedAt`.

## UI
- **Dialog tạo link** (`src/components/folders/share-links.tsx`): phần "Tuỳ chọn" thu gọn, gồm ô mật khẩu (dùng `PasswordInput` có sẵn) và công tắc "Cho phép tải về". Thêm component `Switch` của shadcn (base-nova).
- **Trang `/links`** (`share-link-list.tsx`):
  - Dòng phụ thêm: biểu tượng khoá nếu có mật khẩu, badge "Không cho tải", "42 lượt xem · mở gần nhất 2 giờ trước · 5 lượt tải".
  - Menu "…" thêm "Đặt mật khẩu" / "Đổi mật khẩu" / "Gỡ mật khẩu" và "Bật/Tắt tải về". `ExpiryDialog` mở rộng thành `LinkSettingsDialog`.
- Danh sách link trong dialog Chia sẻ của folder: hiện cùng các biểu tượng.

## Test
- Băm và kiểm mật khẩu; cookie HMAC hết hiệu lực sau khi đổi mật khẩu.
- `resolveShareLink` trả `locked` khi thiếu cookie, `ok` khi cookie đúng.
- Khoá sau 10 lần sai; hết khoá sau 15 phút (giả lập thời gian bằng `vi.setSystemTime`).
- Route content trả 403 cho `?download=1` khi `allowDownload = false`.

## Files
- **Mới:** migration, `src/server/link-password.ts`, `src/app/api/s/[token]/view/route.ts`, `src/components/share/{password-gate,view-beacon}.tsx`, `src/components/ui/switch.tsx`, `src/components/links/link-settings-dialog.tsx`, test.
- **Sửa:** `src/db/schema.ts`, `src/server/{share-links,actions}.ts`, `src/app/s/[token]/page.tsx`, các route `src/app/api/s/[token]/**`, `src/components/folders/share-links.tsx`, `src/components/links/{share-link-list,expiry-dialog}.tsx`.

## Verification
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; `pnpm db:migrate`.
- Cửa sổ ẩn danh: link có mật khẩu → hiện form; sai → báo lỗi; đúng → vào được, tải lại trang không phải nhập lại. Đổi mật khẩu ở `/links` → cửa sổ ẩn danh bị hỏi lại.
- Gọi thẳng URL ảnh `/api/s/<token>/files/<id>/content` khi chưa mở khoá → 404.
- Tắt tải về → không còn nút tải; gọi `?download=1` → 403.
- Mở link ẩn danh 2 lần trong ngày → lượt xem tăng 1.
