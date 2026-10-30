# Một Cloudflare Worker cho AI và Slack

Worker này gợi ý cảm nhận món ăn và gửi thông báo Slack cho app đặt cơm. Vue tiếp tục chạy trên Vercel; dữ liệu nghiệp vụ đi qua Supabase RLS bằng token Clerk của người dùng. Worker không lưu đánh giá hoặc số sao thay người dùng.

Deploy từ `ai-worker/` bên trong repo vì code còn import `../shared/feedback.js`. Không copy riêng thư mục Worker ra chỗ khác.

Đợt nâng cấp này Merge lên `main` đang chạy. Đọc [hướng dẫn backup, Migration, Deploy và Rollback](../docs/operations/2026-10-29-main-rollout.md) trước khi thay đổi Production. Giữ một Worker trên gói Free cho cả AI + Slack.

## Cài công cụ và chạy local

Cài Git và Node.js 22.18+; npm đi kèm Node. Mở Terminal tại root repo:

```sh
node --version
npm --version
git --version
cd ai-worker
npm ci
npx wrangler --version
```

`npm ci` cài Wrangler theo lockfile của package, hiện là 4.147.0. Không cần cài Wrangler toàn máy. Nếu `npx` hỏi tải thêm Wrangler, kiểm lại thư mục và kết quả `npm ci` trước; không nâng lên `latest` giữa đợt Deploy.

Chỉ để chạy local, copy `.dev.vars.example` sang `.dev.vars` khi file chưa tồn tại, rồi điền cấu hình local/test:

```sh
cp .dev.vars.example .dev.vars
npm run dev
```

PowerShell dùng `Copy-Item .dev.vars.example .dev.vars`. Git ignore `.dev.vars`; không ghi đè file local đang dùng. Workers AI vẫn gọi Cloudflare khi chạy local và tiêu thụ quota của account. Test offline dùng mock cho inference, JWKS và REST. Local/Preview dùng dữ liệu và kênh thử riêng.

## Deploy bằng Wrangler CLI

Hoàn tất backup code + Database + toàn bộ file Storage, restore thử và đối chiếu Migration trước. Dùng lại Database/Storage và Worker của app hiện tại. [Cài và chạy Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/).

