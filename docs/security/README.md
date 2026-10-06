# Bảo mật giao tiếp Vue — Supabase — AI Worker

[Mục lục](../README.md) · [Kiến trúc](../architecture/README.md) · [API](../architecture/api.md) · [Triển khai](../architecture/deployment.md)

Mục tiêu là bảo vệ API AI bằng phiên đăng nhập sẵn có và giữ RLS là rào dữ liệu. Vue gửi Clerk JWT như API credential; Worker kiểm chữ ký/thời hạn/issuer/origin. Không phát sinh khóa bí mật cho frontend hoặc màn hình đăng nhập AI riêng.

## Quy tắc thực thi

1. **Supabase:** mọi request nghiệp vụ dùng publishable key và JWT người dùng. RLS dùng `auth.jwt()->>'sub'` vì Clerk ID là string. RPC/views/trigger mới chạy bằng quyền người gọi; không dùng `SECURITY DEFINER` để né RLS.
2. **Worker auth:** chỉ Bearer token có kích thước giới hạn, RS256, issuer cấu hình cố định; yêu cầu `sub`, `exp`, `nbf`, `azp`, từ chối pending session. `azp` phải bằng chính `Origin` của request và thuộc allowlist. Không thêm yêu cầu sid/iat/role riêng ở Worker. Không đọc URL JWKS từ claim/header của token.
3. **Public JWKS:** chỉ HTTPS issuer cấu hình, timeout fetch 3 giây, không redirect/cookie/user bearer; stream body tối đa 32 KiB trong 3 giây, 1–10 keys. Không log token hoặc lỗi thư viện.
4. **Ngữ cảnh:** body chỉ nhận UUID đơn/item và locale. Worker đọc Supabase bằng chính JWT đó, kiểm chủ đơn và toàn bộ quan hệ item→đơn→menu trước cache/inference. Cần kiểm này vì RLS cho nhóm authenticated đọc đơn chung. Tên món/nhóm lấy từ DB, giới hạn 120/48 ký tự; ghi chú/người/ảnh không vào prompt.
5. **Giới hạn:** request tối đa 16 KiB và deadline đọc 4 giây, 1–20 item; mỗi Supabase GET timeout 4 giây, response tối đa 64 KiB và deadline đọc 4 giây. Các mốc fetch/body là từng giai đoạn, không phải SLA tổng request. AI timeout 8 giây, output giới hạn và validation trước dùng. Rate limit 10 request/user/phút và 60 request/dịch vụ/phút theo location áp dụng sau xác thực, kể cả cache hit.
6. **Kết quả:** nhãn model là dữ liệu không đáng tin, phải đúng schema/chỉ số, cân bằng tích cực/tiêu cực, giới hạn ký tự, không markup/URL/số, không trùng nhãn. Các kiểm tra này không bảo đảm chất lượng ngữ nghĩa. Không tự lưu nhãn/sao; người dùng xác nhận và Supabase kiểm quyền ghi.
7. **Cache/log:** API response `no-store`; cache nội bộ chỉ chứa nhãn đã kiểm tra, key hash tên/nhóm/locale/phiên bản prompt/model, TTL một ngày. Không có JWT, user/order/item ID hay ghi chú trong cache. Metadata món giống nhau có thể chia sẻ nhãn; xác thực/quyền được kiểm lại mỗi request. Log chỉ event/version/status/số lượng; invocation logs và traces đã tắt trong cấu hình Worker.

Giá trị public (publishable key, issuer, URL app/Worker) không cần che giấu. Token phiên là credential tạm thời và không được log, lưu cùng nháp, hoặc đưa vào query string. CORS không ngăn client ngoài trình duyệt tự gửi header; chữ ký JWT và RLS mới là cơ chế xác thực/quyền.

## Mối đe dọa và bằng chứng kiểm chứng

