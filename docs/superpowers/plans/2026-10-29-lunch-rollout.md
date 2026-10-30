# Company Lunch Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. If the user chooses parallel execution, use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phát hành luồng điều phối cơm/nước trong công ty, giữ dữ liệu và chức năng hiện có, bổ sung Slack, nhận cơm, được mời, Excel, mascot và skeleton.

**Architecture:** Vue static gọi Supabase bằng Clerk JWT/RLS. Mở rộng Worker hiện tại trong `ai-worker/` cho AI và Slack; dùng chung URL và lần deploy, tách xử lý lỗi/rate limit. Dữ liệu bền nằm trong Supabase; Slack tự giữ lịch gửi nhắc đã được đặt thành công.

**Tech Stack:** Vue 3/Vite, Clerk, Supabase Postgres/Storage, Cloudflare Workers + Workers AI, Slack Web API, ExcelJS, ascii-reveal/core, mascot sprite chuyển sang Vue.

**Spec:** [Thiết kế đã chốt](../specs/2026-10-29-slack-delivery-and-sponsor-proposal.md).

## Global Constraints

- Một Cloudflare Worker chung AI + Slack; không thêm Worker thứ hai, KV, D1, Queue, backend Express hoặc hệ thống đăng nhập mới.
- Giữ free tier. Không tự bật billing. Không đưa Slack token, Supabase service_role hoặc Clerk secret vào frontend; không sử dụng service_role trong backend.
- Mọi bảng mới bật RLS trước grant Data API; RPC SECURITY INVOKER, search_path cố định và revoke execute mặc định của PUBLIC/anon. Không dùng function đặc quyền để né policy.
- Clerk user ID là text; RLS dùng `auth.jwt()->>'sub'`. Chỉ chủ đơn đổi `is_paid`; đặt hộ không đồng ý nhận hàng/thanh toán/đánh giá thay người khác.
- Số điện thoại lưu một lần theo tài khoản, đổi trong menu; khả năng nhận hỏi theo ngày giờ VN, độc lập với số đã lưu.
- Giữ dữ liệu cũ, ID và trạng thái thanh toán; giá chưa biết không thành 0; không đoán quán/giá lịch sử.
- Node root theo PR: `^22.18.0 || >=24.11.0`; Worker `>=22`. Chạy shell bằng `rtk` theo RTK.md.
- Trước sửa component/pattern: tìm toàn bộ call site trong `src/`; trước sửa symbol: GitNexus impact upstream và báo phạm vi/rủi ro; cập nhật index đúng checkout nếu stale. Không dùng graph của nhánh `nhat` để kết luận về PR.
- Trước mỗi commit: đọc diff, thêm changelog tiếng Việt vào entry ngày VN hiện tại, chạy `gitnexus_detect_changes`, kiểm scope và chỉ stage file thuộc task. Không stage/ghi đè thay đổi của người dùng.
- Kế hoạch này chưa thực thi code, commit, merge, migration, gửi Slack hoặc deploy. Các bước release chạy khi đến lượt phát hành với tài khoản và môi trường đã xác định.

## Baseline và nơi làm việc

Root `/Users/nhatminh/Desktop/MEVN/mevn-restaurant` đang ở `nhat`, ahead 16, có nhiều thay đổi chưa commit. Giữ nguyên. Worktree PR đang có sẵn tại `/Users/nhatminh/.codex/worktrees/lunch-ui-ux-review/mevn-restaurant`, branch `codex/lunch-experience-ai`, sạch lúc lập kế hoạch. Khi thực thi, dùng kỹ năng using-git-worktrees, kiểm attachments/status và ưu tiên worktree hiện có; không tạo thêm nếu không cần. Xin quyền filesystem nếu host yêu cầu ghi worktree ngoài writable roots, không lách sandbox.

PR #15 head đã review `ebb3127`; main đã kiểm `ca986c2`. Fetch và xác minh lại trước khi bắt đầu. Snapshot `/private/tmp/lunch-pr15-review-f8xv3x8o` chỉ dùng review, không làm checkout để phát triển. Bộ test preservation trong snapshot không phải file đã commit.

## Chặng và phụ thuộc

| Chặng | Tài liệu thực thi | Đầu ra |
| --- | --- | --- |
| 0 | Task 0 bên dưới | PR tích hợp main mới, giữ thống kê và baseline test |
| 1 | [Domain](2026-10-29-lunch-domain.md) | Liên hệ riêng tư, nhận cơm, được mời, giá chốt, lưu trữ menu |
| 2 | [Worker + Slack](2026-10-29-lunch-slack.md) | Thread ngày, gửi chung, tag người nhận, nhắc lịch, trạng thái gửi |
| 3a | [Excel](2026-10-29-lunch-excel.md) | Workbook ba sheet từ dữ liệu tài chính cùng nguồn UI |
| 3b | [Avatar](2026-10-29-lunch-avatar.md) | Mascot động ổn định, chọn mẫu, upload ảnh |
| 3c | [Skeleton](2026-10-29-lunch-skeleton.md) | Skeleton ASCII trên các vùng tải dữ liệu |
| 4 | Task release bên dưới | Kiểm hai tài khoản, bảo toàn dữ liệu, một lần phát hành đồng bộ |

