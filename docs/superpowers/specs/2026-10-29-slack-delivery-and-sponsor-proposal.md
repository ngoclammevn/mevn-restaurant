# Đề xuất — Điều phối đặt cơm, Slack, nhận hàng và bữa được mời

Ngày: 2026-10-29, giờ Việt Nam. Trạng thái: **đã được chủ dự án duyệt ngày 29/10/2026, với bổ sung số điện thoại lưu một lần và một Cloudflare Worker dùng chung cho AI + Slack**. Tài liệu chốt phạm vi; không phải biên bản đã triển khai hoặc deploy.

## Bối cảnh và mục tiêu

Ứng dụng dùng trong công ty, nhóm dưới 25 người. Một người đăng menu và gom đơn để đặt cho cả nhóm. Ngoài cơm trưa, có các đợt mua nước hoặc đồ ăn nhân dịp đặc biệt, một người mời và người nhận không cần trả tiền.

Người dùng yêu cầu xem PR hiện tại cải thiện gì, kiểm tra khả năng giữ dữ liệu cũ khi merge, đề xuất thêm các công cụ điều phối và trình duyệt ý tưởng trước khi triển khai. Không có yêu cầu merge, deploy, gửi Slack hay sửa database trong lượt review này.

## Review PR hiện tại

Nguồn: [PR #15 — Cải tiến toàn bộ trải nghiệm đặt cơm, quản lý và đánh giá món](https://github.com/ngoclammevn/mevn-restaurant/pull/15).

- Head được kiểm tra: `ebb3127d82b289324e2bb812857ca43bc9f58a16`.
- Main hiện tại trên GitHub: `ca986c2b41d16ebd5a37a24a39af7ce93c76aab8`.
- PR phát triển từ `e13f916aabcc43c7a824654f3487f35bf91dac66`, thay đổi 126 file.
- Checkout gốc đang có nhiều thay đổi chưa commit. Review và kiểm thử dùng bản chụp đúng commit của PR tại `/private/tmp/lunch-pr15-review-f8xv3x8o`, không dùng thay đổi local làm bằng chứng cho PR.

| Nội dung | Đã có trong PR |
| --- | --- |
| Trải nghiệm đặt cơm | Giao diện Today/Menu/Post/Manage/History/Profile được tổ chức lại; có xác nhận trước khi đặt và xem trước khi đăng menu |
| Quản lý menu | Bảng theo món, số suất, theo người, lọc đã trả/chưa trả, chốt và mở lại, báo hết món, tái dùng menu |
| Khoản chưa thu | Gom theo người; tách hôm nay và các ngày trước; có bộ lọc tuổi khoản, tìm kiếm, tải thêm; không tự xem giá chưa biết là 0 |
| Lịch sử | Lịch tháng và chi tiết ngày; các thao tác thanh toán/đánh giá của chủ đơn |
| Quán và đánh giá | Danh tính món theo quán, đánh giá từng món, sao/cảm nhận/ghi chú; thống kê khẩu vị 90 ngày |
| AI | Có source Worker gợi ý cảm nhận và fallback cục bộ; mã nguồn không chứng minh dịch vụ đang hoạt động trong môi trường thật |
| Excel | Xuất CSV từng menu với ngày, quán, người đặt, món, ghi chú và trạng thái thanh toán. Chưa có workbook XLSX đối soát nhiều sheet, giá trị phải thu và công nợ nhiều ngày |
| Slack và nhận cơm | Chưa có bot đăng tin, thread theo ngày, liên kết Slack ID, đăng ký nhận cơm, số điện thoại hoặc bốc thăm |
| Bữa được mời | Chưa có trạng thái nghiệp vụ phân biệt với đơn phải tự trả |
| ASCII skeleton | Chưa tích hợp |

Đặt hộ, self-tick thanh toán, chốt/mở lại, QR và chia sẻ link đã tồn tại trong baseline ở mức khác nhau. PR cải thiện các luồng này, không nên mô tả tất cả là tính năng mới.

### Việc cần giải quyết trước khi merge

GitHub trả `mergeable=false`, `mergeable_state=dirty`. Kiểm tra merge ba chiều thấy ba file cùng bị sửa:

- `src/changelog.json`.
- `src/composables/useDashboard.js`.
- `src/pages/DashboardPage.vue`.

Main đã bổ sung thống kê theo khoảng ngày và dashboard khoản chưa thu sau khi PR tách nhánh. Bản PR biến DashboardPage thành wrapper của workspace quản lý, và useDashboard không chứa `fetchStatistics` của main mới. Khi giải quyết xung đột cần tích hợp cả chức năng mới trên main; chọn toàn bộ bản PR có thể làm mất màn hình/chức năng thống kê hiện có dù các dòng dữ liệu trong DB vẫn còn.

## Dữ liệu cũ khi phát hành

Migration catalog bổ sung năm bảng `restaurants`, `restaurant_dishes`, `menu_items`, `order_items`, `dish_reviews` và một số cột vào bảng hiện tại. Không có bước xóa/reset ba bảng nghiệp vụ cũ.

- Giữ ID menu/đơn và quan hệ người sở hữu.
- Giữ món, ghi chú, `is_paid`, `paid_at`, thông tin chuyển khoản và lịch sử cũ.
- Menu có cấu trúc hợp lệ được bổ sung danh tính món; JSON có thể được chuẩn hóa và thêm ID.
- Chỉ nối tên món cũ khi khớp chính xác. Món nhập tay, tên không khớp hoặc JSON không tương thích được giữ thành snapshot chưa liên kết, không đoán quán hoặc giá.
- Migration compatibility giữ `order_deadline` hiện hữu và thêm `is_closed`; các deadline đã qua được chuyển sang trạng thái chốt.
- Giá trong quản lý hiện được tính theo giá hiện có của menu. Đây chưa phải sổ kế toán đóng băng giá tại lúc đặt/chốt. Nếu bổ sung đối soát tài chính cần quyết định mốc cố định giá và lưu giá tại mốc đó.

Merge Git và áp dụng migration DB là hai thao tác khác nhau. Giữ dữ liệu còn phụ thuộc việc release dùng đúng Supabase project và Clerk instance. Thay project hoặc định danh đăng nhập có thể làm dữ liệu trông như bị mất dù database cũ vẫn còn.

Theo [biên bản 04/10](../../review/2026-10-04-verification.md), migration đã từng chạy trên project `zabttnzoxdgfwpioqcrk`, giữ nguyên 11 menu và 34 đơn. History thật được ghi là `20261004014918_close_ordering_compat` và `20261004015046_lunch_catalog_reviews`, khác timestamp file trong repo. Đây là bằng chứng lịch sử, không phải số lượng hiện tại.

Trong lượt 29/10, connector liệt kê project này ở trạng thái `INACTIVE`; truy vấn migration history timeout. Không khôi phục project hay thay dữ liệu. Do đó chưa thể xác nhận schema/history/count của database thật hôm nay.

Trước release cần:

1. Giải quyết xung đột với main và giữ thống kê đã có.
2. Đối chiếu đúng project/Clerk, schema và migration history thật; sao lưu dữ liệu trước thay đổi schema.
3. Chỉ áp dụng migration còn thiếu. Không chạy lại migration tạo bảng chỉ vì timestamp local và remote khác nhau; không reset DB để xử lý khác biệt history.
4. Kiểm bản preview với dữ liệu cũ và hai tài khoản: đặt hộ, chủ đơn tự trả sau khi chốt, menu text và menu cấu trúc.
5. Kiểm số menu/đơn, trạng thái thanh toán và thông tin chuyển khoản trước/sau. Nếu rollback giao diện, giữ schema mở rộng cho đến khi đánh giá tương thích; không drop các bảng mới để rollback UI.

### Kiểm chứng trong lượt review

Trên bản chụp PR, Node 22.23.4:

- Unit: 20/20 test qua.
- PostgreSQL nhúng: 22 assertion và 12 thao tác bị từ chối đúng quyền qua.
- Bài kiểm bổ sung với dữ liệu mẫu: so sánh trước/sau migration giữ nguyên các trường gốc của đơn (gồm ID, chủ đơn, món, ghi chú, `is_paid`, `paid_at`, timestamp), profile/thông tin chuyển khoản và danh tính menu.
- Vue production build: qua; còn hai cảnh báo annotation của VueUse.
- Worker: 19/19 test ngoại tuyến qua; TypeScript qua.

Kiểm DB dùng PostgreSQL nhúng một kết nối, không chứng minh tranh chấp nhiều transaction. Không chạy E2E với Clerk/Storage/Realtime thật, không gọi inference AI thật. GitNexus đang index checkout gốc, chưa index head PR; không dùng kết quả graph local như thống kê đầy đủ phạm vi PR.

## Yêu cầu người dùng đã nêu cho đợt tiếp theo

1. Đăng menu thành công thì bot cập nhật link vào kênh đặt cơm và tạo topic theo ngày.
2. Người đăng/chủ menu có nút chủ động gửi link và hình menu vào kênh chung.
3. Khi chốt đơn, bot thông báo trạng thái và nhắc người nhận cơm bằng tag Slack.
4. Khi đặt món, hỏi hôm nay người dùng có thể xuống nhận cơm hay không. Nếu có và chưa lưu số điện thoại thì yêu cầu nhập, kiểm định dạng và lưu một lần. Đã có số thì dùng lại, không hỏi nhập lại; người dùng đổi số ngay trong menu được.
5. Chủ menu có thể bốc thăm người nhận cơm từ danh sách phù hợp và xác nhận khi chốt.
6. Có công cụ Excel để người đăng quản lý đơn, đã trả/chưa trả và đối soát.
7. Hỗ trợ đợt mua nước/đồ ăn được mời, không yêu cầu người nhận thanh toán.
8. Áp dụng hiệu ứng từ [ascii-reveal](https://github.com/quanhoangindex/ascii-reveal) cho skeleton.
9. Avatar dùng mascot động từ [page-mascot](https://github.com/nilbuild/page-mascot) khi tài khoản chưa có ảnh; có bộ mẫu, gán mặc định ổn định theo người và cho mỗi người tự chọn mascot hoặc tải avatar lên.

## Phương án đã duyệt

### Slack và kiến trúc

**Dùng một Cloudflare Worker chung cho AI và Slack**, mở rộng Worker hiện có trong `ai-worker/`. Một địa chỉ API, một cấu hình triển khai và một lần deploy Worker cho cả hai chức năng. Giữ thư mục hiện tại trong bước đầu để tránh đổi đường dẫn và cấu hình không cần thiết.

- `/v1/feedback-suggestions`: giữ endpoint AI hiện có, dùng Workers AI binding và fallback cục bộ.
- `/v1/slack/*`: các endpoint đăng menu, chia sẻ kênh chung, thông báo chốt và cập nhật người nhận. Dựng nội dung từ dữ liệu được phép đọc, kiểm quyền chủ menu trước thao tác điều phối.
- `/health`: kiểm tra Worker chung.
- Chung xác thực phiên Clerk, CORS và kết nối Supabase bằng JWT người dùng/RLS; kiểm quyền riêng theo từng hành động. Không dùng Supabase service_role.
- Token Slack lưu dưới dạng secret `SLACK_BOT_TOKEN` của Worker; không đặt vào frontend hoặc biến `VITE_*`. Các ID kênh là cấu hình phía Worker.
- AI và Slack có giới hạn gọi, timeout và xử lý lỗi riêng. AI hết quota hoặc inference lỗi không chặn gửi Slack. Cả hai dùng chung tài nguyên/runtime của một Worker nên cần kiểm tổng sử dụng trong free tier.
- Trạng thái thread, sự kiện gửi và chống trùng lưu bền trong Supabase, có RLS/RPC cho các thao tác nguyên tử. Không thêm KV, D1, Queue hoặc Worker thứ hai trong phạm vi này; không lưu trạng thái quan trọng chỉ trong bộ nhớ Worker.

Cloudflare hỗ trợ [fetch handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/), [Workers AI binding](https://developers.cloudflare.com/workers-ai/configuration/bindings/) và [secrets](https://developers.cloudflare.com/workers/configuration/secrets/) trong cùng Worker. [Workers có free tier](https://developers.cloudflare.com/workers/platform/pricing/); không tự bật trả phí.

Chủ dự án đã duyệt mở rộng phạm vi backend cho Slack và dữ liệu/RLS liên quan trong lần phản hồi ngày 29/10/2026. Các ràng buộc frontend static, RLS, self-tick và không dùng service_role tiếp tục áp dụng.

Dùng **một thread/ngày theo giờ VN trong kênh đặt cơm**, tạo khi menu đầu tiên của ngày lưu thành công. Nhiều menu cùng ngày nằm trong cùng thread, từng tin có link đúng menu. Ngày không ai đăng thì không tạo thread rỗng; chưa cần cron chạy mỗi sáng. Slack hỗ trợ trả lời vào thread bằng [`thread_ts`](https://docs.slack.dev/reference/methods/chat.postMessage/).

Nút **Đăng kênh chung** cho chủ menu xem trước ảnh, tên quán, link và nút đặt món; sau đó bot gửi vào kênh chung đã cấu hình. Tách kênh đặt cơm và kênh chung vì người dùng đã mô tả hai nơi. Chỉ chủ menu kích hoạt; không tự thêm thông báo cho cả kênh.

Khi chốt: lưu trạng thái chốt và người nhận cuối cùng trước, sau đó gửi thông báo. Slack lỗi không mở lại menu hoặc làm mất đơn; giao diện hiện trạng thái gửi và cho thử lại. Trạng thái gửi và thông tin thread phải lưu bền, có chống tạo trùng khi bấm nhiều lần hoặc nhiều menu được tạo đồng thời. Khi timeout không rõ kết quả, cần đối chiếu trạng thái trước khi gửi lại.

Người dùng cần liên kết tài khoản app với Slack user ID; không tag bằng cách đoán tên hiển thị. Slack mention dùng [ID người dùng](https://docs.slack.dev/messaging/formatting-message-text/#mentioning-users). Bot chỉ có quyền gửi cần thiết vào các kênh được cấu hình. Phần nhận tương tác trực tiếp trong Slack có thể làm ở đợt sau; đợt đầu các nút trong tin dẫn về app.

### Người nhận cơm

- Hỏi trong bước xác nhận đặt món: “Hôm nay bạn có thể xuống nhận cơm không?”. Hỏi một lần trong ngày và có chỗ thay đổi lựa chọn trước khi chốt.
- Số điện thoại lưu một lần theo tài khoản trong database, dùng lại qua các ngày và các thiết bị. Chỉ yêu cầu nhập khi người dùng chọn có thể nhận cơm mà chưa có số hợp lệ; đã có thì không mở lại bước hỏi số hoặc bắt nhập/xác nhận lại mỗi ngày.
- Trong menu có mục “Số điện thoại nhận cơm” và nút “Đổi số” cho chính chủ. Đổi số cập nhật số đã lưu cho những lần sau và số liên hệ của phân công đang hoạt động của người đó trên menu; không tự đổi người nhận, nội dung đơn hay trạng thái chốt. Không viết lại lịch sử lượt nhận đã hoàn tất.
- Chuẩn hóa số dạng trong nước/`+84`, kiểm định dạng di động VN ở cả UI và tầng ghi dữ liệu khi thêm hoặc đổi số. Việc hỏi khả năng nhận cơm vẫn theo từng ngày, độc lập với số điện thoại đã lưu.
- Lưu khả năng nhận theo người/ngày; mỗi người chỉ xuất hiện một lần trong danh sách bốc thăm dù có nhiều đơn.
- Đặt hộ không tự đồng ý nhận cơm hoặc cung cấp số điện thoại thay người nhận. Người được đặt hộ xác nhận khả năng nhận của chính họ.
- Khi chốt, chủ menu thấy danh sách, bấm bốc thăm, có thể chọn lại hoặc chọn thủ công rồi xác nhận. Không có ứng viên thì hiện rõ và cho chủ menu quyết định cách nhận hàng.
- Lưu người được phân công theo menu/lượt giao để lần mở lại trang không bốc thăm lại. Mở lại đơn không tự đổi người nhận; thay đổi phải xác nhận và cập nhật thông báo.
- Có người dự phòng và ưu tiên người ít nhận gần đây; chỉ tag người dự phòng khi thực sự được chọn thay người chính.
- Số điện thoại nằm trong dữ liệu có quyền riêng: chính người đó và chủ menu cần điều phối được đọc. Không thêm vào profile vốn được cả nhóm đọc mà không điều chỉnh quyền; không đưa số vào tin Slack công khai hoặc presence.

### Bữa được mời

Menu có lựa chọn **Tự thanh toán** hoặc **Được mời bởi …**. Đợt đầu áp dụng cho cả menu, phù hợp một người mời nước/đồ ăn cho nhóm.

Đơn được mời hiện “Được mời”, không vào danh sách tiền chưa thu của người ăn và không yêu cầu tick đã trả. Giữ riêng danh tính người ăn/chủ đơn và người tài trợ. Không đổi hàng loạt `is_paid=true` để giả lập được mời; self-tick vẫn là xác nhận của chủ đơn với đơn cần trả.

Giá quán bán và số tiền người ăn phải trả là hai giá trị khác nhau khi có người mời. Dữ liệu cũ mặc định theo hành vi hiện tại, không tự chuyển đơn chưa trả thành được mời. Tài trợ một phần hoặc mời riêng từng người là phạm vi bổ sung, chưa mặc định triển khai.

### Excel và đối soát

Xuất XLSX ở frontend với ba sheet:

| Sheet | Nội dung |
| --- | --- |
| Gửi quán | Món, số suất, ghi chú để gom đặt |
| Theo người | Người ăn, món, số tiền cần trả, đã/chưa trả hoặc được mời, thời điểm tự xác nhận |
| Chưa thu | Khoản còn thiếu theo người/menu/khoảng ngày, tổng tiền đã biết, số khoản chưa xác định giá |

Giữ CSV để xuất nhanh. Số tiền phải dùng cùng quy tắc với ứng dụng; giá chưa biết không thành 0. Cố định giá tại lúc chốt; chỉnh giá menu sau này không làm đổi bảng đối soát đã chốt. Điều chỉnh khoản đã chốt cần lưu dấu thay đổi rõ ràng.

Người thu chỉ xem và xuất trạng thái. Không thêm chức năng import Excel để đánh dấu thanh toán hộ hoặc thay đổi `is_paid` của người khác.

### ASCII skeleton

Package có export [`ascii-reveal/core`](https://github.com/quanhoangindex/ascii-reveal/blob/main/src/core/index.ts), gồm `asciiSkeletonHTML`, `animateSkeletons` và `createAsciiReveal`; có thể bọc thành component Vue mà không cần thêm một cây React.

Đề xuất dùng skeleton dạng dither nhẹ ở thẻ menu, danh sách quản lý và lịch sử. Giữ kích thước khung để không nhảy bố cục; hiện dữ liệu ngay khi sẵn sàng. Hiệu ứng decode lúc dữ liệu hiện là tùy chọn, không buộc người dùng chờ thêm để bấm đặt món. Tôn trọng reduced motion, dừng khi ra khỏi màn hình/tab nền, dọn animation khi unmount và đánh dấu loading phù hợp cho trình đọc màn hình. Kiểm tra trên mobile và mạng chậm trước khi mở rộng toàn app.

### Avatar cá nhân và mascot động — yêu cầu bổ sung 29/10

Nguồn: [page-mascot](https://github.com/nilbuild/page-mascot), MIT. [Component gốc](https://github.com/nilbuild/page-mascot/blob/main/src/mascot.tsx) dùng React và hai sprite sheet 3×3 cho hướng nhìn/biểu cảm. Chuyển component tương đương sang Vue để dùng trong component Avatar chung, giữ thông tin giấy phép. Không thêm runtime React cho avatar, không gọi AI để tạo mascot mỗi lần đăng nhập.

Hành vi theo yêu cầu người dùng:

- Giữ ảnh thật đang có ở chế độ tự động; chỉ dùng mascot mặc định khi chưa có ảnh, provider chỉ trả ảnh placeholder hoặc ảnh tải lỗi. Phân biệt ảnh thật với placeholder của provider, không chỉ kiểm tra URL có rỗng hay không.
- Bộ đầu gồm tám mẫu có sẵn: **cáo (`fox`), mèo (`cat`), thỏ (`bunny`), gấu trúc (`panda`), chim cánh cụt (`penguin`), rái cá (`otter`), robot (`robot`), đầu bếp (`chef`)**. Đóng gói sprite sheet tĩnh cùng frontend, không phụ thuộc hotlink đến website tác giả.
- Mỗi tài khoản chưa có lựa chọn được gán một mascot mặc định và lưu lại. Trước khi lưu có thể dùng seed từ ID tài khoản để hiển thị nhất quán. Không random lại khi refresh, chuyển trang hoặc đăng nhập; không hứa mỗi người có một mẫu duy nhất vì bộ mẫu có thể ít hơn số thành viên.
- Mục Avatar trong Hồ sơ có ba chế độ: **Tự động (ảnh tài khoản hoặc mascot mặc định)**, **Chọn mascot**, **Tải ảnh lên**. Có xem trước, chọn mẫu và nút random để đổi sang một mẫu khác; chỉ lưu khi người dùng xác nhận.
- Cho phép chọn mascot kể cả đang có ảnh Google; có thể quay về chế độ tự động hoặc đổi ảnh đã tải lên. Lưu lựa chọn theo tài khoản, đồng bộ trên các thiết bị và mọi chỗ hiển thị avatar: người đăng menu, đơn, danh sách quản lý và hoạt động chung.
- Tách lựa chọn/cấu hình avatar khỏi `avatar_url` được đồng bộ từ provider. `ensureProfile` hiện upsert ảnh Clerk mỗi lần đăng nhập; phải giữ nguyên chế độ, mascot và ảnh tùy chỉnh đã lưu, không ghi đè chúng khi provisioning.

Chuyển động và tương tác:

- Avatar mascot nhìn theo chuột trên thiết bị có con trỏ chính xác; chạm/bấm để có phản ứng ngắn như chớp mắt, vui hoặc tim. Có thể chớp mắt thưa khi đứng yên, không làm xê dịch bố cục.
- Trên mobile dùng phản ứng chạm, không bật theo dõi chuột giả. Trong hàng đơn, phản ứng không chặn thao tác mở menu hoặc tạo phần tử button lồng nhau.
- Dùng chung bộ theo dõi con trỏ cho các mascot đang hiện; dừng timer/listener khi ngoài màn hình, tab nền hoặc unmount. Tôn trọng reduced motion, không bounce hoặc chạy chuyển động liên tục trong chế độ này.
- Ảnh người dùng tải lên là ảnh tĩnh. Không tự làm biến dạng khuôn mặt hoặc tạo mascot từ ảnh người dùng.

Upload và quyền:

- Ảnh JPG/PNG/WebP, tối đa 2 MB; có crop vuông/xem trước. Kiểm định dạng thực, kích thước và khả năng giải mã trước upload; cấu hình bucket giới hạn MIME/kích thước tương ứng. Không nhận SVG/HTML.
- Dùng Supabase Storage hiện có, bucket avatar riêng và đường dẫn theo Clerk user ID. RLS chỉ cho chính chủ upload/thay/xóa ảnh của mình; người dùng khác chỉ đọc avatar được dùng để hiển thị.
- Cập nhật lựa chọn profile cũng chỉ chính chủ. Khi thay ảnh, lưu ảnh mới và cập nhật profile thành công rồi mới dọn ảnh cũ; lỗi upload/lưu phải giữ avatar cũ.
- Giữ nguyên ảnh hiện tại của tài khoản cũ. Mascot không thay đổi định danh, quyền đơn hoặc dữ liệu thanh toán. Quyền số điện thoại riêng tư tiếp tục độc lập với profile/avatar.

Tiêu chí nghiệm thu: tài khoản không ảnh có mascot ổn định trên hai thiết bị; tài khoản có ảnh thật giữ ảnh; đổi mascot/upload ảnh rồi đăng nhập lại vẫn giữ lựa chọn; ảnh lỗi có fallback; kiểm mobile/reduced motion/danh sách nhiều avatar; người A không ghi hoặc xóa avatar của B.

Phần này chỉ bổ sung migration/profile/Storage policies và frontend trong các hạng mục deploy đã có. Không thêm Worker, dịch vụ tạo ảnh hay chi phí AI. Đây là yêu cầu mới đã được ghi nhận để triển khai, chưa phải tính năng đã có trong PR #15.

## Các bổ sung được chấp thuận cùng phạm vi

- Nút “Đã nhận cơm” cho người được phân công; bot cập nhật trong thread và chủ menu biết hàng đã tới.
- Một người dự phòng, chỉ tag người dự phòng khi thật sự thay người chính.
- Nhắc trước giờ chốt một lần, chủ menu bật/tắt cho từng menu; chưa tự tạo lịch nhắc trong lượt review.
- Lưu lý do đợt được mời, ví dụ sinh nhật hoặc hoàn thành dự án, để lịch sử dễ nhớ.
- Hạn chế sửa giá sau chốt hoặc tạo điều chỉnh có lịch sử thay vì thay số tiền cũ âm thầm.
- Ưu tiên lưu trữ menu đã có đơn thay vì xóa để giữ lịch ăn, đánh giá và đối soát.

## Các hạng mục triển khai và deploy, gom gọn

| Nơi | Thay đổi cần phát hành | Cách quản lý |
| --- | --- | --- |
| Supabase hiện tại | Migration bổ sung số liên hệ riêng tư, đăng ký nhận theo ngày, phân công, thông tin được mời, giá chốt, trạng thái thông báo và lựa chọn avatar; RLS/RPC và bucket avatar với Storage policies tương ứng | Giữ project và dữ liệu cũ; đối chiếu history, sao lưu và chỉ chạy migration thiếu |
| Cloudflare | **Một Worker AI + Slack**: thêm endpoint Slack, dùng lại xác thực, thêm secret bot và cấu hình kênh | Một Worker, một API base URL, một cấu hình và một lần deploy; giữ AI binding, kiểm hạn mức chung |
| Vercel hiện tại | Giao diện nhận cơm/đổi số, bốc thăm, được mời, XLSX, skeleton, thao tác Slack và avatar mascot/chọn ảnh/upload | Một lần build/deploy frontend sau khi DB và Worker tương thích; dùng cùng API base URL cho AI và Slack |
| Slack workspace | Tạo/cấu hình Slack App, cấp quyền tối thiểu, cài vào workspace, mời bot vào hai kênh và lấy ID kênh | Setup một lần hoặc cập nhật quyền khi cần; không phải thêm server hay một Worker riêng |

Clerk tiếp tục dùng instance và phiên đăng nhập hiện có, không cần thêm hệ thống đăng nhập. Không thêm project Supabase, máy chủ hoặc cơ sở dữ liệu Cloudflare riêng. Trạng thái gửi được lưu trong Supabase; app thể hiện trạng thái chờ/lỗi và cho thử lại nếu việc gọi Worker bị gián đoạn.

Thứ tự phát hành: giải quyết xung đột main → đối chiếu/sao lưu và chạy migration thiếu → cấu hình Slack App/secret → deploy Worker chung → deploy Vercel → kiểm hai tài khoản và kiểm thông báo trong kênh thử đã được cho phép. Migration mở rộng phải giữ tương thích để frontend cũ vẫn hoạt động trong lúc chuyển phiên bản.

## Thứ tự thực hiện

1. Giải quyết xung đột PR #15, bảo toàn thống kê trên main, đối chiếu DB và phát hành nền tảng hiện tại.
2. Mở rộng Worker hiện có cho Slack; triển khai số điện thoại lưu một lần/đổi trong menu, đăng ký nhận cơm, phân công khi chốt và chế độ được mời.
3. Hoàn thiện XLSX/giá đối soát, tích hợp skeleton và avatar mascot/chọn ảnh/upload; kiểm thử theo các luồng thực tế.

Các quyết định đã chốt: một Worker chung AI + Slack; một thread/ngày; số điện thoại lưu một lần và đổi ngay trong menu; được mời cho cả menu; cố định giá tại lúc chốt. Tên kênh/ID Slack và cấu hình triển khai lấy từ môi trường đúng khi thực hiện, không tự đoán. Chấp thuận thiết kế không đồng nghĩa đã chạy migration, merge, gửi thông báo hoặc deploy production.
