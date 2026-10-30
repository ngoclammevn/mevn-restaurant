# Cấu hình môi trường và Deploy

[Mục lục](../README.md) · [Kiến trúc](README.md) · [Bảo mật](../security/README.md) · [Worker](../../ai-worker/README.md)

Hướng dẫn này dùng lệnh CLI thông thường. Với đợt cập nhật chồng lên main đang chạy production, làm theo [runbook backup và phát hành](../operations/2026-10-29-main-rollout.md) trước khi merge: giữ database/ảnh cũ, backup code + DB + Storage, restore thử và chỉ áp migration còn thiếu.

Hướng dẫn này thay thế phần setup/deploy trong tài liệu cũ. Các bước dưới là công việc vận hành cần thực hiện trên tài khoản đúng; việc có file cấu hình trong repo không chứng minh production đã cấu hình. Giữ các dịch vụ trong free tier, không bật billing để xử lý hết quota AI.

## 1. Clerk và Supabase

1. Dùng Clerk Google OAuth của app. Bật tích hợp Supabase native trong Clerk và thêm chính Clerk issuer vào Third-Party Auth của Supabase. Dùng session token từ `session.getToken()`; không tạo JWT template `supabase` kiểu cũ.
2. Xác minh issuer môi trường frontend trùng Worker và cấu hình third-party auth của Supabase. Token tích hợp Supabase cần role `authenticated` để DB áp dụng đúng policy. Worker chỉ xác minh token/API; không thêm bước auth cho người dùng.
3. Đối chiếu migration đã áp dụng với [`supabase/migrations/`](../../supabase/migrations/). Database mới cần toàn bộ chuỗi migration theo thứ tự; database hiện có chỉ áp dụng phần thiếu sau khi kiểm tra history và sao lưu thích hợp. Không giả định `0001`–`0004` đã chạy.
4. Xác minh RLS bằng hai tài khoản trên database thử nghiệm: A đặt hộ B được, A không trả/đánh giá hộ B, B tự trả được cả sau khi chốt; anonymous không đọc catalog/review mới. Không dùng câu lệnh xóa toàn bộ bảng để dọn test.