1. Tại `ai-worker/`, đăng nhập account đang chứa Worker:

   ```sh
   npx wrangler login
   npx wrangler whoami
   ```

   `login` mở trình duyệt; đối chiếu account ID từ `whoami`. Không đặt Cloudflare token vào command hoặc repo. [Đăng nhập CLI](https://developers.cloudflare.com/workers/wrangler/commands/general/).

2. Chỉ khi chưa có `wrangler.owner.jsonc`, copy cấu hình mẫu:

   ```sh
   cp wrangler.jsonc wrangler.owner.jsonc
   git check-ignore wrangler.owner.jsonc
   ```

   PowerShell dùng `Copy-Item wrangler.jsonc wrangler.owner.jsonc`. Nếu file đã có cấu hình, giữ bản đó và sửa phần cần đổi. Điền `name` đúng Worker đang chạy, `account_id`, chín vars trong bảng dưới và bốn limiter namespace IDs khác nhau. Giữ binding `AI`.

3. Ghi version đang chạy từ Cloudflare → Worker → Deployments, rồi kiểm bundle:

   ```sh
   npx wrangler versions list --config wrangler.owner.jsonc
   npx wrangler deploy --dry-run --config wrangler.owner.jsonc
   ```

   Dry-run không upload code và chưa kiểm quyền truy cập Slack/Database thật. Điền đủ config trước khi Deploy. `--keep-vars` không ngăn vars trong file ghi đè giá trị trên Dashboard.

4. Trong khoảng thời gian Deploy đã thống nhất, nhập hai secret qua prompt nếu còn thiếu hoặc cần đổi:

   ```sh
   npx wrangler secret put SLACK_BOT_TOKEN --config wrangler.owner.jsonc
   npx wrangler secret put SLACK_RECEIPT_SIGNING_KEY --config wrangler.owner.jsonc
   ```

   `secret put` thay đổi Worker thật và có thể Deploy ngay. Giữ secret hiện tại nếu vẫn đúng, nhất là receipt signing key: đổi key làm receipt cũ mất xác thực. CLI không đọc lại giá trị secret dạng plaintext. Giữ bản gốc trong password manager; không đặt secret vào command arguments, `vars`, `VITE_*`, Log hoặc Git. [Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/).

5. Deploy vào cùng Worker:

   ```sh
   npx wrangler deploy --config wrangler.owner.jsonc
   ```

   Ghi version và URL HTTPS `workers.dev` từ output. Đặt origin đó vào Vercel **Production** `VITE_AI_API_BASE_URL`, không thêm `/v1` hoặc dấu `/` cuối, rồi Build/Deploy lại frontend. AI và Slack cùng dùng URL này. `GEMINI_API_KEY` tiếp tục nằm phía server Vercel cho OCR hiện có.

6. Nếu cần Rollback, thay `PREVIOUS_VERSION_ID` bằng version cũ đã ghi:

   ```sh
   npx wrangler rollback PREVIOUS_VERSION_ID --config wrangler.owner.jsonc
   ```

   Rollback code không phục hồi Database/Storage hoặc hủy lịch Slack. Kiểm các đơn/thanh toán mới và lịch nhắc theo [runbook](../docs/operations/2026-10-29-main-rollout.md#8-rollback-không-làm-mất-dữ-liệu-mới). [Worker Rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

## Cấu hình và key

Giữ Workers Free; không bật billing khi hết quota. Worker dùng token Clerk hiện tại, không cần API key riêng cho người dùng, Supabase `service_role`/secret hoặc Clerk secret. Các giá trị rỗng trong file mẫu khiến Worker từ chối request.

| Var không bí mật | Giá trị |
| --- | --- |
| `CLERK_ISSUER` | Origin HTTPS của Clerk đang dùng; không thêm path hoặc dấu `/` cuối |
| `ALLOWED_ORIGINS` | Các origin chính xác, cách nhau bằng dấu phẩy; HTTPS ở Production. Local có thể dùng localhost HTTP. Không wildcard, path hoặc dấu `/` cuối |
| `SUPABASE_URL` | Origin HTTPS đúng project frontend |
| `SUPABASE_PUBLISHABLE_KEY` | Key public dạng `sb_publishable_…`; Worker từ chối key JWT kiểu cũ |
| `SLACK_WORKSPACE_ID` | ID workspace dạng `T…` |
| `SLACK_ORDER_CHANNEL_ID` | ID kênh đặt cơm dạng `C…` |
| `SLACK_GENERAL_CHANNEL_ID` | ID kênh chung dạng `C…` |
| `APP_PUBLIC_BASE_URL` | Origin HTTPS của website Production để tạo link menu |
| `SLACK_NAMESPACE` | Tên môi trường ổn định, dùng chữ thường theo mẫu trong config |

Hai Worker Secrets là `SLACK_BOT_TOKEN` và `SLACK_RECEIPT_SIGNING_KEY`. Receipt key cần ngẫu nhiên, ít nhất 32 ký tự. Local có thể đặt chúng trong `.dev.vars` mà Git ignore; tuyệt đối không đưa vào biến Vite.

Chọn **bốn limiter namespace IDs khác nhau**, không trùng limiter khác trong Cloudflare account. `1001`–`1004` trong repo chỉ là ví dụ, chưa phản ánh cấu hình account thật:

| Binding | Giới hạn mỗi phút |
| --- | --- |
| `USER_RATE_LIMITER` | AI: 10 request/người |
| `SERVICE_RATE_LIMITER` | AI: 60 request/service |
| `SLACK_USER_RATE_LIMITER` | Slack: 20 request/người |
| `SLACK_SERVICE_RATE_LIMITER` | Slack: 60 request/service |

Limiter đếm theo Cloudflare location và có độ trễ đồng bộ; nó không thay cho quota toàn account. Namespace IDs trùng có thể dùng chung counter giữa các Workers. Không cần tạo KV namespace. [Rate limiting bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

Slack App cần bot scopes `chat:write`, `users:read`; thêm bot vào cả hai kênh. Không cần Events subscription, inbound webhook, cron, KV, D1, Queue hay Worker thứ hai. Thiếu cấu hình Slack không tắt AI; AI hết quota không chặn gửi Slack.

## API gợi ý cảm nhận

`GET /health` trả `{"version":"1"}`. `POST /v1/feedback-suggestions` cần token Clerk trong `Authorization: Bearer <token>` và `Origin` nằm trong allowlist.

Payload:

```json
{"order_id":"11111111-1111-4111-8111-111111111111","order_item_ids":["22222222-2222-4222-8222-222222222222"],"locale":"vi"}
```

Response:

```json
{"version":"1","suggestions":[{"order_item_id":"22222222-2222-4222-8222-222222222222","labels":["Thịt mềm","Hơi dai","Ướp vừa","Hơi mặn"],"source":"ai"}]}
```

`source` là `fallback` khi inference lỗi, timeout, hết quota hoặc trả JSON sai. Fallback vẫn kiểm auth và quyền sở hữu. Tối đa 20 item IDs khác nhau; response giữ thứ tự input. Error response là JSON: 400 sai input, 401 sai token, 403 không đủ quyền/sai ngày/sai origin, 408 timeout đọc body, 413 body vượt 16 KiB, 429 vượt rate limit (`Retry-After: 60`), 503 thiếu cấu hình hoặc không đọc được dữ liệu.

Worker xác minh RS256 bằng JWKS public từ issuer HTTPS trong config; kiểm `exp`, `nbf`, `sub`, `azp`. `azp` phải khớp cả app origin trong allowlist và request Origin. Worker không dùng cookie. Khi đọc Supabase, Worker chuyển publishable key và cùng token người dùng. Dù cả nhóm có thể xem đơn, route này vẫn yêu cầu `orders.user_id === sub`, mọi item thuộc đúng đơn/menu và ngày menu theo giờ Việt Nam không nằm trong tương lai.

JWKS fetch không theo redirect và không gửi credential. Giới hạn body là 32 KiB, từ 1–10 keys; fetch và đọc body có timeout 3 giây riêng. Đọc JSON dạng stream mặc định có timeout body 4 giây, tách khỏi giới hạn byte. Config nhận tối đa 20 origin khác nhau và key public đúng định dạng. Đây là giới hạn từng bước; không phải timeout chung của request. Worker không thêm yêu cầu `sid`/`iat`/`role`; Supabase tiếp tục xét RLS nghiệp vụ.

## AI, Cache và quota Free

Model hiện tại là [`@cf/meta/llama-3.1-8b-instruct-fp8`](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/). Prompt chỉ chứa tên món (tối đa 120 ký tự), category (48 ký tự) và batch index tạm. Worker coi các trường này là dữ liệu không đáng tin cậy. Prompt không chứa ghi chú riêng, token, ID, tên quán hay ảnh.

Mỗi batch gợi ý hai cảm nhận tích cực và hai cảm nhận tiêu cực cho mỗi món chưa có Cache; timeout inference là 8 giây, tối đa 2.048 output tokens. Parser từ chối sai cấu trúc, thiếu/trùng index, label không an toàn/quá dài/trùng và danh sách không cân bằng. JSON đúng cấu trúc chưa chứng minh chất lượng cảm nhận.

Cache chỉ giữ labels tối đa một ngày; key dùng SHA-256 của tên/category đã chuẩn hóa, locale, prompt version và model version. Cache hit vẫn kiểm auth, rate limit và quyền sở hữu mới nhất. Worker ghi Cache qua `ctx.waitUntil`; lỗi Cache không chặn response. Cache phụ thuộc location và không bảo đảm luôn có dữ liệu. Đổi `PROMPT_VERSION` khi đổi prompt, đổi `MODEL` khi đổi model.

Theo [Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/), các mức hiện nêu trong thiết kế là 100.000 request/ngày, 10 ms CPU/request, 128 MB memory và 50 subrequests/request. Thời gian chờ AI không tính như CPU; vẫn cần đo JWT/parsing/Cache trên account Free thật trước release. [Workers AI Free](https://developers.cloudflare.com/workers-ai/platform/pricing/) có 10.000 neurons/ngày, reset lúc 00:00 UTC; hết quota thì app dùng labels dự phòng. Không tự bật billing.

Log chỉ chứa event/version/status cố định và số lượng AI/fallback; invocation logs và traces đang tắt. Không thêm headers, raw errors, prompt hoặc ghi chú riêng vào Log.

## API Slack

Các POST route `/v1/slack/*` cùng dùng `VITE_AI_API_BASE_URL`, token Clerk, Origin trong allowlist và JSON body tối đa 8 KiB. Client chỉ gửi IDs theo contract; Worker từ chối channel, người nhận, URL, số điện thoại hoặc nội dung tin tùy ý từ client.

Worker tự đọc các trường menu/người lấy cơm trong allowlist. Tin Slack không chứa ngân hàng, số điện thoại, contact snapshot, ghi chú riêng hay JWT. Image block chỉ nhận ảnh từ bucket public `menus` của đúng Supabase origin, không query hoặc fragment.

| Route sau `/v1/slack/` | Payload | Ai gọi |
| --- | --- | --- |
| `publish`, `share`, `closed`, `reopened`, `pickup-changed`, `reminder`, `sync` | `{"menu_id":"uuid"}`, có thể thêm `revision` | Người đăng menu |
| `received` | `{"menu_id":"uuid"}` | Người lấy cơm hiện tại hoặc người đăng; Database phải ghi trạng thái đã lấy trước |
| `retry` | `{"event_id":"uuid"}` | Theo quyền của event; Worker kiểm lại revision hiện tại |
| `resolve` | `{"event_id":"uuid","resolution":"sent"}` hoặc `not_sent` | Người đăng xác nhận sau khi kiểm kênh |
| `link-account` | `{"member_id":"U0123456789"}` | Tài khoản đang đăng nhập; `users.info` kiểm membership đang hoạt động |

Gửi thành công trả `{status,eventId,slackUrl?}`; liên kết trả `{status:"linked",memberId,name}`. `sync` trả các event còn chờ của namespace hiện tại cho một menu của người gọi. Publish/share dùng revision 1; close/reopen dùng closure revision; pickup/received dùng closure revision × 100000 + pickup version. Client có thể bỏ `revision` để server tự tính.

Sau ba domain Migrations, đối chiếu rồi chạy `20261029145252_lunch_slack_events.sql` nếu còn thiếu. `slack_profile_links`, `slack_daily_threads`, `slack_notifications` chỉ chứa IDs, trạng thái và receipts phục vụ gửi tin. RPC dùng SECURITY INVOKER, fixed search path; PUBLIC/anon không có quyền EXECUTE. Supabase có thể trả HTTP 204 cho RPC void; client xử lý response này mà không cố parse JSON.

Lease cấp nonce cho một sender trong 30 giây. Event đang gửi mà hết lease chuyển sang `unknown`, không tự quay về pending. Worker xác minh HMAC theo namespace, workspace, channel, menu/ngày, kind và revision trước khi dùng timestamp hoặc schedule ID đã lưu. Receipt trong Database chưa đủ chứng minh Slack đã nhận request.

| Trạng thái | Cách xử lý |
| --- | --- |
| `pending` / `retryable` | Có thể thử lại khi đến hạn; lưu Slack `Retry-After` khi gặp 429. Không tự retry request gửi tin nếu chưa chắc kết quả lần trước. |
| `sending` | Một sender đang giữ lease; lượt bấm khác chỉ đọc trạng thái. |
| `sent` | Slack đã ACK và Database đã lưu receipt có chữ ký; vẫn kiểm scope trước khi dùng lại. |
| `unknown` | Slack có thể đã nhận tin hoặc app chưa lưu xong ACK. Người đăng kiểm kênh rồi chọn đã thấy/chưa thấy. Chọn `not_sent` cho phép gửi lại và có thể trùng nếu bỏ sót tin cũ. Không hứa exactly-once khi mất ACK. |
| `cancel_pending` | Chưa hủy xong lịch có ACK; giải quyết lịch này trước khi đặt lịch mới. |
| `cancelled` | Đã hủy lịch hoặc người đăng đã xác nhận xử lý. Chọn “đã thấy tin” chỉ dừng retry, không tự tạo ACK timestamp hoặc link Slack. |

## Lịch nhắc và người xem

Client lưu `set_lunch_reminder(p_menu_id,p_at)` qua Supabase trước, rồi gọi `/v1/slack/reminder`. Giờ nhắc phải cùng ngày menu theo giờ Việt Nam và cách hiện tại ít nhất một phút. Slack giữ lịch bằng `chat.scheduleMessage`, nên vẫn gửi sau khi đóng trình duyệt. Worker không gửi `metadata` vì Slack cảnh báo trường này có thể ngăn gửi lịch. [Scheduled messages](https://docs.slack.dev/reference/methods/chat.scheduleMessage/).

Bot nhắc chung trong thread đặt cơm của ngày đó. Mọi người có quyền xem kênh đều thấy, kể cả người đã đặt; bot chưa lọc người chưa đặt hoặc gửi DM riêng. Thông báo bật lên tùy cài đặt Slack và việc theo dõi thread. Bot tag người lấy cơm trong các tin chốt, đổi người lấy hoặc xác nhận đã lấy; người đó cần liên kết Slack trước. Kiểm membership không chứng minh người nhập ID sở hữu tài khoản Slack đó qua OAuth.

Đổi/tắt lịch hoặc chốt/mở lại menu sẽ hủy lịch có ACK qua `chat.deleteScheduledMessage`. Mở lại không tự đặt lịch mới. Event gửi lịch cũ còn `sending`/`unknown` sẽ chặn lịch thay thế để tránh trùng.

Local/Preview dùng mock hoặc namespace/kênh thử riêng; không mặc định thêm Preview vào Production allowlist. Giữ `APP_PUBLIC_BASE_URL`, hai kênh, workspace và namespace đúng môi trường trước khi gửi thật. Nếu cần đổi signing key, kiểm các events/schedules cũ trước vì key mới không xác thực receipt cũ.

## Kiểm tra và giới hạn

Test offline trên Node 22:

```sh
node --import tsx --test test/*.test.ts
npm run typecheck
npm run dry-run
```

Các lệnh này không gửi Slack hoặc Deploy. Test frontend còn kiểm token phiên hiện tại, logout/đổi tài khoản, API origin cố định, lỗi API và abort. Trước release vẫn cần kiểm quyền với hai tài khoản, Slack/Storage thật, lịch nhắc và CPU/quota Free.

OCR tiếp tục dùng provider hiện tại. Trước khi đổi OCR, so kết quả trên ảnh menu Việt thật: tên món, giá, category, đúng quán, thời gian, lỗi và quota. Ghi kết quả đã ẩn thông tin cá nhân và chốt ngưỡng chấp nhận với chủ app; test labels bằng text hoặc ảnh giả chưa đủ để quyết định đổi OCR.

Tham khảo: [kiến trúc](../docs/architecture/README.md), [bảo mật](../docs/security/README.md), [Deploy](../docs/architecture/deployment.md), [Clerk JWT](https://clerk.com/docs/guides/sessions/manual-jwt-verification), [Supabase native Clerk](https://supabase.com/docs/guides/auth/third-party/clerk), [AI binding](https://developers.cloudflare.com/workers-ai/configuration/bindings/), [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).