Slack và Excel phụ thuộc domain. Avatar và skeleton độc lập sau chặng 0 nhưng cùng sửa Profile/Menu/Manage với domain: thực thi tuần tự mặc định, hoặc có chủ sở hữu file rõ ràng nếu người dùng chọn nhiều agent. Chỉ một task tại một thời điểm ghi migration history, package lock và changelog.

## Task 0: Tích hợp main và khôi phục baseline

**Files:** `src/pages/DashboardPage.vue`, `src/composables/useDashboard.js`, `src/changelog.json`, `src/router.js`; tạo `tests/unit/dashboard-regression.test.js`; cập nhật `docs/architecture/README.md` và AGENTS.md trong checkout phát triển để phản ánh ngoại lệ đã duyệt.

**Interfaces:** Giữ `/dashboard`, `useDashboard().fetchStatistics({startDate,endDate,onlyMyMenus})`, khoản chưa thu tất cả ngày và workspace quản lý của PR. `/dashboard` có mục Thống kê; không bỏ chức năng main khi giữ giao diện mới.

- [ ] Kiểm sạch worktree, fetch origin, lưu SHA trước tích hợp. Merge `origin/main` vào branch triển khai; giải quyết ba conflict bằng cách ghép hành vi, không chọn nguyên ours/theirs. Chưa merge vào main.
- [ ] Viết test regression với Supabase mock: khoản 90 ngày trước vẫn có; đổi khoảng ngày thay query; `onlyMyMenus=false` giữ phạm vi nhóm; người thu không có mutation `is_paid` cho người khác. Ví dụ test hợp đồng cần tồn tại:

```js
import { expect, test } from 'vitest'
import { useDashboard } from '../../src/composables/useDashboard.js'
test('retains main statistics API', () => {
  expect(typeof useDashboard().fetchStatistics).toBe('function')
})
```

Mock Clerk/Supabase theo fixture trong `tests/unit/menu-account-guard.test.js` trước khi gọi composable. Mỗi trường hợp query phải assert cả filter gửi tới mock và số liệu trả về, không chỉ kiểm symbol tồn tại.

- [ ] Chạy `rtk proxy npm run test:unit`, xác nhận test mới thất bại nếu nhận nguyên bản PR bỏ API thống kê. Tích hợp thống kê vào UI mới, giữ tên API cho call site đang có. Sau domain, đổi nguồn tính tiền sang hợp đồng tài chính chung.
- [ ] Chạy unit, `test:db`, build; Worker test và typecheck theo README. Lưu baseline version Node, số test và warning. Không chạy test RLS HTTP vào DB thật; suite đó cần Supabase local.
- [ ] Cập nhật docs/changelog và kiểm scope trước commit `fix: preserve dashboard statistics while integrating lunch experience`.

## Kiểm thử tích hợp cuối

- [ ] Fixture A = chủ menu, B = người ăn, C = người được đặt hộ. Kiểm menu text/cấu trúc, hai menu/ngày, paid/unpaid cũ, chưa biết giá, menu được mời.
- [ ] A đặt hộ C: C sở hữu đơn; A không tự tick trả tiền hoặc đăng ký nhận thay C. B đồng ý nhận và lưu số lần đầu; hôm sau chọn có không hỏi số; đổi số trên menu sau chốt cập nhật liên hệ đang nhận, không đổi đơn/giá/người nhận.
- [ ] Chốt/mở lại/chốt lần nữa giữ revision tài chính cũ; bốc thăm không đếm B hai lần khi B có nhiều đơn; không có ứng viên có đường chốt với chủ menu tự nhận; người nhận bấm Đã nhận cơm; backup chỉ được tag khi được kích hoạt.
- [ ] Hai người đăng đồng thời tạo menu cùng ngày: một root thread; double click gửi chung/chốt không gửi trùng đã biết kết quả. Slack timeout hiện không rõ kết quả; không retry mù. AI lỗi/quota không chặn Slack và đặt cơm.
- [ ] Bật nhắc, đổi giờ, tắt, chốt sớm: kiểm create/cancel lịch Slack và trạng thái cancel_pending nếu API lỗi. Không tạo cron hoặc app automation.
- [ ] Excel đủ các trang dữ liệu, khớp UI, giữ số chưa biết và được mời; ảnh/avatar không chứa hoặc lộ số điện thoại. Tên/note bắt đầu `=`, `+`, `-`, `@` không thành công thức.
- [ ] Desktop 1280px, mobile 375px, bàn phím, reduced motion, mạng chậm, đổi tài khoản giữa upload/RPC, ảnh lỗi, danh sách 25 người và nhiều avatar cùng màn hình.
- [ ] Chạy các suite mới và baseline một lượt sau tích hợp; sửa lỗi thì chỉ kiểm lại phần bị ảnh hưởng rồi build cuối. Ghi bằng chứng vào `docs/review/2026-10-29-lunch-rollout-verification.md`; không dùng kết quả cũ để khẳng định bản sau cùng đạt.

