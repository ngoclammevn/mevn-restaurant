# Lunch Excel Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xuất XLSX ba sheet gửi quán/theo người/chưa thu, khớp số tiền trên app và không sửa trạng thái thanh toán.

**Architecture:** Tải đủ dữ liệu do chủ menu quản lý, tạo mô hình export bằng helper tài chính chung rồi lazy-load ExcelJS trong trình duyệt. CSV nhanh vẫn tồn tại. Không có endpoint export ở Worker hoặc server.

**Tech Stack:** Vue 3, Supabase RLS, ExcelJS browser workbook, Vitest round-trip XLSX.

**Spec:** [Thiết kế](../specs/2026-10-29-slack-delivery-and-sponsor-proposal.md). **Depends on:** D2/D3 [domain](2026-10-29-lunch-domain.md), không phụ thuộc Slack/avatar/skeleton.

## Global Constraints

- Theo Global Constraints/commit protocol của [rollout](2026-10-29-lunch-rollout.md). Free tier, xuất ở frontend, không service_role.
- Chỉ chủ menu xuất đơn các menu của mình. Không import để tick trả hộ; is_paid và paid_at là self-tick của chủ đơn.
- Giá chưa biết là ô trống kèm trạng thái; được mời amountDue=0 riêng vendorAmount; dùng closure revision, không tính lại giá chốt từ menu hiện tại.
- Không đưa số điện thoại/thông tin ngân hàng/JWT vào workbook. Lấy đủ dữ liệu phân trang, không xuất nhầm phần đã tải là toàn bộ.

## Task E1: Dữ liệu export và số tiền chung

**Files:** tạo `src/lib/lunch-export.js`, `src/composables/useLunchExport.js`, `tests/unit/lunch-export.test.js`; sửa `src/lib/menu.js` (giữ exportMenuCsv) và `src/lib/manage-summary.js`.

**Interfaces:** `buildLunchExport({menus,orders,closures,closureItems,from,to})` trả `{buyRows,personRows,outstandingRows,meta}`; `loadLunchExport({menuId,from,to,signal})` trả đầy đủ các trang hoặc error, không trả kết quả một phần dưới tên hoàn tất.

- [ ] Viết test trước: 2 menu cùng ngày, A/B đã/chưa trả, C được mời, giá null, món nhiều dòng và note chứa dấu phẩy/tiếng Việt; snapshot cũ giữ 35000 dù menu giờ 40000; closure revision khác ghi rõ. Assert các total khớp `orderSettlement`.

```js
expect(model.personRows.find(row => row.userId === 'sponsored-user'))
  .toMatchObject({amountDue:0,paymentState:'sponsored'})
expect(model.outstandingRows.some(row => row.userId === 'sponsored-user')).toBe(false)
expect(model.personRows.find(row => row.userId === 'unknown-price').amountDue).toBeNull()
```

- [ ] Implement mapping gửi quán theo menu/món, người theo order ID, công nợ theo người/menu/ngày. Mỗi row giữ IDs trong model nội bộ; workbook hiển thị ngày/quán/người/món/note/số suất/vendorAmount/amountDue/state/paidAt khi có liên quan. Meta có export time VN, date filter, menu/closure revision và số dòng.
- [ ] Fetch poster-filtered menus và orders theo trang 100; tie-break ID, dedup, dùng signal/generation guard. Export riêng một menu phải fetch lại dữ liệu đầy đủ, không dùng nested orders có thể bị PostgREST row cap. Khi lỗi giữa trang, không tải xuống workbook nửa chừng, giữ filter và cho retry.
- [ ] Unit kiểm 101 và 1001 dòng qua nhiều trang, page fail, account switch, menu không thuộc mình bị từ chối. `test:unit`, commit `feat: build complete lunch reconciliation exports`.

## Task E2: XLSX/CSV và nút tải

**Files:** tạo `src/lib/lunch-workbook.js`, `src/components/LunchExportDialog.vue`, `tests/unit/lunch-workbook.test.js`; sửa ManagePage/OutstandingLedger, package.json/package-lock.json.

**Interfaces:** `createLunchWorkbook(model): Promise<ArrayBuffer>`; `downloadLunchWorkbook(buffer,filename): void`. ExcelJS chỉ import trong createLunchWorkbook; `loadLunchExport` là nguồn dữ liệu dùng chung CSV/XLSX.

- [ ] Kiểm [ExcelJS browser documentation](https://github.com/exceljs/exceljs#browser) tại thời điểm thực thi; `rtk proxy npm install --save-exact exceljs`, commit lockfile. Dùng document workbook và `workbook.xlsx.writeBuffer()`, không dùng Node filesystem/streaming writer trong browser.
- [ ] Test tạo workbook rồi load lại bằng ExcelJS:

```js
const buffer = await createLunchWorkbook(model)
const workbook = new ExcelJS.Workbook()
await workbook.xlsx.load(buffer)
expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(['Gui quan','Theo nguoi','Chua thu'])
expect(workbook.getWorksheet('Theo nguoi').getRow(2).getCell(1).type).toBe(ExcelJS.ValueType.String)
```

Fixture có text `=HYPERLINK(...)`, `+SUM(...)`, `@name`, dấu tiếng Việt và số null. Assert text là String, không Formula/Hyperlink object; số tiền là numeric/null, không chuỗi định dạng; số không biết có label, không bị thay thành 0. CSV tiếp tục escape quote/newline và prefix chống formula injection như helper hiện có.

- [ ] Ba sheet có title/meta, header đậm, freeze header, autofilter, wrap tên/note, cột tiền format `#,##0" đ"`; tổng chỉ cộng số đã biết và ghi số khoản chưa rõ. Tên file `don-com-YYYY-MM-DD.xlsx` hoặc khoảng ngày hợp lệ, không lấy filename thô từ tiêu đề người dùng.
- [ ] UI chọn một menu hoặc khoảng ngày của poster, preview số menu/đơn, XLSX và CSV. Loading/cancel giữ tương tác rõ; disable double submit; revoke object URL sau click; cancel trước save không tạo file; account đổi hủy download.
- [ ] Round-trip unit + build kiểm chunk ExcelJS lazy; mở workbook thật trong Excel/LibreOffice nếu có, kiểm tiếng Việt, filter và total; nếu không có app, ghi rõ giới hạn visual QA. Browser 1001 dòng và tải fail, commit `feat: export lunch workbooks with three reconciliation sheets`.

## Bàn giao

Không deploy riêng; frontend build của rollout chứa chức năng export. Bằng chứng gồm test đọc lại XLSX, số dòng/tổng so với UI và kiểm đủ trang; không commit workbook có dữ liệu người dùng thật.
