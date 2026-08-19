---
name: code-review
description: >
  Review code cho mevn-restaurant (lunch order tracker: Vue + Clerk + Supabase, không backend riêng).
  Review code local (in ra chat) hoặc Pull Request (comment lên PR).
  Mỗi finding gồm mức độ nghiêm trọng, test-case (hiện tại vs expect), và đề xuất code cụ thể (bảng từ->thành + lý do).
---

# code-review

Thực hiện review ngắn gọn, giá trị cao như một senior dev. Không viết lan man. Ưu tiên hàng đầu là
**vi phạm mô hình bảo mật (RLS/service_role)** và **lệch logic chéo giữa nơi dùng chung và nơi gọi**
(xem Bước 5). Đây là app không có backend riêng — mọi rào bảo mật nằm ở RLS Postgres, nên review sai
ở đây = lộ dữ liệu thật, không phải chỉ bug UI.

## Bước 1: Xác định chế độ

Hỏi người dùng (bỏ qua nếu họ đã nói rõ hoặc đưa link PR):

- **Local:** Review code đang thay đổi (working-tree/branch diff). Output in ra chat.
- **PR:** Review GitHub PR. Output comment trực tiếp lên PR.

## Bước 2: Lấy Diff

- **Local:** Dùng `git diff`, `git diff --staged` hoặc `git diff main...HEAD`. Mở các file xung quanh nếu cần thêm context.
- **PR:** Dùng `gh pr view <pr>` và `gh pr diff <pr>` (không dùng Git local).
- **Bỏ qua, không review:** file/folder bị `.gitignore` chặn, và file/folder có tên bắt đầu bằng `.`
  (`.claude/`, `.agents/`, `.env*`, v.v.) — đây là config/tooling, không phải code nghiệp vụ.

> **⚠️ Luôn chốt SHA trước:** Chạy `gh pr view <pr> --json headRefOid`. Phải đọc file đúng SHA này để tránh sai lệch dữ liệu khi dev vừa push commit mới.

**Kiểm tra file NGOÀI diff (nơi hay ẩn bug ở repo này):**

- **Diff đụng `supabase/migrations/*.sql`:** Mở file test tương ứng trong `tests/rls/*.test.js` — policy mới/đổi phải có test case cho cả nhánh **cho phép** lẫn **chặn**, không chỉ happy path.
- **Diff đụng schema JSON của `note`** (`dishes[]` — menu có cấu trúc OCR): mở cả 3 file dù không nằm trong diff — `src/composables/useOCR.js` (producer), `src/components/ui/MenuBoard.vue` (editor), `src/pages/MenuPage.vue` (tính tiền, match theo `d.name`) — đối chiếu tên field.
- **Diff đụng hợp đồng hành vi/data model/RLS:** mở `AGENTS.md` và `docs/superpowers/specs/2026-06-19-lunch-order-tracker-design.md` xem mô tả còn khớp code không.

## Bước 3: Tóm tắt Issue (Nguồn chân lý)

Issue là tiêu chuẩn **DUY NHẤT** để so sánh, không dùng PR description.

1. Tìm số Issue từ PR body (`Closes #N`) hoặc tên nhánh (`issue-<N>-...`).
2. Gọi subagent (model `sonnet`) để đọc issue: `gh issue view <N> --comments`.
3. Yêu cầu subagent trả về tóm tắt ngắn gọn (max 10 bullets): vấn đề, yêu cầu (acceptance criteria), scope rõ ràng. Chỉ trả về text tóm tắt.
   _Lưu ý: Nếu không tìm thấy Issue, hỏi user có muốn tiếp tục review chỉ dựa trên logic code (correctness-only) không._

## Bước 4: Thu dữ kiện (2 subagent, chạy song song)

Gọi cả 2 **cùng lúc với subagent Bước 3** — 3 tool call trong 1 message. Cả 3 chỉ đọc, không phụ thuộc nhau.

Ràng buộc chung, ghi vào cả 2 prompt:

- Chỉ **liệt kê dữ kiện** kèm `file:line`. KHÔNG kết luận đúng/sai, KHÔNG đề xuất fix.
- Không chắc thì ghi "không xác định". Cấm suy đoán từ tên file.
- Trả bảng/list ngắn gọn, không viết dài dòng.

**Subagent A — Grep cross-callsite.** Input: danh sách file thay đổi ở Bước 2. Repo này không có nhiều
"site"/"form" song song — điểm lệch thật nằm ở chỗ **1 component/composable dùng chung nhưng nhiều nơi gọi**.
Tự `grep -rn` để tìm mọi nơi dùng. Trả bảng `File/hàm đổi | Nơi gọi (file:line) | Đồng bộ chưa?`:

