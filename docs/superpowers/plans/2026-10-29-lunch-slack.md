# Shared AI and Slack Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Một Worker gửi menu/thread, chia sẻ kênh chung, tag người nhận, cập nhật đã nhận và đặt/hủy nhắc, đồng thời giữ API AI hiện có.

**Architecture:** Clerk JWT → Worker kiểm quyền theo hành động → Supabase/RLS/RPC giữ event và lease → Slack Web API. Một Worker và một API base. Event đã biết kết quả được deduplicate; timeout không rõ kết quả không retry mù.

**Tech Stack:** Cloudflare Worker TypeScript, Web Crypto, Workers AI, Supabase REST/RPC, Slack chat API, Vitest/tsx offline contract tests.

**Spec:** [Thiết kế](../specs/2026-10-29-slack-delivery-and-sponsor-proposal.md). **Depends on:** [Domain](2026-10-29-lunch-domain.md).

## Global Constraints

- Áp dụng Global Constraints và commit protocol của [rollout](2026-10-29-lunch-rollout.md).
- Giữ `ai-worker/`, endpoint `/v1/feedback-suggestions`, `VITE_AI_API_BASE_URL`; không cần đổi Worker name/domain đang dùng. Một lần deploy Worker, không cron/KV/D1/Queue hay service_role.
- Không gửi số điện thoại, thông tin chuyển khoản, JWT hoặc ghi chú riêng vào Slack/log. Không nhận channel/ảnh/link/tên người nhận tùy ý từ body; Worker dựng từ DB và cấu hình tin cậy.
- AI và Slack tách limiter/config lỗi; thiếu token Slack không làm `/v1/feedback-suggestions` lỗi. Inference không nằm trong đường gửi Slack.

## Task S1: Registry event và liên kết Slack ID

**Files:** tạo migration qua `rtk proxy npx supabase migration new lunch_slack_events`; tạo `tests/database/slack-events.sql`; sửa database runners và `docs/architecture/api.md`.

**Interfaces:** `enqueue_lunch_notification(p_menu_id uuid,p_kind text,p_revision integer,p_namespace text)`; `claim_lunch_notification(p_event_id uuid)` trả event/claim_nonce/lease_until; `finish_lunch_notification(p_event_id uuid,p_claim_nonce uuid,p_status text,p_receipt jsonb)`; `resolve_lunch_notification(p_event_id uuid,p_resolution text)` chỉ actor đúng quyền. `p_kind` allowlist: `published`, `shared`, `closed`, `reopened`, `pickup_changed`, `received`, `reminder_schedule`, `reminder_cancel`.

- [ ] Tạo `slack_profile_links(user_id text,workspace_id text,slack_user_id text,PK(user_id,workspace_id),unique(workspace_id,slack_user_id))`. Self insert/update; authenticated chỉ đọc ID hiển thị cần tag, anon không đọc. ID không cấp thêm quyền app. Người dùng copy Slack member ID, Worker `users.info` kiểm tồn tại trong workspace, không dùng email/tên để tự ghép.
- [ ] Tạo `slack_daily_threads(namespace text,workspace_id text,menu_date date,channel_id text,thread_ts text,receipt jsonb,claim_nonce uuid,lease_until timestamptz,unique(namespace,workspace_id,menu_date,channel_id))` và `slack_notifications(id uuid,menu_id uuid,namespace text,kind text,revision integer,status text,claim_nonce uuid,lease_until timestamptz,receipt jsonb,last_error_code text,next_attempt_at timestamptz,unique(namespace,menu_id,kind,revision))`.
- [ ] Status allowlist `pending/sending/sent/retryable/unknown/cancel_pending/cancelled`. RPC lấy actor từ JWT; poster enqueue/send menu, primary hiện tại có thể enqueue received của pickup của mình, không dùng user_id từ body. Daily root cho các poster có menu đúng ngày tham gia cùng registry; không cho anon hoặc user không có quyền ghi menu/event.
- [ ] Claim dùng conditional UPDATE/row lock với nonce và lease 30 giây; chỉ một claim thành công. Sent có receipt hợp lệ không claim lại. Lease hết hạn sau request đang gửi phải sang unknown, không tự coi là chưa gửi. Không giữ transaction DB mở trong lúc gọi Slack.
- [ ] Các RPC mới SECURITY INVOKER với search_path cố định, revoke EXECUTE PUBLIC/anon và grant authenticated; RLS kiểm actor trong body và table policies.
- [ ] Worker ký receipt HMAC bằng secret `SLACK_RECEIPT_SIGNING_KEY`: scope namespace/workspace/channel/menu-or-day/kind/revision + Slack ts/scheduled ID. State receipt từ DB là dữ liệu không tin cậy: verify trước reuse ts hoặc coi event là đã gửi. Không biến RPC chỉ dành cho frontend thành bằng chứng “đã gửi” không kiểm ký. RPC vẫn RLS invoker; không thêm quyền machine bằng service_role.
- [ ] Test SQL hai poster cùng ngày tạo một registry row; poster B không finish event menu A; received chỉ primary/poster; hai claim cạnh tranh có một winner; nonce cũ không finish; version/revision không trùng; contact không xuất hiện trong row JSON.
- [ ] `test:db` + test PostgreSQL hai kết nối cho lease; docs/changelog/impact rồi commit `feat: persist scoped Slack events and delivery claims`.

