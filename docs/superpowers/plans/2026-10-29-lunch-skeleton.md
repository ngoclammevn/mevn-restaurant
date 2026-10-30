# ASCII Loading Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Áp dụng skeleton ASCII nhẹ cho menu, quản lý và lịch sử, không làm chậm đặt cơm hoặc nhảy bố cục.

**Architecture:** Vue component bọc `ascii-reveal/core` tạo markup skeleton từ cấu hình tin cậy. Nội dung thật thay ngay khi request hoàn tất; mặc định không dùng decode trì hoãn. Một CSS dùng chung, animation dọn đúng lifecycle và giảm chuyển động.

**Tech Stack:** Vue 3, ascii-reveal/core, CSS, IntersectionObserver, matchMedia, Vitest và browser screenshot/interaction QA.

**Spec:** [Thiết kế](../specs/2026-10-29-slack-delivery-and-sponsor-proposal.md#ascii-skeleton). **Depends on:** Task 0 [rollout](2026-10-29-lunch-rollout.md); tích hợp sau khi các trang đổi domain/Slack đã ổn để tránh ghi đè component.

## Global Constraints

- Theo Global Constraints và commit protocol của rollout; chỉ frontend, không thêm Worker hay dịch vụ.
- Không import React wrapper. Giữ khung kích thước và accessible loading; không scramble nội dung thanh toán/phone/tên người khi người dùng đang đọc.
- Hiện data ngay khi có; không thêm minimum loading duration hoặc ép chờ reveal 400ms. Không thay retry/error/empty bằng skeleton vô hạn.

## Task K1: Component skeleton dùng chung

**Files:** tạo `src/components/ui/AsciiSkeleton.vue`, `src/lib/ascii-skeleton.js`, `tests/unit/ascii-skeleton.test.js`; sửa `src/components/ui/index.js`, `src/styles/tokens.css`, package.json/package-lock.json.

**Interfaces:** `AsciiSkeleton({kind,lines,width,height,animate,label})`, kind allowlist `'text'|'menu-card'|'order-row'|'calendar'`; `createSkeletonMarkup(spec)` chỉ nhận số/enum, không nhận HTML/user text; `mountSkeletonAnimation(element,{visible,reducedMotion})` trả dispose.

- [ ] Xác minh core exports/version hiện tại theo [upstream](https://github.com/quanhoangindex/ascii-reveal/blob/main/src/core/index.ts); `rtk proxy npm install --save-exact ascii-reveal`. Import `asciiSkeletonHTML`, `SKELETON_CSS`, `animateSkeletons` từ core, đọc actual disposer API/types trước nối lifecycle.
- [ ] Viết test boundary/lifecycle: clamp lines 1..12, width/height hữu hạn dương; enum invalid fallback; không truyền tên/note người dùng vào HTML; unmount gọi dispose đúng một lần; hidden/reduced motion không bắt đầu animation. Test không chỉ snapshot DOM nguyên thư viện.
- [ ] `asciiSkeletonHTML({css:false})` nếu core hiện có hỗ trợ; inject SKELETON_CSS một lần toàn app. Không nhét CSS trùng mỗi hàng. Dither trung tính theo tokens, text placeholder aria-hidden, container `aria-busy=true` và một status label đọc được.
- [ ] Render markup ngay; chỉ chạy shimmer khi visible, document active và !reducedMotion. Dừng/dọn observer, media listener và animation khi hidden/unmount. Dùng số lượng skeleton tối đa 6 card hoặc số hàng viewport, không vẽ cả danh sách 1000 rows đang chờ.
- [ ] Test unit, build kiểm core không kéo React wrapper thêm vào chunk. Commit `feat: add accessible ASCII skeleton component for Vue`.

## Task K2: Tích hợp ba vùng và kiểm chuyển trạng thái

**Files:** sửa TodayPage/MenuPage/ManagePage/HistoryPage/OutstandingLedger; thêm fixture/loading cases vào `tests/unit/loading-states.test.js`; không thay mọi Spinner trong app.

**Interfaces:** Trạng thái tải lần đầu chưa có data → skeleton; refresh đã có data → giữ data + busy label; error → retry giữ nháp; empty → EmptyState. Quy tắc dùng chung cho ba vùng menu/management/history.

- [ ] Grep toàn bộ loading/Spinner/AsyncState tại các trang để lập checklist trước sửa. Dành cố định chiều cao ảnh/thẻ/menu row/lịch trong breakpoint tương ứng; skeleton giữ cùng grid thực tế, không giả nút có thể bấm.
- [ ] Thay first load card Today/Menu bằng menu-card, Manage bằng order-row, History bằng calendar. Không dùng skeleton cho QR đang thanh toán hoặc form đã nhập. Account đổi clear data đúng quyền trước loading mới, không giữ data user trước làm placeholder.
- [ ] Viết test chuyển trạng thái và browser fixtures delay 800ms, resolve empty, reject rồi retry, unmount trước resolve, reduced motion và tab background. Khi promise resolve, content tương tác ngay trong frame kế tiếp, không chờ decode.
- [ ] Chụp trước/sau loading ở 375px và 1280px; kiểm không tràn ngang/nhảy layout. CPU/performance với 25 avatar +6 skeleton không tăng animation loop theo từng row vô hạn; offscreen/background dừng. Nếu quá tải, tắt shimmer skeleton trong danh sách dài, vẫn giữ glyph pattern.
- [ ] Unit/build + browser keyboard, docs/changelog, commit `feat: apply ASCII skeletons to lunch loading states`.

## Bàn giao

Chỉ một build Vercel chung. Ghi rõ vùng đã áp dụng và kết quả mobile/reduced motion/first-load/refresh/error vào review report; không tuyên bố app tải nhanh hơn chỉ từ cảm giác animation.
