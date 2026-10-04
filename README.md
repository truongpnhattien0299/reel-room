# ReelRoom

Thư viện ảnh/video nội bộ có folder và phân quyền theo folder.

**Stack:** Next.js 16 (App Router) · shadcn/ui (Base UI) · Better Auth (email + password) · Drizzle + Neon Postgres · Cloudflare R2 · Uppy (core + `@uppy/aws-s3`, không dùng UI của Uppy).

## Kiến trúc upload

```
Browser ── POST /api/uploads ───────────────▶ Next.js   (đăng ký file, kiểm tra quyền editor,
   │                                                     trả về object key `files/<id>`)
   │ ── POST /api/uploads/sign (mỗi request) ▶ Next.js   (chỉ ký key của file user đang upload)
   │ ── PUT/POST trực tiếp bằng presigned URL ─────────▶ R2   (multipart 16MB/part, file > 100MB)
   │ ── PUT thumbnail WebP (tạo bằng canvas) ──────────▶ R2   (`thumbs/<id>.webp`)
   └─ POST /api/uploads/<id>/complete ──────▶ Next.js   (HEAD object trên R2, khớp size → `ready`)
```

File không bao giờ đi qua server Next.js, nên không vướng giới hạn body 4.5MB của Vercel. Xem và tải file qua `/api/files/<id>/content` (kiểm tra quyền xong thì redirect 302 tới URL ký sẵn, sống 1 giờ).

## Phân quyền

- `admin` (role của Better Auth): toàn quyền, quản lý user ở `/admin/users`.
- Mời user: admin nhập email + vai trò, nhận **link mời** `/invite/<token>` (hiện ngay trong dialog, đồng thời gửi email nếu đã cấu hình Resend). Người được mời mở link, tự nhập tên và mật khẩu để tạo tài khoản rồi được đăng nhập luôn. Link dùng một lần, hết hạn sau 7 ngày; admin sao chép lại, tạo link mới hoặc thu hồi trong mục "Lời mời đang chờ".
- Quyền theo folder: `viewer` < `editor` < `owner`. Cấp ở một folder thì áp dụng cho toàn bộ cây con. Quyền thực tế là quyền **cao nhất** được cấp ở folder đó hoặc ở bất kỳ folder cha nào.
- Ai cũng tạo được folder gốc và trở thành `owner` của nó.
- `editor`: upload, tạo folder con, đổi tên, xoá, tạo link chia sẻ. `owner`: thêm quyền chia sẻ, và xoá được folder gốc.
- Xoá là xoá mềm (`deleted_at`), chưa có UI thùng rác.

## Link chia sẻ công khai

- Ai có link `/s/<token>` đều xem và tải được, không cần đăng nhập. Link trỏ tới **cả folder** (gồm cây con) hoặc **các file đã chọn** trong một folder.
- Thời hạn: 1/7/30 ngày, ngày tuỳ chọn (tối đa 365 ngày) hoặc không hết hạn.
- Link ngừng hoạt động khi hết hạn, bị thu hồi (người tạo hoặc owner), folder vào thùng rác, hoặc người tạo mất quyền `editor` trên folder.
- File được phục vụ qua `/api/s/<token>/files/<id>/{content,thumb}` (cùng cơ chế redirect 302 tới URL ký sẵn). Cron dọn link đã hết hạn quá 30 ngày.

## Setup

Yêu cầu Node ≥ 22.13 (`nvm use`) và pnpm.