## Task release: Ba nơi cập nhật và Slack setup

**Files:** `docs/architecture/deployment.md`, tạo `docs/release/2026-10-29-lunch-release.md`; giữ các file owner config/env ngoài Git.

- [ ] Trước release xác minh Supabase đúng project `zabttnzoxdgfwpioqcrk`, Clerk đúng instance và history thật. Project tạm dừng/không truy cập được là điều kiện chặn phát hành DB, không chặn phát triển/test local. Không tự restore project trong bước lập kế hoạch.
- [ ] Backup dữ liệu/schema và inventory Storage cần giữ; ghi count/checksum ID, paid_at/is_paid, payment_info trước thay đổi. Không ghi số điện thoại/token thật vào báo cáo repo.
- [ ] Đối chiếu migration catalog đã áp dụng ngày 04/10 dưới version `20261004014918`/`20261004015046` với file local. Chỉ chạy phần thiếu; không db reset, không sửa history remote mù hoặc reapply vì timestamp khác. Mọi migration mới additive, frontend cũ còn dùng được trong lúc chuyển phiên bản.
- [ ] **Supabase:** áp dụng migration thiếu trong release manifest theo thứ tự contacts → sponsorship/finance → close/pickup → Slack → avatar; kiểm quyền hai user và dữ liệu cũ trước deploy frontend.
- [ ] **Slack setup một lần:** app trong đúng workspace, `chat:write` và `users:read` cho kiểm ID, invite bot vào hai kênh; không xin `users:read.email` hoặc quyền đăng mọi kênh. Preview dùng kênh thử rõ ràng, không gửi vào kênh chung thật trong test.
- [ ] **Cloudflare:** deploy đúng Worker hiện có với AI binding + endpoint Slack, secret Slack và receipt signing, origins chính xác, rate limiter riêng. Xác minh `/health`, auth/ownership, AI fallback và một thông báo đã cho phép. Một Worker/API URL cho cả hai.
- [ ] **Vercel:** build/deploy một frontend. Giữ tên `VITE_AI_API_BASE_URL` làm API base chung ở đợt này để không cần đổi biến hiện có; facade Slack gọi cùng base. Không thêm secret vào VITE env.
- [ ] Smoke hai user; so sánh count/checksum cũ, quyền self-tick, ảnh, lịch sử, nợ cũ. Lưu version/deployment IDs và migration version thực vào release manifest. Clerk không cần deploy riêng.
- [ ] Rollback bằng version frontend/Worker trước; giữ bảng/cột/data bổ sung. Không xóa dữ liệu để rollback UI. Tắt lịch Slack còn sống nếu rollout bị hủy và xác minh cancellation; không rotate token/bật trả phí tự động.

## Điều kiện hoàn tất

Tất cả task trong năm kế hoạch có bằng chứng kiểm thử; không mất thống kê main hay dữ liệu cũ; một Worker xử lý AI + Slack; người dùng dùng được số lưu sẵn/đổi số, nhận cơm, được mời, Excel, avatar và skeleton. Release production chỉ được gọi là xong sau kiểm dữ liệu/quyền/messaging trên đúng môi trường, không dựa riêng vào build local.

## Đối chiếu phạm vi đã duyệt

| Yêu cầu | Task chịu trách nhiệm | Bằng chứng nghiệm thu |
| --- | --- | --- |
| Giữ dữ liệu cũ và thống kê main | 0, D2, release | Regression dashboard + so sánh dữ liệu gốc trước/sau |
| Số lưu một lần, đổi ngay trong menu | D1, D3, D4 | Hai ngày/hai thiết bị, đổi số khi đã chốt, RLS |
| Consent theo ngày, đặt hộ không đồng ý thay | D1, D4 | Test ba user, không có consent ngầm |
| Random công bằng, dự phòng, đã nhận | D3, D4, S2/S4 | Dedup người, count distinct menu, actor và tag đúng |
| Một thread/ngày, ảnh/link và trigger kênh chung | S1, S2, S4 | Hai poster cùng ngày, double click và namespace |
| Một Worker AI + Slack, nhắc không cron | S2, S3 | Route isolation, quota fallback, schedule/cancel ACK |
| Được mời, lý do mời, self-tick | D2, D4 | Không vào ledger, vendor cost riêng amount due |
| Giá chốt/lịch sử điều chỉnh và lưu trữ menu | D2, D3 | Revision cũ bất biến, archive giữ history/nợ |
| Excel ba sheet, giữ CSV | E1, E2 | Round-trip XLSX, đủ trang, total khớp và formula safety |
| Mascot động, tự chọn/random/upload, giữ ảnh cũ | A1, A2, A3 | Login lại, crop/upload/RLS, mobile/reduced motion |
| ASCII skeleton nhẹ | K1, K2 | Data xuất hiện ngay, không layout shift, dispose |