| Tình huống | Kiểm soát trong code | Kiểm chứng |
| --- | --- | --- |
| Gọi API bằng API key lấy từ bundle/không token | Public key không thay cho Bearer JWT | Worker test thiếu token, sai chữ ký/issuer/expiry |
| Token hợp lệ của app origin A gửi từ B | `azp === Origin`, allowlist chính xác | Test hai origin đều trong allowlist vẫn không hoán đổi được |
| Đoán ID đơn hoặc lẫn item khác menu | User JWT + parent ownership + đủ item mapping | Test foreign/missing IDs, foreign menu/order, đặt hộ chỉ recipient dùng được |
| Body khai Content-Length sai hoặc stream chậm | Đếm bytes khi đọc, deadline tuyệt đối | Test oversized body và stream dưới byte limit nhưng không kết thúc |
| JWKS đổi hướng hoặc payload lớn | Pinned issuer, redirect error, byte/key/time bounds | Test redirect, empty/excess keys, oversized payload; endpoint signed-JWT test |
| Secret key cấu hình nhầm | Chỉ modern `sb_publishable_…` với format giới hạn | Test secret/legacy JWT/empty suffix; origin credential/path/wildcard |
| Hết quota/AI treo/output sai | Timeout, schema validation, fallback | Contract tests quota/timeout/malformed/duplicate/markup |
| XSS/đưa chỉ dẫn trong tên món | Prompt coi tên là dữ liệu; output text/validation | Kiểm model schema và UI text rendering; cần đánh giá ngữ nghĩa thực tế |
| Cache trả nhãn cho item ID cũ | Cache không giữ item ID, ánh xạ lại theo request | Cache tests metadata trùng nhưng item ID đổi |
| Bỏ qua UI ghi review/trả hộ | RLS + DB guards | Chạy SQL regression với hai user; production smoke riêng |

Tests được chuẩn bị ở [`ai-worker/test/contracts.test.ts`](../../ai-worker/test/contracts.test.ts). Việc có test trong repo không chứng minh test đã chạy hoặc production đã đạt; kết quả phải lấy từ lượt xác minh cuối. Cấu hình tài khoản bên ngoài cần kiểm riêng sau deploy.

## Giới hạn và cấu hình chưa kiểm chứng

- Public JWKS xác minh token offline, không kiểm thu hồi session ngay lập tức; token có thể còn dùng tới `exp`. Không thêm Clerk secret/webhook vì mục tiêu API không cần chúng.
- Rate limit Worker là sau xác thực, theo Cloudflare location và không phải quota toàn cầu. Gọi sai token vẫn có thể gây public JWKS requests; không tuyên bố chống được tấn công volumetric hoặc đảm bảo miễn gián đoạn. Free plan/quota là hàng rào chi phí; không nâng gói tự động.
- Allowlist origin, issuer, project URL, account ID, rate-limit namespaces, native auth provider và migration trên production chưa được xác nhận bằng task này. `/health` không kiểm các thiết lập đó.
- **OCR cũ** ở [`api/ocr.js`](../../api/ocr.js) chưa có auth/rate limit như Worker và trả chi tiết lỗi provider. Worker này không bảo vệ endpoint OCR. Chuyển OCR/siết endpoint cũ cần công việc riêng đúng phạm vi; không coi toàn bộ hệ thống đã được audit chỉ vì đường AI mới được bảo vệ.
- Storage `menus` vẫn public; phạm vi guest/anonymous của dữ liệu nền cần xem đầy đủ migrations và provider hiện hành. RLS bảng catalog/review mới không thu hồi URL ảnh đã công khai.
- Snapshot/tên món là dữ liệu do nhóm nhập; prompt không thể đảm bảo không bao giờ chứa tên người nếu người dùng tự đặt tên món như vậy. Worker không chủ động gửi các trường danh tính/ghi chú.

## Nguồn nhà cung cấp

- [Clerk: xác minh JWT](https://clerk.com/docs/guides/sessions/manual-jwt-verification) — chữ ký, issuer/time, authorized party.
- [Supabase: native Clerk integration](https://supabase.com/docs/guides/auth/third-party/clerk) — token người dùng và RLS.
- [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) — giới hạn đọc, bindings, xử lý lỗi.
- [Workers rate limits](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) và [AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) — locality và Free allocation.