### 1. Neon Postgres
Tạo project ở [neon.tech](https://neon.tech), copy connection string vào `DATABASE_URL`.

### 2. Cloudflare R2
1. Tạo bucket (vd. `reelroom`), **để private** (không bật public access).
2. R2 → *Manage API tokens* → tạo token quyền **Object Read & Write** cho bucket này. Lấy `Account ID`, `Access Key ID`, `Secret Access Key`.
3. Bucket → *Settings* → **CORS policy**:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://your-domain.com"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
       "AllowedHeaders": ["content-type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   Thiếu `ExposeHeaders: ETag` thì multipart upload sẽ fail.
4. Bucket → *Settings* → **Object lifecycle rules** → thêm rule *Abort incomplete multipart uploads* sau **1 ngày**, để dọn các part của upload bỏ dở.

### 3. Env và database
```bash
cp .env.example .env.local   # điền giá trị thật
pnpm install
pnpm db:migrate              # tạo bảng
pnpm create-admin you@company.com "Tên Bạn"
pnpm dev
```

Nếu chưa có `RESEND_API_KEY`, email mời và reset mật khẩu sẽ được **in ra console** của dev server. Link mời vẫn hiện trong dialog để gửi tay.

### Email (Resend)
1. Tạo tài khoản ở [resend.com](https://resend.com) → *Domains* → *Add Domain*, nên dùng subdomain riêng (vd. `mail.your-domain.com`).
2. Thêm các bản ghi DNS Resend đưa ra (MX + TXT SPF cho `send.…`, TXT DKIM `resend._domainkey.…`, tuỳ chọn DMARC) ở nơi quản lý DNS, chờ trạng thái **Verified**.
3. *API Keys* → *Create API Key*, quyền **Sending access**, giới hạn theo domain vừa thêm → điền `RESEND_API_KEY`.
4. `EMAIL_FROM="ReelRoom <noreply@mail.your-domain.com>"`: địa chỉ phải thuộc domain đã verify.
5. Chưa có domain: dùng tạm `onboarding@resend.dev`, nhưng chỉ gửi được tới email của chính tài khoản Resend.

### 4. Deploy lên Vercel
- Import repo và set toàn bộ env trong `.env.example`. `BETTER_AUTH_URL` là domain production.
- Migration chạy tự động khi deploy **Production**: Vercel dùng script `vercel-build` (`drizzle-kit migrate` rồi `next build`); migration lỗi thì build fail, bản cũ vẫn chạy. Preview không migrate. Nếu đã đặt *Build Command* riêng trong Vercel thì xoá đi để Vercel dùng script này.
- `CRON_SECRET`: Vercel tự gửi header này cho cron `/api/cron/cleanup` (chạy hằng ngày, xoá các upload không hoàn tất sau 24 giờ, link chia sẻ và lời mời hết hạn quá 30 ngày).
- Thêm domain production vào CORS của R2.
- Gói Hobby của Vercel không cho dùng thương mại, công ty phải dùng gói Pro.

## Scripts

| Lệnh | Việc |
|---|---|
| `pnpm dev` / `build` | Next.js |
| `pnpm typecheck` / `lint` | Kiểm tra |
| `pnpm db:generate` | Sinh migration sau khi sửa `src/db/schema.ts` |
| `pnpm db:migrate` / `db:studio` | Áp migration / xem DB |
| `pnpm create-admin <email> "<tên>"` | Tạo admin đầu tiên, hoặc nâng user có sẵn lên admin |

## Cấu trúc

```
src/
  app/(app)/            trang cần đăng nhập: /, /f/[folderId], /admin/users
  app/invite/[token]/   tạo tài khoản từ link mời (công khai)
  app/api/uploads/      đăng ký, ký request R2, hoàn tất, huỷ upload
  app/api/files/        redirect tới file gốc / thumbnail đã ký
  components/upload/    UploadProvider (Uppy), dropzone, panel tiến trình, tạo thumbnail
  components/folders/   grid, menu, dialog đổi tên/chia sẻ/xoá, xem media
  db/schema.ts          bảng của Better Auth + folders, files, folder_permissions
  server/               permissions, queries, server actions (mọi thao tác đều kiểm tra quyền)
  proxy.ts              redirect sang /login khi chưa có cookie session
```

## Chưa làm (bước tiếp theo)

- Thùng rác: khôi phục, và xoá hẳn trên R2 (cron purge file đã xoá quá N ngày).
- Di chuyển file/folder (đổi prefix `path` của cả cây con).
- Cây folder trong sidebar (hiện chỉ hiện folder gốc).
- Quên mật khẩu tự phục vụ (hiện admin bấm "Gửi lại lời mời").
- Tìm kiếm, sắp xếp, chế độ xem dạng bảng.
