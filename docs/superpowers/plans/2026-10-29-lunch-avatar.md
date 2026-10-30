# Personal Avatar and Animated Mascot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người chưa có ảnh có mascot động ổn định; mọi người chọn mẫu, random mẫu khác hoặc upload ảnh và giữ lựa chọn qua các lần đăng nhập.

**Architecture:** Tùy chọn avatar nằm trong profile, ảnh upload ở Supabase Storage theo user folder; ảnh provider giữ riêng như hiện có. Port renderer React của page-mascot sang Vue và dùng một component Avatar cho toàn bộ app. Không chạy AI, thêm Worker hay backend ảnh.

**Tech Stack:** Vue 3, Canvas browser crop/reencode, Supabase profile/Storage RLS, Web Animations/sprite sheet, Vitest và browser QA.

**Spec:** [Thiết kế avatar](../specs/2026-10-29-slack-delivery-and-sponsor-proposal.md#avatar-cá-nhân-và-mascot-động--yêu-cầu-bổ-sung-2910). **Depends on:** Task 0 [rollout](2026-10-29-lunch-rollout.md); không phụ thuộc domain/Slack, tích hợp tuần tự vì cùng sửa Profile/query profiles.

## Global Constraints

- Theo Global Constraints và commit protocol của rollout: grep toàn bộ avatar/call site trước sửa, impact symbol và không sửa checkout `nhat` bẩn.
- Tám mẫu `fox`, `cat`, `bunny`, `panda`, `penguin`, `otter`, `robot`, `chef`; giữ MIT attribution. Không dùng runtime React cho avatar, không cài skill global, không dùng image generation.
- Gán mặc định một lần, không random lại khi render; lựa chọn của chủ tài khoản được ưu tiên hơn provider và không bị ensureProfile ghi đè.
- Ảnh JPG/PNG/WebP tối đa 2 MB; không SVG/HTML. Không thay đổi ID người dùng, quyền đơn, điện thoại hoặc thanh toán.

## Task A1: Schema, resolver và provisioning an toàn

**Files:** tạo migration qua `rtk proxy npx supabase migration new lunch_personal_avatars`; tạo `src/lib/avatar.js`, `src/lib/mascot-catalog.js`, `tests/unit/avatar.test.js`, `tests/database/avatar.sql`; sửa useProfile và database runners.

**Interfaces:** `defaultMascotForUser(userId): MascotId`; `resolveAvatar(profile,{imageFailed=false}={})` trả `{kind:'image',src}` hoặc `{kind:'mascot',mascotId}`. `PROFILE_AVATAR_FIELDS` là chuỗi field dùng lại cho các query profile. `useProfile().updateAvatar({mode,mascotId,uploadedPath})`; RPC `ensure_avatar_preferences(p_default_mascot_id text)` insert once/không ghi đè lựa chọn đã có.

- [ ] Viết test ổn định/ưu tiên trước:

```js
expect(defaultMascotForUser('user_b')).toBe(defaultMascotForUser('user_b'))
expect(resolveAvatar({id:'user_b',avatar_mode:'mascot',mascot_id:'fox',avatar_url:'google.jpg'}))
  .toEqual({kind:'mascot',mascotId:'fox'})
expect(resolveAvatar({id:'user_b',avatar_mode:'upload',uploaded_avatar_path:'user_b/image.webp'}).kind).toBe('image')
expect(resolveAvatar({id:'user_b',avatar_mode:'auto',provider_has_image:false,avatar_url:'placeholder.jpg'}).kind).toBe('mascot')
```

Thêm image error fallback, invalid mascot ID fallback, userId trống không ghi preference và sync Google không thay custom fields. Asset URL resolver dùng Supabase Storage public URL từ project đã cấu hình, không string do client ngoài allowlist cung cấp.

- [ ] Migration add `profiles.avatar_mode text not null default 'auto'`, `mascot_id text nullable whitelist`, `uploaded_avatar_path text nullable`, `provider_has_image boolean nullable`. Không overwrite `avatar_url` cũ. `provider_has_image=null` giữ ảnh cũ đến lần sync provider xác minh được; không đoán mọi ảnh Google đều là placeholder.
- [ ] RLS profile vẫn self update/insert. Guard upload path thuộc `${sub}/`, enum/mascot allowlist; mode upload yêu cầu path hợp lệ. Không cấp quyền cập nhật profile người khác. RPC ensure chỉ set mascot_id nếu đang null, với user lấy từ JWT và race-safe.
- [ ] ensureProfile chỉ đồng bộ id/name/provider avatar_url/provider_has_image theo SDK thực tế. Xác minh `user.hasImage` từ Clerk Vue/types/docs; nếu chưa xác định giữ null chứ không đoán false. Không gửi avatar_mode/mascot_id/uploaded_avatar_path trong upsert provider. Chỉ gọi ensure preference sau khi profile provisioning thành công.
- [ ] Chạy unit và DB tests: profile/avatar cũ giữ nguyên; A không đổi avatar B; đồng thời hai login không đổi default; custom upload/mascot sống qua logout/login. Commit `feat: persist personal avatar preferences without provider overwrite`.

## Task A2: Sprite renderer Vue và Avatar chung

**Files:** tạo `src/components/ui/MascotAvatar.vue`, `src/lib/mascot-motion.js`, `public/mascots/manifest.json`, `public/mascots/LICENSE.page-mascot`, 16 sprite WebP của tám mẫu dưới `public/mascots/`; sửa `src/components/ui/Avatar.vue`; tạo `tests/unit/mascot-motion.test.js`.

**Interfaces:** `MascotAvatar({mascotId,size,label,interactive})`; `registerMascotMotion(element,onDirection)` trả dispose; `directionForPointer(rect,point,previousSector)` pure function; `mascotAssets(mascotId)` trả directions/reactions local paths. Avatar nhận `profile` và giữ props src/name/size tương thích call site cũ trong lúc chuyển.

- [ ] Đọc source/asset list từ [page-mascot](https://github.com/nilbuild/page-mascot) tại commit đã chốt lúc triển khai, tải đúng hai sheet/mẫu, ghi source commit/hash/license trong manifest. Không hotlink runtime; không fetch toàn bộ repo/assets không dùng. Dùng file path/hash đã xác minh khi review thay vì đoán tên asset.
- [ ] Port bảng chín hướng/chín biểu cảm từ source MIT. Pure direction helper test dead-zone, tám góc, hysteresis không giật tại biên; dùng background-size 300%, cell 0/50/100%, không animate layout.
- [ ] Một singleton listener pointermove/scroll cho tất cả mascot đang visible, cập nhật theo animation frame khi pointer đổi; không tạo một listener global/timer rời cho mỗi người. IntersectionObserver/document.visibilityState đăng ký/hủy hoạt động; refcount 0 thì hủy listener và frame.
- [ ] Con trỏ fine mới tracking; mobile chỉ reaction chạm. Reduced motion không tracking/bounce/idle timer. Boop reaction ngắn, không stack animation khi bấm nhanh; hủy WAAPI animation và timeout cũ trước lần mới. Có thể idle blink thưa khi visible, hủy hoàn toàn khi nền/reduced motion.
- [ ] Avatar mặc định không tạo button; dùng span/role img trong link/button cha. Chỉ picker/profile preview độc lập mới interactive button có tên accessible và focus. Kích avatar trong hàng đơn không nuốt hành động mở đơn. Image error chuyển mascot cùng kích thước.
- [ ] Kiểm 28/40/86 px, avatar tròn không cắt mặt, 25 mẫu cùng màn hình, mobile tap, hover, keyboard và reduced motion. Unit motion lifecycle + build; commit `feat: render animated mascot avatars in Vue`.

## Task A3: Crop/upload và bộ chọn trong Hồ sơ

**Files:** tạo `src/components/AvatarPicker.vue`, `src/lib/avatar-upload.js`, `src/composables/useAvatarUpload.js`, `tests/unit/avatar-upload.test.js`; sửa ProfilePage/useProfile; thêm bucket/policies vào migration avatar trước release.

**Interfaces:** `prepareAvatar(file,crop,{signal}): Promise<Blob>`; `replaceAvatar(file,crop): Promise<{data,error}>`; picker draft `{mode,mascotId,file,crop}` chỉ lưu sau confirm. Crop `{x,y,size}` theo ảnh đã decode, output vuông 512×512 WebP hoặc JPEG, <=2 MB.

- [ ] Bucket `avatars`, cấu hình allowed MIME JPEG/PNG/WebP và file_size_limit=2097152. Public read cho ảnh đại diện hiển thị, write/delete chỉ authenticated và folder đầu bằng sub. Không grant upload vào bucket menus thay cho avatar; không cho arbitrary MIME/overwrite ảnh người khác.
- [ ] Test header/magic bytes/MIME, size>2MB, SVG đổi đuôi, decode fail, crop ngoài ảnh, EXIF orientation và output type/size. Browser decode/reencode loại metadata; không upload nguyên file chưa kiểm. Bắt file quá lớn trước decode, từ chối ảnh có cạnh vượt 8192 px hoặc tổng pixel vượt 25 triệu để tránh memory spike.
- [ ] Upload `${uid}/${crypto.randomUUID()}.webp`; sau upload, guard account/generation còn uid rồi lưu mode/path qua self profile update. Chỉ sau update thành công mới xóa ảnh cũ. Upload error giữ avatar cũ; profile save fail dọn ảnh mới; cleanup fail không rollback avatar mới, cho retry dọn an toàn.
- [ ] UI ba chế độ Tự động/Chọn mascot/Tải ảnh. Tám thumbnail, preview, Random chọn mẫu khác hiện tại rồi chờ Lưu; Hủy giữ avatar cũ. Đổi sang mascot giữ uploaded path cho phép quay lại ảnh, không xóa ảnh còn được tham chiếu; thay ảnh mới cleanup theo nguyên tắc trên.
- [ ] Update `PROFILE_AVATAR_FIELDS` vào toàn bộ profile nested selects trong useMenus/useOrders/useDashboard và các list candidates; cập nhật PresenceFloat/useAppPresence, App/Profile/Menu/Today/Manage/History/OrderCard để truyền đúng profile. Không dùng trực tiếp Clerk imageUrl ở nơi cần ưu tiên tùy chỉnh. Presence chỉ mang public avatar fields, không contact/payment data.
- [ ] Test hai tài khoản, upload trong lúc logout, upsert provider sau lựa chọn, fetch profile mới trên thiết bị khác, cấm xóa ảnh B bằng JWT A, ảnh URL lỗi và crop mobile. Unit/DB/build + browser QA. Docs/changelog, commit `feat: let members choose mascots or upload their own avatar`.

## Bàn giao

Avatar thêm một migration/bucket trong Supabase hiện có và asset/frontend trong lần deploy Vercel chung. Không thêm Cloudflare resource. Ghi license/source commit của tài nguyên, schema avatar và kiểm RLS vào báo cáo rollout.