- Component `src/components/ui/*.vue` đổi props/emit → mọi nơi dùng nó trong `src/pages/*.vue`.
- Hàm export từ `src/composables/*.js` đổi tham số/return shape → mọi caller.
- Cột/policy trong `supabase/migrations/*.sql` đổi → có match với query trong `useOrders.js`/`useMenus.js` và test case trong `tests/rls/*.test.js` không.

→ dữ kiện cho tiêu chí 2 và 3.

**Subagent B — Quét cơ học.** Input: danh sách file thay đổi + file liên quan. Trả 4 list rời:

1. **Bảo mật:** grep `service_role`, `SERVICE_ROLE`, `SECRET_KEY`, `CLERK_SECRET`, hoặc code thêm serverless
   function/webhook mới trong diff. → tiêu chí 1
2. **Cây render chết:** mỗi `switch`/`v-if`-`v-else-if` chain/`{isX && ...}{isY && ...}` trong file thay đổi →
   điều kiện từng nhánh + input nào làm TẤT CẢ nhánh false. → tiêu chí 5
3. **Fallback:** mọi `?? default`, `|| fallback`, `if (!x) return`, `try { JSON.parse(...) } catch { return default }`
   trên luồng user + giá trị fallback cụ thể. → tiêu chí 6
4. **Ngày giờ:** mọi chỗ so sánh/tạo "hôm nay" hoặc date boundary dùng `new Date()`/`toISOString()` trực tiếp
   thay vì `todayInVN()` (`src/lib/date.js`). → tiêu chí 7

Tiêu chí 9-12 (comment, docs/changelog, đối chiếu issue, chung) main agent tự làm trên diff — cần judgment, đẩy sang subagent không lợi.

Mọi thứ 2 subagent trả về là **dữ kiện thô, chưa phải finding**. Main agent tự verify rồi mới kết luận ở Bước 5.

## Bước 5: Tiêu chí Review (Đặc thù Repo)

Sắp finding theo mức nghiêm trọng giảm dần, bỏ nitpick. **Tiêu chí 1-4 phải trace tới UI/RLS thật, không kết luận từ diff.** Tiêu chí 5-12 đọc diff là đủ.

1. **Vi phạm mô hình bảo mật (quan trọng nhất)** — dự án **không có backend riêng**, rào bảo mật DUY NHẤT là
   RLS Postgres. `service_role`/secret key (Supabase, Clerk) xuất hiện ở bất kỳ đâu trong frontend/client env =
   CRITICAL, bypass toàn bộ RLS. Thêm serverless function/webhook mới = phá mô hình, phải hỏi lại chủ dự án
   trước (xem AGENTS.md § Ràng buộc nền).
2. **Lệch logic chéo giữa nơi dùng chung và nơi gọi** — sửa component (`ui/*.vue`) hoặc composable
   (`composables/*.js`) dùng ở nhiều `pages/*.vue` → check đã update đồng bộ mọi nơi gọi chưa (AGENTS.md yêu
   cầu "grep trước khi sửa"). Sót 1 nơi = drift âm thầm, không throw.
3. **RLS lệch với business rule / test** — đổi policy trong `supabase/migrations/*.sql` mà không có test
   tương ứng trong `tests/rls/*.test.js` cho cả nhánh allow lẫn deny = finding. Đặc biệt 3 bất biến cố định
   (AGENTS.md): (a) chỉ chủ đơn (`orders.user_id`) đổi được `is_paid` — không có "tick hộ"; (b) đặt hộ
   (`orders_insert with check (true)`) vẫn phải chặn khi `menus.is_closed = true`; (c) menu có cấu trúc OCR
   (`dishes[]` hợp lệ) bắt buộc chọn từ MenuBoard, không cho free text.
   _Vd: 0004_close_ordering.sql chặn insert/delete khi `is_closed` nhưng trigger chỉ chặn sửa `item_text`/`note`,
   cố ý cho sửa `is_paid` sau khi chốt — đổi 1 phía mà quên phía kia là bug im lặng._
4. **Schema ngầm của `note` JSON (`dishes[]`)** — không có type/schema chính thức, chỉ khớp ngầm giữa
   `useOCR.js` (sinh ra), `MenuBoard.vue` (sửa), `MenuPage.vue` (tính tiền bằng `d.name` match). Đổi tên field
   ở 1 nơi mà thiếu ở nơi khác → giá tiền tự tính âm thầm trả về `null`, không lỗi, không log.
5. **Nhánh render chết** — với `switch`/`v-if` chain, hỏi "input nào khiến TẤT CẢ nhánh false?". Trắng trang
   không throw, không log, test tay rất dễ sót.
6. **Fallback im lặng** — liệt kê mọi `?? default`, `|| fallback`, `if (!x) return`, `catch {}` nuốt lỗi trên
   luồng user, kèm input trigger. Đúng type nhưng sai nghiệp vụ vẫn là bug.
