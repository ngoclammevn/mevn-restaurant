# Hướng dẫn Merge, Deploy và Rollback trên main

Cập nhật ngày 30/10/2026. Đợt này nâng cấp app đang chạy trên `main`, dùng lại website, Clerk, Database và Storage hiện tại. Một Cloudflare Worker xử lý cả AI lẫn Slack. Giữ các dịch vụ trong free tier.

> **Backup code + Database + toàn bộ file Storage, rồi restore thử ở môi trường riêng trước khi Merge, chạy Migration hoặc Deploy Production.**

Làm theo thứ tự: chuẩn bị máy và cấu hình → backup/restore thử → đối chiếu rồi chạy Migration còn thiếu → cập nhật Worker → Merge/Deploy website → kiểm dữ liệu và luồng thật. Vercel có thể tự Deploy ngay sau Merge, nên cần chuẩn bị Database, Worker và env trước.

Tài liệu này hướng dẫn các bước cần làm; chưa có xác nhận backup, restore, Migration hoặc Deploy Production cho đợt này.

Phạm vi: Vue/Vercel hiện có, Supabase Database + Storage, Clerk native integration hiện có, **một Cloudflare Worker chung cho AI và Slack**, Slack App. Các API Vercel OCR/share/OG có sẵn tiếp tục tồn tại; đợt này không thêm server hay chuyển OCR sang Worker. Đọc cùng [đặc tả đã duyệt](../superpowers/specs/2026-10-29-slack-delivery-and-sponsor-proposal.md), [tổng quan thay đổi](../review/2026-10-29-company-lunch-overview.md), [Worker](../../ai-worker/README.md) và [bảo mật](../security/README.md).

## 0. Chuẩn bị máy chạy lệnh

Đợt này **cập nhật chồng lên main đang chạy production**, dùng lại database, đơn, thanh toán và ảnh cũ. Không tạo app hoặc database mới để thay dữ liệu hiện tại. Trước merge phải backup code + Database + Storage, restore thử ngoài live, rồi chỉ chạy migration còn thiếu đã đối chiếu ở phần 3–4.