## Task S2: Slack client, builders và Worker router

**Files:** sửa `ai-worker/src/index.ts`, `ai-worker/src/http.ts`, `ai-worker/src/database.ts`; tạo `ai-worker/src/slack/client.ts`, `messages.ts`, `service.ts`, `receipts.ts`, `config.ts`, `ai-worker/test/slack.test.ts`; sửa `ai-worker/wrangler.jsonc`, `.dev.vars.example`, README và worker types bằng Wrangler sau khi đọc skill wrangler.

**Interfaces TypeScript:** `buildMenuMessage(menu,publicBaseUrl)`; `buildPickupMessage(menu,pickup,slackLinks)` trả `{text,blocks}`; `sendSlack(method,payload,{token,fetcher,timeoutMs})`; `dispatchNotification({subject,token,eventId},env)` trả `{status,eventId,retryAfter?}`; `signReceipt(payload,key)`/`verifyReceipt(receipt,key,expectedScope)`.

- [ ] Viết offline tests trước bằng Node test như contracts.test.ts. Ví dụ output và key boundaries:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPickupMessage } from '../src/slack/messages.ts'
test('mentions only the selected primary and never serializes contact', () => {
  const message = buildPickupMessage(
    {id:'menu-1',title:'Cơm trưa'},
    {primary_user_id:'user_b',backup_user_id:'user_c',phone_e164:'+84901234567'},
    {user_b:'U0123456789',user_c:'U0987654321'},
  )
  const text = JSON.stringify(message)
  assert.match(text, /<@U0123456789>/)
  assert.doesNotMatch(text, /84901234567|U0987654321/)
})
```

Builder đọc field allowlist, không spread DB object vào payload. Escape `&<>` trong tên/note công khai để không tạo mention giả; không bật link_names cho dữ liệu người dùng.

- [ ] Router thêm POST `/v1/slack/publish`, `/share`, `/closed`, `/reopened`, `/pickup-changed`, `/received`, `/reminder`, `/retry`, `/link-account`, `/resolve`. Body giới hạn 8 KiB, chỉ ID/revision/event/choice cần thiết; GET hoặc path/query không hợp lệ bị từ chối. Auth/CORS trước business query; route received kiểm primary/poster, các route quản lý kiểm poster. Recheck current DB state, không tin closure/receiver do client gửi.
- [ ] Config chung: Clerk issuer/origins/Supabase URL/publishable key như hiện có. Config Slack: `SLACK_WORKSPACE_ID`, `SLACK_ORDER_CHANNEL_ID`, `SLACK_GENERAL_CHANNEL_ID`, `APP_PUBLIC_BASE_URL`, `SLACK_NAMESPACE`. Secrets: bot token + receipt signing. Thêm user/service limiter riêng Slack, xác minh namespace IDs không trùng binding khác; đừng dùng limiter inference làm hạn mức gửi tin.
- [ ] `sendSlack` dùng Authorization header, HTTPS Slack cố định, timeout 5 giây, parse cả HTTP status và `{ok:false,error}`. 429 lưu retry_after/next_attempt_at; definitive errors token_revoked/not_in_channel/missing_scope không báo sent; network timeout sau khi bắt đầu gửi → unknown. Tránh tự retry non-idempotent post sau timeout.
- [ ] Publish: ensure daily root theo unique key+claim, gửi một tin root, lưu receipt trước menu reply. Ngày dùng menu_date/VN, không dùng UTC slice. Không có menu thì không tạo thread. Mỗi menu có reply link/ảnh riêng; share chỉ khi poster bấm và dùng general channel pinned config. Ảnh thiếu thì gửi text+link hợp lệ.
- [ ] Closed/pickup-changed/received tải đúng closure/pickup revision, tag primary bằng Slack ID đã kiểm; backup không tag cho tới activate. Thiếu liên kết Slack vẫn gửi tên và cảnh báo “chưa liên kết Slack” trong app, không đoán ID. AI không được tạo nội dung thông báo hoặc chọn người nhận.
- [ ] Unknown: app hướng dẫn poster kiểm tra kênh. `/resolve` chỉ poster xác nhận đã gửi/chưa gửi rõ ràng; nếu xác nhận chưa gửi thì cho tạo attempt mới và cảnh báo khả năng trùng. Không hứa exactly-once khi Slack nhận request nhưng không trả ACK. Verify scope receipt trước mọi reuse, không cho timestamp của kênh/ngày khác.
- [ ] Test auth missing/expired, foreign menu, receiver stale, fake receipt, double click, two posters, 429, timeout, missing token Slack nhưng AI còn hoạt động, quota AI nhưng Slack còn hoạt động. Chạy Worker test/typecheck/dry-run; dry-run không deploy hay inference thật. Commit `feat: serve Slack coordination alongside AI in one Worker`.

## Task S3: Nhắc trước chốt bằng Slack scheduling

**Files:** migration Slack, `ai-worker/src/slack/service.ts`, `client.ts`; tạo `ai-worker/test/slack-reminders.test.ts`; tạo `src/components/MenuReminderField.vue`; sửa PostMenuPage/ManagePage.

**Interfaces:** `menus.reminder_at timestamptz nullable`, `reminder_version integer default 0`; event receipt giữ `scheduled_message_id`/channel/post_at. `set_lunch_reminder(p_menu_id uuid,p_at timestamptz default null)` kiểm poster, expected current menu state và tăng reminder_version.

- [ ] Test đặt một lần, đổi giờ hủy lịch cũ rồi tạo mới, tắt hủy, chốt sớm hủy, API cancel fail lưu cancel_pending. Không đoán giờ chốt từ title: poster bật và chọn thời điểm VN cụ thể trước giờ định chốt; menu không có giờ thì không tự đặt nhắc.
- [ ] Worker gọi [chat.scheduleMessage](https://docs.slack.dev/reference/methods/chat.scheduleMessage/) với `post_at`, order channel, root `thread_ts`, text/blocks chứa link menu và câu có điều kiện “Nếu chưa đặt, mở menu kiểm tra còn nhận đơn”. Không gửi `metadata`: Slack docs hiện cảnh báo metadata có thể làm scheduled message không được phát. Giới hạn theo docs tại lúc thực thi, từ chối giờ quá khứ/ngoài ngày menu.
- [ ] Lưu schedule ID sau ACK, browser có thể đóng và Slack vẫn gửi theo lịch. Đổi/hủy/chốt/reopen gọi `chat.deleteScheduledMessage` đúng ID; không auto tạo reminder mới khi reopen nếu poster chưa bật lại. Cancellation lỗi hiện rõ và cho retry, không báo đã hủy khi chưa có ACK.
- [ ] Không tạo cron, không giữ Clerk JWT để dùng ngày sau, không lưu token người dùng vào DB. Các yêu cầu đặt/hủy được auth bằng phiên hiện tại; Slack giữ lịch đã chấp nhận. Test không gọi Slack thật, commit `feat: schedule and cancel menu reminders through Slack`.

## Task S4: Nối frontend và phục hồi pending

**Files:** tạo `src/lib/lunch-api.js`, `src/composables/useSlackNotifications.js`, `src/components/SlackPublishDialog.vue`, `src/components/SlackDeliveryStatus.vue`, `src/components/SlackAccountField.vue`; sửa MenuPage/PostMenuPage/ManagePage/ProfilePage/useMenus; tạo `tests/unit/slack-notifications.test.js`.

**Interfaces:** `callLunchApi(path,body,{signal})` lấy Clerk JWT hiện tại, cùng base `VITE_AI_API_BASE_URL`; `publishMenu(menuId)`, `shareMenu(menuId,revision)`, `notifyClosure(result)`, `retryEvent(eventId)`, `resolveEvent(eventId,resolution)`, `linkSlackAccount(memberId)`, `syncPendingForMyMenus()`.

- [ ] Sau DB save menu thành công, lập tức publish; nếu gọi Worker gián đoạn, menu vẫn thành công và có trạng thái “Chưa gửi Slack”. Khi chủ menu mở Quản lý/online lại, đối chiếu menu của chính mình với registry trong namespace hiện tại để enqueue thiếu và retry các definitive-retryable tới hạn. Không drain event của người khác hay namespace preview/production khác.
- [ ] Sự kiện closed/reopened/activateBackup/received dispatch sau commit domain. Notify fail không rollback state, không gửi lại order/close RPC để retry Slack. Dedupe theo revision/event, response chậm sau logout không cập nhật UI tài khoản mới.
- [ ] Nút Đăng kênh chung có preview link+ảnh, disabled khi sending, hiển thị receipt/đã gửi. Retry unknown mở lựa chọn kiểm tra; chỉ retryable mới bấm gửi lại trực tiếp. Hiển thị link Slack khi có ts đã ACK.
- [ ] Profile cho copy/paste member ID, xác nhận tên trả từ `users.info`, lưu theo own user/workspace; không nhận email làm định danh. Không dùng Slack ID để cấp quyền menu hoặc đọc liên hệ.
- [ ] Namespace preview dùng kênh thử và config riêng; test fixture dùng DB local/harness, không tạo menu giả vào DB chung để thử notifications. Production chỉ gửi sau setup/allowlist kiểm rõ.
- [ ] Unit auth/fetch/timeouts và browser hai account qua các event. Chạy toàn bộ Worker + root tests/build; cập nhật API/deployment/changelog, commit `feat: connect menu coordination to durable Slack delivery`.

## Bàn giao

Một Worker có health/auth/AI/Slack; không thêm tài nguyên Cloudflare. Ghi actual env names, scope Slack, migration version và trạng thái pending/unknown vào hướng dẫn vận hành. Kích hoạt gửi thật chỉ trong release runbook đã chọn workspace/kênh.