7. **Giờ Việt Nam (UTC+7)** — "hôm nay"/date boundary PHẢI qua `todayInVN()` (`src/lib/date.js`), không
   `new Date()`/`toISOString().split('T')[0]` trực tiếp. Lệch múi giờ → menu hiện sai ngày trong khung 0h-7h sáng VN.
8. **Migration không idempotent** — file mới trong `supabase/migrations/*.sql` phải chạy lại được nhiều lần an
   toàn (`drop policy if exists`, `add column if not exists`, như 0003/0004 đã làm). Không rollback tool riêng.
9. **Comment** — bắt comment sai/cũ/thiếu ở logic phức tạp. Ngôn ngữ tự do (repo dùng song ngữ VN/EN), không
   ép 1 ngôn ngữ. Bỏ qua tag `// ponytail:` (chủ đích, không phải nợ kỹ thuật).
10. **Docs & changelog** — đổi hợp đồng hành vi/data model/RLS phải update `AGENTS.md` +
    `docs/superpowers/specs/2026-06-19-lunch-order-tracker-design.md` trong CÙNG PR. Mọi PR có thay đổi
    user-facing phải có entry mới trong `src/changelog.json` (bullet tiếng Việt, dễ hiểu người dùng cuối,
    không viết "Fix bug"/"Refactor").
11. **Đối chiếu issue** — thiếu yêu cầu hoặc dư scope so với tóm tắt Bước 3.
12. **Chung** — correctness, immutability, error handling, dead code, `console.log` sót lại.

## Bước 6: Format kết quả

Chỉ in danh sách finding, xếp theo độ nghiêm trọng. **KHÔNG** viết tóm tắt ở đầu, **KHÔNG** viết gợi ý/next steps ở cuối.

Dùng icon cho tiêu đề:

- 🔴 **HIGH** — Bug / Sai behavior tài liệu / Lộ bảo mật — Phải sửa trước khi merge.
- 🟠 **MEDIUM** — Lệch logic / Assumption chưa rõ — Cần check/sửa.
- 🟡 **LOW** — Dọn dẹp (Optional).

**Format chuẩn của 1 Finding:**

### 🔴 F1 — (Tiêu đề 1 dòng)

**Where:** `path/to/file:line`
**Hiện tại:** (Chuyện gì đang xảy ra, 1 dòng)
**Expect:** (Nên như thế nào, 1 dòng)
**Repro:** (chỉ 🔴 và 🟠) URL + các bước bấm + Actual quan sát được. Không viết được repro cụ thể thì hạ xuống 🟡, hoặc ghi **cần xác nhận** — chưa trace tới UI/RLS thật thì chưa biết finding có thật hay không.

Mỗi đề xuất thay đổi = 1 bảng HTML thô 2 cột, không header — trái = **before**, phải = **after**.
Bắt buộc `<table>` HTML thô (KHÔNG dùng bảng markdown `| |`) để fenced code block nhiều dòng render
cạnh nhau (chạy trên cả GitHub lẫn message). Chừa 1 dòng trống trước/sau fence bên trong `<td>`:

````html
<table>
  <tr>
    <td>```javascript is_paid: true, ```</td>
    <td>```javascript is_paid: true, paid_at: new Date().toISOString(), ```</td>
  </tr>
</table>
````

**Giải thích:** (Tại sao, 1-2 câu)

**Quy tắc bảng Before/After:**

- Áp dụng cho **mọi** thay đổi text: code, inline comment/docstring, và tài liệu (`.md`, `README`,
  `AGENTS.md`, spec docs). Bất kỳ khi nào đề xuất sửa text → hiện dưới dạng before/after.
- Chọn ngôn ngữ fence theo nội dung: `javascript` cho `.js`/script trong `.vue`, `vue` cho template/SFC,
  `sql` cho migration, `markdown` cho file `.md`/docs.
- Nếu **xóa**: ô phải chỉ ghi `` `xóa` `` (không cần fence).
- Chỉ hiện dòng thay đổi, không dán cả function/đoạn.
- Nếu cần dev tự quyết định thay vì sửa code ngay, ghi **cần xác nhận** + (câu hỏi) thay vì vẽ bảng.
- Dùng ngôn ngữ của người dùng (mặc định Tiếng Việt). Giải thích ngắn — nếu giải thích dài hơn code,
  cắt bớt giải thích. Code/biến giữ nguyên.

## Bước 7: Trả kết quả theo chế độ

- **Local:** In kết quả trực tiếp ra chat.
- **PR:**
  1. In kết quả ra chat dưới dạng Draft.
  2. Yêu cầu user xác nhận trước khi comment.
  3. Nếu được xác nhận: Lưu nội dung vào file tạm (temp file), sau đó chạy `gh pr comment <pr> --body-file <tmpfile>`. Trả về URL của comment.
