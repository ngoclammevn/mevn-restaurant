# Setup và triển khai độc lập

[Mục lục](../README.md) · [Kiến trúc](README.md) · [Bảo mật](../security/README.md) · [Worker](../../ai-worker/README.md)

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

Mọi biến `VITE_*` đều được người dùng đọc được trong bundle. Không đặt token dài hạn hay secret vào đây. Dùng Node 22.18+ hoặc 24.11+ theo `package.json`; sao chép `.env.example` sang file env local bị Git ignore, điền giá trị của đúng môi trường rồi chạy từ root:

```sh
rtk proxy npm ci
rtk proxy npm run dev
```

Vercel dùng Vite, build `npm run build`, output `dist`, cùng [`vercel.json`](../../vercel.json). Root package và Worker package có lockfile riêng. Cấu hình các biến frontend trên môi trường Vercel tương ứng, rồi build/deploy khi đến bước phát hành. Đổi biến frontend cần rebuild.

Các API Vercel hiện hữu (OCR/share/OG) vẫn theo cấu hình riêng trong `api/`. `GEMINI_API_KEY` hiện chỉ dành cho OCR phía server; không thêm prefix `VITE_`, không dùng nó cho AI Worker. Xem giới hạn bảo mật endpoint cũ ở [security](../security/README.md#giới-hạn-và-cấu-hình-chưa-kiểm-chứng).

## 3. Worker / Cloudflare

Chạy từ `ai-worker/` trong repository với Node 22+; Worker cần import `../shared/feedback.js` khi bundle.

```sh
rtk proxy npm ci
rtk proxy cp .dev.vars.example .dev.vars
rtk proxy cp wrangler.jsonc wrangler.owner.jsonc
```

Điền bốn giá trị không bí mật vào cấu hình local/owner: `CLERK_ISSUER`, `ALLOWED_ORIGINS`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Issuer/Supabase URL là origin HTTPS chính xác, không path/trailing slash. Origins là danh sách tách dấu phẩy; không wildcard, tối đa 20 origin duy nhất; HTTP chỉ chấp nhận loopback localhost cho dev. Dùng modern `sb_publishable_…`, Worker chủ động từ chối secret và legacy JWT key.

Owner điền `account_id` trong `wrangler.owner.jsonc` bị ignore và xác nhận hai `namespace_id` rate limiter khác nhau, duy nhất trong tài khoản. `1001`/`1002` trong repo chỉ là ví dụ. Không tự đoán tài khoản/domain. Không đưa credential đăng nhập Cloudflare vào repo.

Kiểm thử cuối và kiểm tra bundle (không gọi inference thật):

```sh
rtk proxy npm test
rtk proxy npm run typecheck
rtk proxy npm run dry-run
```

Khi đã đến bước phát hành, owner đăng nhập và deploy cấu hình đã xem lại:

```sh
rtk proxy npx wrangler login
rtk proxy npx wrangler types --config wrangler.owner.jsonc --strict-vars=false
rtk proxy npx wrangler deploy --config wrangler.owner.jsonc
```

Worker và Vercel triển khai độc lập. Lấy URL Worker vào `VITE_AI_API_BASE_URL`, cho phép đúng origin app trong Worker rồi rebuild Vue. Với preview, thêm từng origin cần thiết; không dùng wildcard `*.vercel.app`. Không để localhost trong allowlist production nếu không cần.

## 4. Xác minh sau phát hành

- `/health` trả phiên bản; sau đó dùng phiên thật kiểm một đơn của mình và một đơn của người khác (phải bị từ chối).
- Hai tài khoản kiểm đặt hộ, tự trả, chốt/mở lại, review từ đúng ngày VN; đối chiếu RLS trên DB thực tế.
- Kiểm bản build không chứa service-role, Clerk secret hoặc JWT người dùng; token không nằm trong URL/log.
- Kiểm inference/fallback trên Workers Free, cả CPU thực tế và quota; rate limit là theo location, không phải sổ quota toàn cầu.

Chưa cấu hình Worker hoặc tắt URL AI chỉ làm mất gợi ý từ model; người dùng vẫn chọn nhãn dự phòng/ghi chú và lưu qua Supabase. Nếu rollback frontend/Worker, giữ migration cho đến khi đã xem xét tính tương thích dữ liệu; không drop catalog/reviews để rollback giao diện.