Cài **Git** và **Node.js 22 LTS từ 22.18 trở lên**; npm đi kèm Node. Có thể tải bộ cài từ [Node.js](https://nodejs.org/en/download) và [Git](https://git-scm.com/downloads). Đóng/mở lại Terminal sau khi cài rồi kiểm:

```sh
node --version
npm --version
git --version
```

Mở Terminal tại thư mục repository đã checkout đúng nhánh/commit được review. Nếu đang đứng ở thư mục khác, dùng `cd` tới đường dẫn repo trên máy mình. Sau đó:

```sh
cd ai-worker
npm ci
npx wrangler --version
```

`npm ci` đọc `ai-worker/package-lock.json` và cài cả **Wrangler đã pin** của dự án (hiện là 4.147.0). Không cần cài Wrangler toàn máy, không chạy `npm install wrangler@latest` để phát hành. Nếu `npx` hỏi tải thêm Wrangler mới, dừng và kiểm `npm ci`/thư mục hiện tại. Không copy riêng `ai-worker/` ra khỏi repo vì Worker còn import từ `shared/`.

Wrangler là CLI của Cloudflare: từ terminal mình sẽ đăng nhập, kiểm tài khoản, kiểm cấu hình, nhập secret rồi deploy. Phần 5 hướng dẫn từng bước; các lệnh trong tài liệu là `git`, `npm`, `npx` và Supabase CLI thông thường. [Cài và chạy Wrangler trong project](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

## 1. Điều kiện bắt đầu và người phụ trách

Trước phát hành, đối chiếu [báo cáo dependency còn lại](../review/2026-10-29-company-lunch-overview.md#3-dependency-còn-cần-lưu-ý-trước-phát-hành): còn 9 high trong chuỗi Puppeteer cũ và 2 moderate ExcelJS/UUID. Chưa coi release sẵn sàng chỉ vì build đạt.

Chọn người phụ trách Deploy, có quyền truy cập Supabase, Cloudflare, Vercel và Slack. Chuẩn bị hai tài khoản app A/B để kiểm quyền. Ghi từng bước và kết quả vào release manifest (bản ghi Deploy); dùng giờ `Asia/Ho_Chi_Minh`, kèm UTC nếu Log của nhà cung cấp dùng UTC.

Lần kiểm trước, công cụ báo project Supabase `INACTIVE` và Query history timeout. Đây là quan sát trước đó, **chưa xác nhận trạng thái hiện tại**. Mở Dashboard đúng project, kiểm trạng thái và kết nối. Nếu project đang tạm ngưng, làm theo hướng dẫn của nhà cung cấp rồi kiểm lại. Không xem timeout là bằng chứng migration chưa chạy. Khi chưa đọc được schema/history và chưa backup/restore thử thành công, dừng trước mọi thay đổi DB hoặc phát hành frontend mới.

Không dùng seed/fixture lên project thật. Test local chỉ dùng database, Storage local và Slack mock. Không dùng production JWT để chạy fixture. Kiểm E2E thật chỉ sau khi xác định môi trường, dữ liệu và kênh được phép.

Tạo một release manifest không chứa dữ liệu cá nhân/credential, ghi các mục sau trước khi thao tác:

| Mục | Giá trị cần ghi thực tế |
| --- | --- |
| Mã nguồn | SHA `origin/main` trước phát hành; SHA branch đã review; SHA merge main sau cùng |
| Vercel | Project/team, production domain, deployment ID/URL đang Current, **Git SHA của deployment đó**, cấu hình build/Node/env names |
| Supabase | Project ref/URL, trạng thái, PostgreSQL version, history/version + SQL đã đối chiếu, file migration được chọn, thời điểm chốt dữ liệu |
| Cloudflare | Account, **tên/URL Worker đang dùng**, version/deployment trước và sau, file cấu hình riêng đã kiểm, bốn limiter IDs |
| Slack | Workspace ID, order/general channel ID, namespace, người đồng ý cho smoke message và người xử lý unknown/schedules |
| Backup | Vị trí kho mã hóa ngoài repo, tên file, kích thước/hash, số hàng/object, lần restore thử và kết quả |
| Phát hành | Người thực hiện, từng bước/giờ/kết quả, quyết định tiếp tục hoặc rollback |

Không điền password, JWT, token, phone, thông tin ngân hàng hoặc bản dump vào manifest commit lên Git. Phần manifest chứa inventory/SQL/data phải nằm trong kho backup riêng có kiểm soát truy cập.

## 2. Môi trường và từng biến/key đặt ở đâu

### Production Vercel

Đặt trong Vercel Project → Settings → Environment Variables, chọn **Production**. Root `.env.example` chỉ ghi tên biến. Vite đưa giá trị `VITE_*` vào bundle lúc Build; người dùng có thể đọc chúng. Sau khi đổi giá trị, Build/Deploy lại frontend. Vercel phân biệt Production, Preview và Development. [Tài liệu env Vercel](https://vercel.com/docs/environment-variables)

| Biến | Loại | Nguồn và nơi dùng |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Công khai | URL đúng Supabase production; Vue và API share/OG hiện có |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Công khai | Publishable key đúng project; không dùng `service_role`/secret |
| `VITE_CLERK_PUBLISHABLE_KEY` | Công khai | Publishable key đúng Clerk instance đang dùng với Google OAuth |
| `VITE_AI_API_BASE_URL` | Công khai | Origin HTTPS của **Worker chung AI + Slack**, không thêm path `/v1` |
| `GEMINI_API_KEY` | **Secret server-only** | Giữ ở Vercel env cho API `/api/ocr` hiện có; không prefix `VITE_`, không chuyển vào Worker hoặc Vue |

Preview không tự thừa hưởng tài nguyên production. Để `VITE_AI_API_BASE_URL` trống khi chỉ kiểm UI offline, hoặc dùng localhost/mock; việc để trống URL này không cô lập DB. Để kiểm có lưu dữ liệu, dùng Supabase/Clerk thử riêng hoặc Supabase local. Không gắn preview bất kỳ vào DB thật rồi gọi đó là staging an toàn.

### Production Cloudflare Worker

Giữ tên Worker đang chạy trong account thực tế; tên mẫu trong `wrangler.jsonc` không chứng minh đó là Worker production. Dùng `ai-worker/wrangler.owner.jsonc` **mà Git ignore**, không chép credential vào file mẫu. File này cần đúng `name`, `account_id`, `main`, AI binding, limiter bindings và toàn bộ vars sau:

| Var không bí mật | Giá trị và kiểm tra |
| --- | --- |
| `CLERK_ISSUER` | Exact HTTPS issuer của token Clerk hiện dùng; không path/trailing slash |
| `ALLOWED_ORIGINS` | Danh sách origin app production chính xác, tách dấu phẩy; không wildcard, path, localhost hoặc preview chưa duyệt |
| `SUPABASE_URL` | Exact HTTPS origin của cùng project frontend |
| `SUPABASE_PUBLISHABLE_KEY` | Modern `sb_publishable_…`; Worker từ chối legacy JWT key và secret |
| `SLACK_WORKSPACE_ID` | `T…` của workspace người Deploy chọn |
| `SLACK_ORDER_CHANNEL_ID` | `C…` kênh đặt cơm mà bot đã được mời |
| `SLACK_GENERAL_CHANNEL_ID` | `C…` kênh chung mà bot đã được mời |
| `APP_PUBLIC_BASE_URL` | Origin HTTPS app production để tạo link menu, không dùng deployment preview |
| `SLACK_NAMESPACE` | Tên ổn định cho production, đúng mẫu lowercase cấu hình; ghi thực tế trong manifest, không đổi tùy ý |

Hai secret **chỉ đặt ở Cloudflare Worker Secrets** bằng Dashboard hoặc prompt tương tác; local dùng `.dev.vars` bị ignore:

| Secret | Quản lý |
| --- | --- |
| `SLACK_BOT_TOKEN` | Bot OAuth token của đúng workspace; không lưu Vercel/Vite/Git |
| `SLACK_RECEIPT_SIGNING_KEY` | Khóa ngẫu nhiên ít nhất 32 ký tự; giữ bản an toàn trong password manager để phục hồi, không dùng chung local/test |

Không cần Supabase `service_role`, Supabase secret key, Clerk secret, Slack signing secret, incoming webhook, cron, KV, D1 hay Queue. Token Clerk lấy từ phiên đăng nhập hiện tại; không lưu JWT vào database/cron. DB vẫn xét RLS với `auth.jwt()->>'sub'` dạng string.

Bốn limiter phải giữ đúng binding name và có **bốn namespace IDs khác nhau, không trùng limiter khác trong account; mỗi ID là số nguyên dương viết dạng string**:

| Binding | Giới hạn trong config hiện tại |
| --- | --- |
| `USER_RATE_LIMITER` | AI: 10/user/60 giây |
| `SERVICE_RATE_LIMITER` | AI: 60/service/60 giây |
| `SLACK_USER_RATE_LIMITER` | Slack: 20/user/60 giây |
| `SLACK_SERVICE_RATE_LIMITER` | Slack: 60/service/60 giây |

`1001`–`1004` trong Git là ví dụ. Người Deploy phải kiểm account trước khi chọn IDs; IDs trùng chia sẻ counter kể cả giữa Workers. Counter theo Cloudflare location, không phải quota toàn cầu. Giữ binding `AI` và compatibility settings hiện tại. [Rate limiting bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

Ưu tiên điền đủ vars trong `wrangler.owner.jsonc` để quản lý cấu hình tại một chỗ. `--keep-vars` chỉ giữ Dashboard vars không có trong file; **không ngăn vars trong file ghi đè giá trị trên Dashboard**. Kiểm file cấu hình riêng trước dry-run/Deploy. Không deploy trực tiếp file mẫu vars rỗng. [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)

### Clerk và môi trường local

Clerk production Google OAuth, redirect/origin và Supabase native Third-Party Auth phải cùng issuer với Worker. Giữ client-side profile upsert, không webhook và không JWT template kiểu cũ. Xác minh user token có role `authenticated` để Supabase áp RLS. [Native Clerk integration](https://supabase.com/docs/guides/auth/third-party/clerk)

Local: copy `.env.example` → file env local bị ignore và `ai-worker/.dev.vars.example` → `.dev.vars`; chỉ dùng dữ liệu local/test, token bot thử nếu thực sự cần. Một Worker production duy nhất: không tạo Worker preview qua `--env preview` trong runbook này. Preview UI mặc định dùng mock/không gọi Worker production. Muốn smoke Slack thật ở kênh thử, người Deploy phải chọn một khoảng kiểm tra riêng, ghi rõ test namespace/kênh/origin và quản lý việc đổi cấu hình cùng các schedules đang tồn tại; không thêm preview vào allowlist production một cách mặc định.

## 3. Backup trước khi Merge hoặc sửa Production

### 3.1. Backup code và ghi bản website đang chạy

`origin/main` có thể khác deployment Vercel đang Current. Trong Vercel Dashboard, mở deployment đang phục vụ production domain và ghi Git SHA, deployment ID/URL; giữ deployment này để rollback. Đồng thời lưu SHA `origin/main` sau fetch. Giữ lại cấu hình build/rewrites/Node/env names và phiên bản Worker trước phát hành; secret gốc giữ trong password manager, không cố xuất vào Git.

Các lệnh dưới là mẫu cho ngày phát hành, chỉ chạy sau khi worktree đã review và lưu thay đổi cần thiết. Dùng SHA thật đã xác nhận, không suy ra SHA production từ HEAD:

```sh
git fetch origin
git rev-parse origin/main
git show --no-patch --format=fuller origin/main
git show --no-patch --format=fuller "$LUNCH_VERCEL_PROD_SHA"
git branch codex/backup-main-pre-rollout-20261029 origin/main
git branch codex/backup-vercel-pre-rollout-20261029 "$LUNCH_VERCEL_PROD_SHA"
git bundle create "$LUNCH_BACKUP_DIR/code/pre-rollout.bundle" --all
git bundle verify "$LUNCH_BACKUP_DIR/code/pre-rollout.bundle"
```

Người Deploy đặt `LUNCH_BACKUP_DIR` là đường dẫn tuyệt đối tới thư mục mã hóa **ngoài repo**, tạo thư mục `code/`, `db/`, `storage/`, `manifest/` và hạn chế quyền trước. Nếu tên branch backup đã tồn tại thì dùng tên có giờ, không force ghi đè. Nếu SHA production chưa có local, fetch đúng ref/commit và xác minh lại trước tạo backup. Bundle chỉ lưu Git objects/refs; chưa commit thì không nằm trong backup đó. Có thể push hai branch backup để có bản remote khi được phép, nhưng bản Git vẫn **không backup Database, ảnh Storage hoặc giá trị env**.

### 3.2. Tạm ngừng ghi và backup Database

Hẹn cửa sổ ngắn ngừng đặt/sửa/thanh toán/upload và kiểm không có client cũ tiếp tục ghi. Chỉ báo người dùng đóng app không bảo đảm toàn bộ writers đã dừng: operator cần kiểm hoạt động ghi, rồi lấy dump/inventory ở thời điểm nhất quán. Nếu không bảo đảm được cửa sổ yên, chưa qua cổng backup; lập phương án snapshot nhất quán trước khi sửa production. Đừng dùng `is_closed` hàng loạt làm maintenance flag vì có thể tạo snapshot nghiệp vụ.

Supabase Free cần chủ động xuất backup ngoài hệ thống; không dựa vào nút daily backup/PITR của paid plan. Database backup không chứa byte của Storage object. [Database backups](https://supabase.com/docs/guides/platform/backups)

Người Deploy dùng Supabase CLI hiện hành + Docker theo hướng dẫn backup, kết nối đúng project qua quyền operator/DB password từ Dashboard Connect. Đây là credential quản trị chỉ trên máy vận hành, không phải `service_role` và không đưa vào app/env client. Giữ password ngoài command history/log; dùng prompt hoặc credential store hạn chế quyền. Không tự reset password đang dùng để lấy connection string. Nếu direct connection không truy cập IPv6, đối chiếu Session pooler trong Dashboard, không tự bật IPv4 add-on trả phí.

Trước chạy thật, xem `supabase --help`, `db dump --help`, `migration list --help` trên máy người Deploy và xác nhận project link; không cài/đổi CLI giữa chừng khi chưa ghi version. Lệnh mẫu dùng project đã link chính xác, giúp không đặt password trong argv:

```sh
supabase --version
supabase db dump --help
supabase migration list --help
supabase link --project-ref "$LUNCH_PROJECT_REF"
supabase migration list --linked
supabase db dump --linked --role-only --file "$LUNCH_BACKUP_DIR/db/roles.sql"
supabase db dump --linked --file "$LUNCH_BACKUP_DIR/db/schema.sql"
supabase db dump --linked --data-only --use-copy --file "$LUNCH_BACKUP_DIR/db/data.sql"
supabase db dump --linked --schema supabase_migrations --file "$LUNCH_BACKUP_DIR/db/history-schema.sql"
supabase db dump --linked --schema supabase_migrations --data-only --use-copy --file "$LUNCH_BACKUP_DIR/db/history-data.sql"
```

Lệnh mặc định không gồm custom roles/data; do đó cần ba file tách riêng. CLI loại trừ nhiều schema do Supabase quản lý, nên không coi dump mặc định là ảnh chụp mọi cấu hình của project. Nếu CLI hiện tại cần loại trừ vector-storage tables theo hướng dẫn provider, xác minh schema thực và thêm đúng `--exclude`; không bỏ qua lỗi dump. Migration history, custom Storage/auth policies, bucket settings và Realtime publications cần đối chiếu/lưu riêng. [CLI dump](https://supabase.com/docs/reference/cli/supabase-db-dump) · [Backup/restore và history](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

Dùng SQL Editor hoặc công cụ có quyền operator để đọc và xuất Schema, Migration history, RLS policies, grants, functions, triggers và publication membership. Lưu kết quả ngoài Git. Với `storage`, giữ các policy tự tạo và bucket settings, không restore đè toàn bộ managed schema. Ghi hash schema/data và số hàng thực ở **mọi bảng nghiệp vụ hiện tồn tại**, nhất là profiles/menus/orders/menu_items/order_items/reviews, payment flags/nợ cũ và các bảng mới nếu đã có. Số 11 menu/34 đơn trong biên bản 04/10 chỉ là lịch sử, không phải baseline hôm phát hành.

### 3.3. Tải toàn bộ file Storage và lập danh sách đối chiếu

Inventory bằng SQL operator (read-only, xuất kết quả ngoài repo):

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets order by id;
select bucket_id, name, owner_id, metadata, created_at, updated_at
from storage.objects order by bucket_id, name;
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public','storage')
order by schemaname, tablename, policyname;
```

Kiểm tên cột theo schema thực trước chạy; đây không phải lệnh seed. Backup **mọi bucket có dữ liệu**, bao gồm `menus` thực tế và `avatars` nếu tồn tại, các path lồng nhau, kể cả file chưa còn link trong UI. Lưu bucket/path, size, MIME/cache metadata và SHA-256 của từng file, thời điểm tải. Giữ đúng path thư mục user để phục hồi; URL công khai không phải bản sao file.

Với nhóm nhỏ, người Deploy vào Supabase Dashboard → Storage, chọn object → Download, lưu vào cây `storage/<bucket>/<path>` bên ngoài repo. Đối chiếu từng object với inventory, không chỉ tải ảnh đang nhìn thấy trong một trang. Có thể dùng inventory đã xuất để tải public object từ URL chính xác bằng công cụ vận hành kiểm checksum; không thay public/private hay nới RLS để tiện backup. [Dashboard Storage download](https://supabase.com/docs/guides/storage/quickstart)

Một số script bulk-migration mẫu dùng key đặc quyền. **Không chép cách đó vào mô hình này**: không tạo/lấy `service_role`, không bỏ key đó vào file client hoặc repo. Nếu công cụ bulk yêu cầu secret không phù hợp, dùng Dashboard/quyền operator sẵn có; chưa tải đủ thì backup chưa đạt, không bỏ qua. File private nếu có phải dùng luồng Download có quyền của Dashboard; không công khai hóa.

Dumps có thể chứa số điện thoại, nội dung đơn và ngân hàng; mã hóa, giữ hai bản ở vị trí tách biệt mà người Deploy kiểm soát. Không đưa vào Git, PR, chat attachment công khai hoặc log CI. Ghi checksum/tổng số objects/tổng bytes; mở thử ảnh và so khớp toàn bộ danh sách lỗi/rỗng/truncated. Backup metadata mà thiếu bytes chưa đủ khôi phục.

### 3.4. Restore thử ở môi trường riêng

Dùng database/bucket disposable **không trỏ frontend hay Slack production**, ưu tiên Supabase local trên Docker để không thêm chi phí. Nếu dùng project Free thử có sẵn, kiểm đúng ref ở mọi cửa sổ. Không dùng fixture bootstrap để restore đè production.

Khôi phục roles → schema → data theo tài liệu provider, với `ON_ERROR_STOP` và transaction phù hợp; xử lý role/grant/extension theo target thật. Tái lập custom Storage policies, bucket settings, publications và history đã xuất; không sửa history của DB nguồn. Mặc định grants trên target có thể khác: so sánh RLS/grants sau restore, không chỉ đếm hàng. Các credential/provider settings Clerk/Google/Realtime không được giả định đi theo SQL dump.

Upload các bytes đã backup qua Storage API/Dashboard vào **bucket thử**, đúng path/MIME; kiểm toàn bộ checksum và đường dẫn đọc được. Không INSERT trực tiếp vào `storage.objects` để thay cho upload bytes. Trong DB thử, xác minh đủ số hàng/IDs, paid flags, nợ, giá/menu cũ, profile và ảnh, hai tài khoản/anonymous với RLS phù hợp. Sau đó áp chuỗi migration thiếu lên bản restore để diễn tập và xác minh dữ liệu cũ không mất. Ghi kết quả/hash/version; chỉ tiếp tục khi cả restore DB lẫn Storage đã chứng minh hoạt động.

## 4. Đối chiếu Migration trước khi sửa Database thật

History từng ghi `20261004014918_close_ordering_compat` và `20261004015046_lunch_catalog_reviews`, trong khi local là `20261003070000_close_ordering_compat.sql` và `20261003080019_lunch_catalog_reviews.sql`. DB cũ còn từng dùng `0004_menu_order_deadline`, khác file `0004_close_ordering.sql`. [Biên bản 04/10](../review/2026-10-04-verification.md)

Operator đọc `supabase_migrations.schema_migrations` thực tế và SQL/statements đã lưu nếu có, so với file local và definitions trong schema. Kiểm nội dung trigger deadline, `is_closed`, catalog, RLS và dữ liệu backfill, không chỉ so tên/timestamp. Nếu history không lưu đủ SQL, dùng schema/function/trigger definitions + bằng chứng đã triển khai để xác nhận; phần chưa chứng minh là một mục cần giải quyết trước phát hành.

Lập mapping `local file + checksum → remote version + nội dung đã đối chiếu → applied/missing/diverged`. Chỉ file **missing đã xác nhận** mới vào release manifest. `diverged` phải có patch được review và diễn tập; không chạy lại file create bảng/policy vì timestamp khác. **Không blind `db push`, `db reset`, `migration repair`, sửa/xóa history hoặc seed production.** Không dùng CLI dry-run như bằng chứng rằng remote chưa có thay đổi tương đương.

Năm migration mới dự kiến, kiểm dependency và chọn phần thiếu theo schema thật; thứ tự dưới khớp tên file hiện tại:

| Thứ tự | File | Tác động cần kiểm |
| --- | --- | --- |
| 1 | `20261029144827_lunch_personal_avatars.sql` | Profile avatar options, bucket `avatars`, policies own folder |
| 2 | `20261029145057_lunch_pickup_contacts.sql` | Saved private contact và consent theo ngày |
| 3 | `20261029145105_lunch_sponsorship_and_finance.sql` | Sponsorship và financial snapshot schema |
| 4 | `20261029145108_lunch_close_and_pickup.sql` | Close/reopen revision, assignment/received snapshot và domain locking |
| 5 | `20261029145252_lunch_slack_events.sql` | Registry, leases/receipts/reminders và Slack links |

Sau backup/restore thử, operator áp **SQL đã chọn chính xác** qua SQL Editor hoặc công cụ migration đã review cho project đúng, từng đơn vị transaction được file hỗ trợ. Không bọc mù cả chuỗi bằng một transaction khác. Ghi SQL checksum, phiên bản thực được hệ thống ghi và output; history nếu công cụ không tự ghi cần kế hoạch ghi nhận riêng đã review, không tự đánh dấu mọi local version là applied. Lần sau vẫn dùng manifest + SQL mapping để đối chiếu.

Đối chiếu ngay các hàng/IDs/flags/chốt/nợ trước-sau; kiểm policies bật RLS, chỉ người Deploy self-tick trả tiền, Clerk string ID, anonymous bị chặn đúng scope, contact không đọc tràn nhóm, Storage upload/delete own-folder. `close_lunch_menu` nay có tham số thứ năm `p_allow_unassigned boolean default false`: null primary chỉ cho lần nhận mới khi poster xác nhận; reclose đã received giữ người/liên hệ/thời điểm cũ. Không gán người chưa đồng ý để vượt lỗi khi chốt. Nếu bước nào lỗi, dừng, giữ log đã lọc và đánh giá forward fix; không reset DB để chạy tiếp.

## 5. Chuẩn bị Slack và Deploy Worker chung

Chọn đúng Slack workspace, kênh đặt cơm và kênh chung, rồi thêm bot vào hai kênh. Cấu hình tối thiểu bot scopes `chat:write`, `users:read`; reinstall app nếu scope thay đổi. Không cần `chat:write.public` khi bot đã được mời, không cần đọc email hoặc inbound events/webhooks. Member ID người dùng nhập được kiểm active workspace membership, không nên mô tả là đã chứng minh quyền sở hữu tài khoản Slack. [Post message](https://docs.slack.dev/reference/methods/chat.postMessage/) · [User info](https://docs.slack.dev/reference/methods/users.info/)

### 5.1. Đăng nhập Cloudflare bằng CLI

Thực hiện từ `ai-worker/` sau bước cài ở phần 0:

```sh
npx wrangler login
npx wrangler whoami
```

`login` mở trình duyệt: chọn đúng tài khoản Cloudflare rồi cho phép Wrangler. Nếu trình duyệt không tự mở, dùng URL chính lệnh in ra. `whoami` cho biết tài khoản/account ID; đối chiếu với account đang chứa Worker hiện tại. Không paste Cloudflare API token vào lệnh, PR hoặc file config. [Login và whoami](https://developers.cloudflare.com/workers/wrangler/commands/general/)

### 5.2. Tạo bản cấu hình riêng, không commit

Chỉ copy lần đầu **khi chưa có** `wrangler.owner.jsonc`. Nếu file đã tồn tại, giữ bản hiện tại, sao lưu an toàn và chỉnh các giá trị cần đổi; không chép file mẫu đè lên cấu hình đang dùng.

macOS/Linux, tại `ai-worker/`:

```sh
cp wrangler.jsonc wrangler.owner.jsonc
```

Windows PowerShell, cũng tại `ai-worker/`:

```powershell
Copy-Item wrangler.jsonc wrangler.owner.jsonc
```

Kiểm file riêng được Git ignore:

```sh
git check-ignore wrangler.owner.jsonc
```

Kết quả phải có `wrangler.owner.jsonc`. Mở file bằng trình soạn thảo và điền:

- `name`: **đúng tên Worker đang chạy** trong Cloudflare → Workers & Pages. Deploy cùng tên/account sẽ cập nhật Worker này; đổi tên có thể tạo Worker khác. Không đoán từ tên mẫu trong Git.
- `account_id`: account ID đã đối chiếu bằng `whoami` và Dashboard.
- `vars`: điền toàn bộ bốn biến auth/Supabase và năm biến Slack trong bảng phần 2; không để giá trị rỗng, không đưa hai secret vào `vars`.
- `ratelimits`: giữ đúng bốn binding names, điền bốn namespace IDs khác nhau đã người Deploy xác nhận không trùng counter khác trong account. Đây là rate-limit IDs, **không cần tạo KV namespace**.
- Giữ `main`, binding `AI`, compatibility settings và cấu trúc repo. Dùng **một Worker miễn phí chung AI + Slack**, không thêm Queue, D1, KV, cron hoặc Worker thứ hai.

Chỉ cho `ALLOWED_ORIGINS` chứa origin production chính xác; không thêm preview/localhost mặc định. `APP_PUBLIC_BASE_URL` phải là origin frontend production. Nếu dùng Dashboard vars, đọc kỹ lưu ý `--keep-vars` ở phần 2: vars rỗng trong file vẫn có thể đè giá trị đúng.

### 5.3. Ghi version cũ và kiểm cấu hình trước Deploy

Lệnh đầu chỉ đọc danh sách version trên Cloudflare; ghi version **đang phục vụ** từ Dashboard → Worker → Deployments, đừng mặc định version mới nhất là version active:

```sh
npx wrangler versions list --config wrangler.owner.jsonc
npx wrangler deploy --dry-run --config wrangler.owner.jsonc
```

Dry-run bundle trên máy, không upload bản mới. Xem output không có lỗi, đúng tên Worker và đủ AI/bốn rate-limit bindings. Nó không chứng minh Slack token/kênh, auth/RLS live hoặc quota thực đã hoạt động. Trước bước thay đổi thật, backup/restore thử và migration còn thiếu phải hoàn tất, dependency gate ở đầu tài liệu phải được xử lý, và người Deploy xác nhận cửa sổ phát hành.

### 5.4. Nhập hai Worker Secrets qua prompt

Chuẩn bị bot token Slack đúng workspace và receipt key ngẫu nhiên ít nhất 32 ký tự trong password manager. Nếu Worker đã có receipt key hợp lệ, **giữ khóa đó**, không tạo mới chỉ vì deploy: đổi khóa sẽ làm receipt cũ mất xác thực. Ghi cách lấy lại khóa trong password manager, không trong Git.

Nhập từng secret khi CLI hỏi; không thêm giá trị vào cuối command, không dùng `echo` và không chụp/log màn hình chứa token:

```sh
npx wrangler secret put SLACK_BOT_TOKEN --config wrangler.owner.jsonc
npx wrangler secret put SLACK_RECEIPT_SIGNING_KEY --config wrangler.owner.jsonc
```

Nếu secret đã đúng thì không cần đặt lại. **`secret put` là thay đổi Cloudflare thật, có thể deploy một version ngay**; chỉ thực hiện trong cửa sổ phát hành sau khi cấu hình và backup đã sẵn sàng. CLI không đọc lại plaintext secret đã lưu; `secret list` chỉ cho tên/loại, không khôi phục giá trị. Không cần hoặc dùng `service_role`/Clerk secret. [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/) · [Lệnh secret](https://developers.cloudflare.com/workers/wrangler/commands/workers/)

### 5.5. Deploy lên đúng Worker hiện có

```sh
npx wrangler deploy --config wrangler.owner.jsonc
```

Nếu mọi nonsecret vars nằm trong file cấu hình riêng đầy đủ, dùng lệnh trên. Chỉ thêm `--keep-vars` khi đã chọn quản lý vars qua Dashboard và loại bỏ các vars rỗng/khác gây ghi đè. Không deploy trực tiếp `wrangler.jsonc` mẫu.

Sau deploy, ghi version/deployment ID và URL HTTPS `workers.dev` mà CLI in ra. URL dạng `https://<worker>.<account-subdomain>.workers.dev` là origin API; dùng URL **thực tế**, không copy chuỗi placeholder này. Trên Vercel → Project → Environment Variables → **Production**, đặt `VITE_AI_API_BASE_URL` bằng origin đó, không thêm `/v1` hay dấu `/` cuối. Frontend phải build/deploy lại để nhận biến mới. Cả AI lẫn Slack dùng cùng URL, `GEMINI_API_KEY` vẫn chỉ ở Vercel server cho OCR cũ.

### 5.6. Kiểm sau Deploy và chuẩn bị Rollback

Kiểm `/health`, CORS exact origin, thiếu token/foreign origin bị chặn trước khi kiểm Slack thật. Sau đó mới kiểm own/foreign order, AI/fallback, và Slack trong kênh đã được duyệt theo mục dưới. Không xem health/dry-run là E2E đạt. Giữ Worker cũ và Vercel deployment cũ để rollback; phần 8 có lệnh `npx wrangler rollback <version-id>` trên cùng Worker. Workers Free vẫn áp dụng; không bật billing khi AI hết quota.

Smoke Slack thật chỉ theo kênh/namespace đã người Deploy duyệt: preview nội dung rồi một menu được phép; không tự tạo dữ liệu giả trong DB chung. Nếu cần kênh thử, chọn cấu hình thử rõ ràng trong cửa sổ kiểm, không vô tình publish vào general production. Sau kiểm, xác nhận lại cả workspace, hai channel, app base, namespace và origins production trước mở traffic. Một thread/ngày; publish/share/close có registry chống gửi lại theo revision.

Slack giữ reminder sau khi browser đóng; khi thay lịch, chốt/mở lại phải kiểm cancellation ACK. `unknown`/`sending` không tự gửi lại; poster kiểm kênh rồi xác nhận thủ công. `cancel_pending` phải giải quyết trước thay schedule; rollback app/Worker **không tự hủy lịch trên Slack**. Không rotate signing key tùy ý: khóa khác làm receipt cũ mất xác thực, có thể cản đối soát/cancel. [Scheduled messages](https://docs.slack.dev/reference/methods/chat.scheduleMessage/)

## 6. Merge main và Deploy Vercel

Trước merge: PR đã review, changelog tiếng Việt đầy đủ, fetch main mới nhất, tích hợp thay đổi mới và kiểm lại phạm vi. Không force-push main, không bỏ dashboard/thống kê của main bằng ours/theirs. Ghi SHA chính xác đã kiểm. Toàn bộ bước backup, restore thử, mapping migration, DB và Worker sẵn sàng phải hoàn tất trước merge nếu main đang auto-deploy.

Vercel thường tự tạo Production deployment sau khi Push/Merge vào main; kiểm Production Branch thực tế của project. **Đừng merge rồi mới bắt đầu chuẩn bị DB/env.** Nếu cần giữ domain cũ trong lúc build mới, người Deploy chọn cơ chế staging/manual promotion được account hiện tại hỗ trợ, xác nhận không tăng phí; nếu không có, giữ PR chưa merge tới lúc backend và env sẵn sàng. [Git deployments](https://vercel.com/docs/git) · [Promote deployments](https://vercel.com/docs/deployments/promoting-a-deployment)

Cấu hình hiện tại: Vite root, Node theo `package.json` (22.18+ hoặc 24.11+), install root lockfile, build `npm run build`, output `dist`, giữ `vercel.json` và API OCR/share/OG. Không đổi sang Express hoặc thêm serverless mới. Worker cài/bundle từ package riêng, không nhầm root `npm ci` với `ai-worker/npm ci`.

Sau khi PR merge, theo dõi deployment đúng merge SHA; kiểm build env Production và `VITE_AI_API_BASE_URL` đúng Worker chung. Ghi deployment ID mới; chỉ gán production domain khi sẵn sàng theo workflow người Deploy đã chọn. Các biến public phải đúng **lúc build**, không chỉ nhìn giá trị Dashboard sau đó. Giữ deployment trước rollout để rollback, không xóa nó.

## 7. Kiểm lại trước khi cho mọi người dùng

Bằng chứng local do coordinator ghi cho đợt này: native PostgreSQL **91 assertions, 48 rejected writes và 5 tình huống concurrency** đã đạt. Bộ này kiểm reminder/close, order/close, duplicate close và Slack lease ở local; Worker/UI còn có bộ test riêng. Đây **không phải live E2E** với Clerk/Supabase Storage/Slack/Vercel production. Bằng chứng hôm phát hành phải ghi riêng theo deployment/version thật.

| Nhóm | Kiểm bằng hai user hoặc operator |
| --- | --- |
| Dữ liệu cũ | Baseline IDs/count/checksum, profile/menu/đơn/review/paid flags/nợ trước-sau; ảnh `menus` cũ còn đọc được; không backfill đoán quán/món |
| Auth/RLS | Google login, profile upsert; A đặt hộ B được; A không self-tick trả hộ B; B tự trả được sau chốt; foreign/anonymous bị chặn theo thiết kế |
| Nhận cơm | Consent + phone của chính chủ; poster chỉ đọc liên hệ được phép; chốt chưa có volunteer phải xác nhận; assignment/backup/received và reclose giữ snapshot |
| Tài chính | Sponsored không vào nợ; unknown price giữ unknown; sửa giá sau reopen tạo revision, snapshot cũ và paid state giữ nguyên |
| Ảnh/avatar | Upload own-folder, không xóa ảnh đang dùng, người khác không ghi/xóa hộ; mascot/provider/upload đúng; bucket `avatars` và `menus` đúng |
| Worker/AI | Health, allowed/disallowed origin, thiếu JWT, own/foreign order, AI fallback; không có secret/JWT/phone trong bundle/log |
| Slack | Đúng namespace/workspace/kênh; ảnh menu thật được đưa vào publish/share; closed unassigned có text không mention; chỉ primary hiện tại được mention; double click không post lại |
| Reminder | Đặt/hủy với ACK, thử đóng browser ở môi trường đã duyệt; unknown/cancel_pending nhìn thấy và được xử lý, không nhấn resend mù |
| Giao diện | Hôm nay UTC+7, structured chọn MenuBoard/plain menu gõ tay, export XLSX, mobile không tràn, link menu/share/OCR còn hoạt động |

Không ghi phone/tokens vào ảnh chụp kiểm chứng công khai. Chỉ dùng test được phép trên môi trường thật; không chạy fixture tạo hàng loạt để kiểm RLS. Nếu có drift dữ liệu hoặc quyền đọc rộng hơn dự kiến, giữ production domain ở bản cũ/rollback và điều tra trước mở tiếp.

## 8. Rollback không làm mất dữ liệu mới

| Sự cố | Hành động ưu tiên | Giữ nguyên/kiểm tiếp |
| --- | --- | --- |
| UI/build/env lỗi | Vercel Instant Rollback về deployment Current trước rollout đã ghi | Không rebuild nhầm với env mới; kiểm UI cũ tương thích DB đã mở rộng |
| Worker lỗi | Rollback về version đã ghi trên **cùng Worker**, kiểm lại vars/bindings/secrets | Không drop bảng event hoặc xóa registry; đối soát schedules/unknown |
| Migration lỗi giữa chừng | Dừng phần còn lại, xác định transaction nào commit; review forward fix | Không reset/drop/reapply cả chuỗi; không giả định mọi file đã rollback |
| Dữ liệu bị sửa/hỏng | Ngừng writers, lấy thêm backup hậu sự cố; restore sang DB/bucket disposable để đối chiếu | Chọn sửa/ghép dữ liệu tối thiểu đã review; giữ các đơn/thanh toán mới sau snapshot |
| Storage mất file | Tải lại đúng object bytes/path từ backup qua Storage API/Dashboard theo quyền operator | Không xóa bucket/hàng để khớp số đếm; kiểm checksum, metadata, DB refs |
| Slack bị gửi/lịch nhầm | Dừng gửi mới, kiểm ACK/schedule ID ở đúng namespace, hủy lịch đã xác nhận theo luồng hợp lệ | Rollback code không thu hồi tin/lịch, không xóa history để che duplicate |

Vercel Instant Rollback chuyển domain về deployment cũ, không rebuild env và không rollback Database/Storage. Sau đó tạo Git revert của merge khi đã đánh giá để lần auto-deploy tiếp theo không đưa lỗi trở lại; không dùng force reset main. [Vercel rollback](https://vercel.com/docs/instant-rollback)

Worker có thể rollback qua Dashboard → Worker → Deployments hoặc lệnh sau sau khi kiểm đúng version/account/config:

```sh
npx wrangler rollback "$LUNCH_PREVIOUS_WORKER_VERSION" --config wrangler.owner.jsonc
```

Rollback Worker không hoàn tác tài nguyên/dữ liệu bên ngoài, nên cần kiểm receipt signing key và các Slack schedules riêng. Không đổi namespace/khóa để né registry cũ. [Worker rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)

UI cũ chưa hiểu chế độ được mời/giá snapshot/lưu trữ mới: phải kiểm tương thích nghiệp vụ trước khi đưa lại người dùng; nếu hiển thị tiền sai thì giữ cửa sổ bảo trì và ưu tiên forward fix.

Giữ migration additive khi rollback UI/Worker nếu còn tương thích; **không drop contacts, orders, closure snapshots, Slack events hoặc avatar objects**. Restore toàn bộ snapshot cũ lên live có thể xóa đơn/thanh toán tạo sau backup: không phải mặc định của runbook. Nếu thực sự cần thay DB live, phải có kế hoạch riêng về downtime, delta từ sau snapshot, kiểm RLS/Storage/Clerk/env và quyết định người Deploy sau khi đã thử phục hồi ngoài live. Không tự chạy restore đè project hiện tại.

## 9. Ghi kết quả và kết thúc Deploy

Chỉ đánh dấu hoàn tất khi đã có SHA/deployment/version thực, mapping migration cuối, backup DB+Storage đọc được và restore thử đạt, baseline dữ liệu không mất, hai tài khoản kiểm quyền đạt, Slack/schedules không còn trạng thái cần xử lý. Người Deploy xác nhận production origins/kênh/namespace sau mọi bước test, rồi kết thúc cửa sổ bảo trì.

Lưu log đã lọc, manifest không nhạy cảm và kết quả kiểm chứng; giữ dữ liệu backup trong kho riêng theo thời hạn người Deploy quyết định. Repo chỉ chứa runbook/changelog/kết quả tóm tắt, không dump hoặc nội dung liên hệ. Tài liệu tham chiếu nguồn chính thức khi soạn ngày 29/10 và cập nhật CLI ngày 30/10/2026; trước phát hành xem lại CLI help/provider docs nếu version thay đổi. Wrangler help `deploy`, `secret put`, `rollback` đã kiểm từ bản cài trong project; Supabase CLI help chưa lấy được trong lượt soạn nên người Deploy cần xác minh trên máy vận hành trước dùng lệnh backup.