Không cần Supabase service-role/secret key hoặc Clerk secret. [Tài liệu native Clerk integration](https://supabase.com/docs/guides/auth/third-party/clerk) là nguồn cấu hình nhà cung cấp.

## 2. App Vue / Vercel

| Biến frontend | Giá trị |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Public key đúng Clerk instance |
| `VITE_SUPABASE_URL` | Project URL HTTPS |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public key Supabase |
| `VITE_AI_API_BASE_URL` | Origin HTTPS của Worker; để trống dùng nhãn dự phòng |

Người dùng có thể đọc mọi biến `VITE_*` trong bundle. Không đặt token dài hạn hay secret vào đây. Dùng Node 22.18+ hoặc 24.11+ theo `package.json`; sao chép `.env.example` sang file env local mà Git ignore, điền giá trị của đúng môi trường rồi chạy từ root:

```sh
npm ci
npm run dev
```

Vercel dùng Vite, build `npm run build`, output `dist`, cùng [`vercel.json`](../../vercel.json). Root package và Worker package có lockfile riêng. Cấu hình các biến frontend trên môi trường Vercel tương ứng, rồi build/deploy khi đến bước phát hành. Đổi biến frontend cần rebuild.

Các API Vercel hiện có (OCR/share/OG) vẫn theo cấu hình riêng trong `api/`. `GEMINI_API_KEY` hiện chỉ dành cho OCR phía server; không thêm prefix `VITE_`, không dùng nó cho AI Worker. Xem giới hạn bảo mật endpoint cũ ở [security](../security/README.md#giới-hạn-và-cấu-hình-chưa-kiểm-chứng).

## 3. Một Worker chung AI + Slack, thao tác bằng Wrangler CLI

Cài Git, Node.js 22.18+ và npm trên máy. Mở terminal tại repository, rồi chạy:

```sh
cd ai-worker
npm ci
npx wrangler --version
npx wrangler login
npx wrangler whoami
```

`npm ci` cài Wrangler đúng lockfile; không cần cài global hay nâng `latest`. `login` mở trình duyệt để đăng nhập Cloudflare; `whoami` giúp đối chiếu đúng account. Giữ thư mục `shared/` trong repo khi bundle. [Wrangler trong project](https://developers.cloudflare.com/workers/wrangler/install-and-update/) · [Đăng nhập CLI](https://developers.cloudflare.com/workers/wrangler/commands/general/)

Chỉ lần đầu khi file chưa có, copy cấu hình mẫu tại `ai-worker/`:

```sh
cp wrangler.jsonc wrangler.owner.jsonc
```

Windows PowerShell dùng `Copy-Item wrangler.jsonc wrangler.owner.jsonc`. Git ignore file cấu hình riêng; kiểm bằng `git check-ignore wrangler.owner.jsonc`. Không ghi đè file owner đang dùng bằng file mẫu.

Mở file owner, đặt `account_id` và `name` đúng Worker đang chạy, không đặt tên mới. Điền đủ `CLERK_ISSUER`, `ALLOWED_ORIGINS`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` và năm vars Slack trong [bảng env của runbook](../operations/2026-10-29-main-rollout.md#2-môi-trường-và-từng-biếnkey-đặt-ở-đâu). Issuer/URL là origin HTTPS chính xác; Supabase key dạng `sb_publishable_…`. Giữ binding `AI` và **bốn limiter namespace IDs khác nhau**: `USER_RATE_LIMITER`, `SERVICE_RATE_LIMITER`, `SLACK_USER_RATE_LIMITER`, `SLACK_SERVICE_RATE_LIMITER`. `1001`–`1004` chỉ là ví dụ, người Deploy phải kiểm không trùng trong account; không cần tạo KV namespace.

Dùng một Worker đang chạy trên Free cho cả AI + Slack; không thêm hạ tầng. Slack App chỉ cần bot scopes `chat:write`, `users:read`, thêm bot vào hai kênh đã chọn. Production chỉ cho origin production chính xác; preview dùng mock/local/tài nguyên thử, không tự cho gửi vào Slack production.

Ghi version active cũ từ Worker Deployments để rollback và kiểm bundle:

```sh
npx wrangler versions list --config wrangler.owner.jsonc
npx wrangler deploy --dry-run --config wrangler.owner.jsonc
```

**Sau backup/restore thử, đối chiếu migration, dependency gate và xác nhận cửa sổ phát hành**, nhập từng secret qua prompt, rồi deploy:

```sh
npx wrangler secret put SLACK_BOT_TOKEN --config wrangler.owner.jsonc
npx wrangler secret put SLACK_RECEIPT_SIGNING_KEY --config wrangler.owner.jsonc
npx wrangler deploy --config wrangler.owner.jsonc
```

`secret put` là thay đổi thật, có thể deploy version ngay. Nếu secret đang đúng, không đặt lại; đặc biệt giữ receipt key cũ để đọc receipts/cancel lịch. Không gõ giá trị token vào command, không lưu ở `vars` hoặc `VITE_*`. CLI không trả lại plaintext secret đã lưu. Điền đủ vars không bí mật trong file cấu hình riêng; `--keep-vars` chỉ phù hợp khi đã kiểm Dashboard vars và không còn vars rỗng ghi đè. [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

Lấy origin HTTPS `workers.dev` thực tế CLI in sau deploy, đặt vào Vercel Production `VITE_AI_API_BASE_URL`, không thêm `/v1`; build lại Vue. AI + Slack dùng cùng URL. Dry-run/health không chứng minh E2E; kiểm hai tài khoản, quyền DB/Storage và một tin được phép trong kênh đã chọn theo runbook trước mở sử dụng.

Nếu lỗi, tại `ai-worker/` chạy `npx wrangler rollback <version-id-đã-ghi> --config wrangler.owner.jsonc`, thay placeholder bằng version active cũ. Rollback code không xóa dữ liệu hoặc hủy lịch Slack; xem [kế hoạch rollback đầy đủ](../operations/2026-10-29-main-rollout.md#8-rollback-không-làm-mất-dữ-liệu-mới). Không drop bảng hoặc restore snapshot cũ đè live để rollback giao diện.

## 4. Kiểm tra sau Deploy

- `/health` trả phiên bản; sau đó dùng phiên thật kiểm một đơn của mình và một đơn của người khác (phải bị từ chối).
- Hai tài khoản kiểm đặt hộ, tự trả, chốt/mở lại, review từ đúng ngày VN; đối chiếu RLS trên DB thực tế.
- Kiểm bản build không chứa service-role, Clerk secret hoặc JWT người dùng; token không nằm trong URL/log.
- Kiểm inference/fallback trên Workers Free, cả CPU thực tế và quota; rate limit là theo location, không phải sổ quota toàn cầu.

Chưa cấu hình Worker hoặc tắt URL AI chỉ làm mất gợi ý từ model; người dùng vẫn chọn nhãn dự phòng/ghi chú và lưu qua Supabase. Nếu rollback frontend/Worker, giữ migration cho đến khi đã xem xét tính tương thích dữ liệu; không drop catalog/reviews để rollback giao diện.
