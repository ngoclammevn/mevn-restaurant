# API và luồng dữ liệu

[Kiến trúc](README.md) · [Dữ liệu](data-model.md) · [Triển khai](deployment.md) · [Bảo mật](../security/README.md)

## Vue → Supabase

[`useSupabaseClient`](../../src/lib/supabase.js) tạo Supabase client bằng URL/publishable key công khai, lấy token từ phiên Clerk hiện tại cho từng request. Composable ở [`src/composables/`](../../src/composables/) thực hiện CRUD. RLS, constraint và trigger trong DB là rào quyền ghi; ẩn nút trong Vue chỉ phục vụ trải nghiệm.

- Menu có cấu trúc được lưu qua RPC `save_lunch_menu`; trigger đồng bộ `menu_items` trong cùng giao dịch. RPC chạy `SECURITY INVOKER`.
- Đặt/sửa đơn ghi `orders`; trigger tạo/cập nhật `order_items` và snapshot. Đặt hộ gán chủ đơn là người nhận.
- Thanh toán chỉ cập nhật đơn chính chủ. `is_closed` không chặn thao tác trả tiền.
- Đánh giá ghi `dish_reviews` sau khi người dùng xác nhận. RLS kiểm quyền trên order item và ngày menu theo giờ Việt Nam.
- Profile được client upsert khi đăng nhập; không dùng webhook.

Tên hàm và tham số cụ thể nằm trong code composable và migration; tài liệu `domain/frontend-api.md` cũ được giữ làm lịch sử, không dùng làm hợp đồng cho UI hiện tại.

## Vue → Worker AI

Base URL công khai: `VITE_AI_API_BASE_URL`. Credential API chính là token Clerk của phiên đang đăng nhập. Không cần API key riêng, và khóa tĩnh đóng trong Vue không thể giữ bí mật.

```http
POST /v1/feedback-suggestions
Origin: https://<app-origin>
Authorization: Bearer <current Clerk session token>
Content-Type: application/json
```

```json
{
  "order_id": "11111111-1111-4111-8111-111111111111",
  "order_item_ids": ["22222222-2222-4222-8222-222222222222"],
  "locale": "vi"
}
```

Request có đúng ba trường trên, tối đa 16 KiB, 1–20 UUID item duy nhất; UUID được chuẩn hóa chữ thường. Worker không nhận prompt, tên người, ghi chú hoặc tên món từ request. Worker tải tên snapshot/nhóm món qua Supabase bằng cùng user JWT, kiểm từng ID thuộc đúng đơn/menu và chủ đơn là `sub` trước khi dùng cache/inference.

```json
{
  "version": "1",
  "suggestions": [{
    "order_item_id": "22222222-2222-4222-8222-222222222222",
    "labels": ["Thịt mềm", "Hơi dai", "Ướp vừa", "Hơi mặn"],
    "source": "ai"
  }]
}
```

Thứ tự item khớp request. `source` là `ai` cho kết quả model/cache hoặc `fallback` khi AI timeout/lỗi/quota/output không hợp lệ. Nhãn phải qua validation; model không ghi review hoặc chọn số sao. Client hiển thị nhãn như text và người dùng quyết định lưu gì. [`shared/feedback.js`](../../shared/feedback.js) là nguồn contract dùng chung.

| Status | Ý nghĩa |
| --- | --- |
| 200 | Nhãn hợp lệ hoặc dự phòng |
| 400 | JSON/schema/ID/locale không hợp lệ |
| 401 | Token thiếu, sai chữ ký/issuer/thời hạn/azp |
| 403 | Origin bị chặn, đơn/item không thuộc người dùng hoặc ngày chưa hợp lệ; không lộ chi tiết ID |
| 404 / 405 | Sai endpoint hoặc method |
| 408 / 413 | Đọc body quá thời gian hoặc quá 16 KiB |
| 429 | Giới hạn theo user/dịch vụ; `Retry-After: 60` |
| 503 | Chưa cấu hình hoặc không đọc được ngữ cảnh Supabase |

Các lỗi xác thực/quyền không đi qua inference hoặc cache. Vue có thể dùng nhãn dự phòng cục bộ khi API lỗi; việc lưu đánh giá vẫn phải qua RLS. Response API có `Cache-Control: no-store`; cache nhãn nội bộ là cơ chế khác.

`OPTIONS` chỉ cho origin cụ thể, method `POST`, header `Authorization, Content-Type`. Không dùng cookie cross-origin. `GET /health` chỉ trả `{"version":"1"}`; đây là kiểm tra tiến trình, **không kiểm chứng cấu hình, JWKS, DB hoặc inference**.
