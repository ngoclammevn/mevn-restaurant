# Original Menu Image for Open Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every shared menu use its original uploaded image for Open Graph, with a static branded PNG fallback and no runtime image generation.

**Architecture:** A pure frontend helper builds share URLs containing the already-public Supabase Storage image URL. A shared server helper validates that URL against the configured Supabase origin and `menus` bucket; `api/share.js` injects it into metadata and `api/og-image.js` performs a validated redirect. Anonymous/RLS-hidden menu lookups fall back to generic metadata instead of breaking the share page.

**Tech Stack:** Vue 3, Vite, Vitest, Vercel Functions, Supabase Storage, Sharp (development-time asset rendering only).

## Global Constraints

- Do not change table RLS policies or expose profiles, orders, payment information, or OCR data.
- Accept an image only when its origin exactly matches `VITE_SUPABASE_URL` and its path starts with `/storage/v1/object/public/menus/`.
- Use `public/og-default.png` when the source image is absent or invalid.
- Do not parse OCR notes or `dishes[]` to choose the Open Graph image.
- Do not generate images at request time.
- Preserve old `/share/<id>` links and serve the SPA shell even when the anonymous Supabase lookup returns no menu.
- Before editing any existing function, run GitNexus upstream impact analysis and report HIGH or CRITICAL risk.
- Before changing a shared UI pattern, grep every consumer in `src/` and update them together.
- Before every commit, update `src/changelog.json` with a short Vietnamese user-facing bullet for `2026-07-23`.
- Before every commit, run `gitnexus_detect_changes()` against the staged worktree.

---

## File Structure

- Create `src/lib/share.js`: pure browser share-URL builder used by every share action.
- Create `tests/ui/lib/share.test.js`: URL construction and encoding regression tests.
- Modify `src/pages/TodayPage.vue`: pass the whole menu to the shared helper.
- Modify `src/pages/PostMenuPage.vue`: retain the created menu object and copy its original image URL.
- Modify `src/pages/MenuPage.vue`: use the shared helper for the loaded menu.
- Modify `src/pages/MyMenusPage.vue`: use the shared helper for managed menus.
- Create `api/_og-image.js`: shared allowlist validation and OG endpoint path builder.
- Replace `api/og-image.js`: validated redirect only; no database, OCR, Chromium, or Puppeteer.
- Modify `api/share.js`: validate the supplied image, serve generic metadata when menu lookup is unavailable, and keep returning the SPA shell.
- Create `tests/ui/api/og-image.test.js`: allowlist and redirect/fallback tests.
- Create `tests/ui/api/share.test.js`: metadata and RLS-hidden fallback tests.
- Modify `tests/ui/api/server-supabase.test.js`: remove the obsolete OG configuration expectation.
- Create `public/og-default.svg`: editable source for the static brand artwork.
- Create `public/og-default.png`: committed 1200×630 runtime fallback generated once from the SVG.
- Modify `package.json` and `package-lock.json`: remove Chromium/Puppeteer runtime dependencies.
- Modify `docs/DEPLOY.md`: document original-image sharing and fallback smoke tests.
- Modify `src/changelog.json`: record each independently committed user-visible change.

---

### Task 1: Build share URLs from the original menu image

**Files:**
- Create: `src/lib/share.js`
- Create: `tests/ui/lib/share.test.js`
- Modify: `src/pages/TodayPage.vue:1-175,250`
- Modify: `src/pages/PostMenuPage.vue:1-38,224-243,300`
- Modify: `src/pages/MenuPage.vue:1-10,387-397`
- Modify: `src/pages/MyMenusPage.vue:1-75,207`
- Modify: `src/changelog.json`

**Interfaces:**
- Produces: `buildShareUrl(menu: { id: string, image_url?: string | null }, origin?: string): string`
- Consumes: menu rows already returned by `createMenu`, `listMenusByDate`, `getMenu`, and `listMyMenus`.

- [ ] **Step 1: Grep all existing share-link consumers**

Run:

```bash
rg -n "copySlackLink|copyMenuLink|/share/" src
```

Expected: exactly four page consumers in `TodayPage.vue`, `PostMenuPage.vue`, `MenuPage.vue`, and `MyMenusPage.vue`, plus the router redirect.

- [ ] **Step 2: Run GitNexus impact analysis before editing existing functions**

Run upstream impact for:

```text
copyMenuLink — src/pages/TodayPage.vue
copySlackLink — src/pages/PostMenuPage.vue
copyMenuLink — src/pages/MenuPage.vue
copyMenuLink — src/pages/MyMenusPage.vue
submit — src/pages/PostMenuPage.vue
```

Expected: review direct callers and stop for user approval only if any result is HIGH or CRITICAL.

- [ ] **Step 3: Write failing URL-builder tests**

Create `tests/ui/lib/share.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { buildShareUrl } from '../../../src/lib/share'

describe('buildShareUrl', () => {
  it('appends and encodes the original menu image', () => {
    const url = buildShareUrl(
      {
        id: 'menu-1',
        image_url: 'https://project.supabase.co/storage/v1/object/public/menus/user/menu 1.png',
      },
      'https://lunch.example',
    )

    expect(url).toBe(
      'https://lunch.example/share/menu-1?image=https%3A%2F%2Fproject.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fmenus%2Fuser%2Fmenu+1.png',
    )
  })

  it('keeps the legacy short link when the menu has no image', () => {
    expect(buildShareUrl({ id: 'menu-2', image_url: null }, 'https://lunch.example'))
      .toBe('https://lunch.example/share/menu-2')
  })
})
```

- [ ] **Step 4: Run the focused test and verify RED**

Run:

```bash
npx vitest run tests/ui/lib/share.test.js
```

Expected: FAIL because `src/lib/share.js` does not exist.

- [ ] **Step 5: Implement the minimal shared helper**

Create `src/lib/share.js`:

```js
export function buildShareUrl(menu, origin = window.location.origin) {
  const url = new URL(`/share/${menu.id}`, origin)
  if (menu.image_url) {
    url.searchParams.set('image', menu.image_url)
  }
  return url.toString()
}
```

- [ ] **Step 6: Update all four page consumers**

Import `buildShareUrl` in each page and replace literal string construction:

```js
const url = buildShareUrl(menu)
```

Specific call-site changes:

```js
// TodayPage.vue
function copyMenuLink(menu) {
  const url = buildShareUrl(menu)
  navigator.clipboard.writeText(url).then(() => {
    copiedMenuId.value = menu.id
    setTimeout(() => {
      if (copiedMenuId.value === menu.id) {
        copiedMenuId.value = null
      }
    }, 2000)
  }).catch((err) => {
    console.error('Failed to copy link: ', err)
  })
}
```

```js
// MyMenusPage.vue
function copyMenuLink(menu) {
  const url = buildShareUrl(menu)
  navigator.clipboard.writeText(url).then(() => {
    copiedMenuId.value = menu.id
    setTimeout(() => {
      if (copiedMenuId.value === menu.id) copiedMenuId.value = null
    }, 2000)
  }).catch((err) => {
    console.error('Failed to copy link: ', err)
  })
}
```

```vue
<!-- TodayPage.vue and MyMenusPage.vue -->
@click="copyMenuLink(menu)"
```

```js
// MenuPage.vue
const url = buildShareUrl(menu.value)
```

In `PostMenuPage.vue`, replace the ID-only ref with the created row:

```js
const createdMenu = ref(null)

function copySlackLink() {
  if (!createdMenu.value) return
  navigator.clipboard.writeText(buildShareUrl(createdMenu.value))
    .then(() => {
      slackCopied.value = true
      setTimeout(() => { slackCopied.value = false }, 2000)
    })
    .catch(() => {})
}
```

After a successful insert:

```js
posted.value = true
createdMenu.value = createdMenuRow ?? null
resetForm()
```

Rename the destructured insert result to avoid shadowing and pass all current fields:

```js
const { data: createdMenuRow, error } = await createMenu({
  title: title.value.trim(),
  menu_date: menuDate.value || todayInVN(),
  note: finalNote,
  imageFile: imageFile.value,
})
```

Update success controls:

```vue
:disabled="!createdMenu"
```

```vue
@click="posted = false; createdMenu = null"
```

Delete the obsolete `fetch('/api/og-image?id=...')` pre-warm call because OG rendering is no longer performed.

- [ ] **Step 7: Run focused and existing UI tests**

Run:

```bash
npx vitest run tests/ui/lib/share.test.js tests/ui/pages/protected-pages.test.js tests/ui/components/navigation.test.js
```

Expected: PASS.

- [ ] **Step 8: Update changelog, stage, inspect impact, and commit**

Append:

```json
"Link chia sẻ menu giờ mang theo ảnh gốc do người đăng tải lên"
```

Then stage only Task 1 files, run:

```text
gitnexus_detect_changes(
  scope: "staged",
  worktree: "/Users/nhatminh/Desktop/MEVN/mevn-restaurant/.worktrees/ui-ux-foundation"
)
```

Commit:

```bash
git commit -m "feat: share original menu image URL"
```

---

### Task 2: Validate image URLs and replace runtime OG rendering

**Files:**
- Create: `api/_og-image.js`
- Replace: `api/og-image.js`
- Create: `tests/ui/api/og-image.test.js`
- Modify: `tests/ui/api/server-supabase.test.js`
- Modify: `src/changelog.json`

**Interfaces:**
- Produces: `validateMenuImageUrl(value: unknown, supabaseUrl?: string): string | null`
- Produces: `buildOgImagePath(value: unknown, supabaseUrl?: string): string`
- Produces: `handler(req, res)` in `api/og-image.js`, returning a 307 redirect.

- [ ] **Step 1: Run GitNexus impact before replacing the OG handler**

Run upstream impact for `handler` in `api/og-image.js`.

Expected: review the handler blast radius and stop only for HIGH or CRITICAL risk.

- [ ] **Step 2: Write failing validation and handler tests**

Create `tests/ui/api/og-image.test.js`:

```js
import { describe, expect, it } from 'vitest'
import handler from '../../../api/og-image'
import {
  buildOgImagePath,
  validateMenuImageUrl,
} from '../../../api/_og-image'

const supabaseUrl = 'https://project.supabase.co'
const originalImage =
  'https://project.supabase.co/storage/v1/object/public/menus/user/menu.png'

function makeResponse() {
  return {
    statusCode: null,
    location: null,
    redirect(statusCode, location) {
      this.statusCode = statusCode
      this.location = location
    },
  }
}

describe('validateMenuImageUrl', () => {
  it('accepts an image from the configured public menus bucket', () => {
    expect(validateMenuImageUrl(originalImage, supabaseUrl)).toBe(originalImage)
  })

  it.each([
    'https://evil.example/storage/v1/object/public/menus/menu.png',
    'https://project.supabase.co/storage/v1/object/public/avatars/user.png',
    'http://project.supabase.co/storage/v1/object/public/menus/user/menu.png',
    'not-a-url',
  ])('rejects a foreign or malformed image: %s', (image) => {
    expect(validateMenuImageUrl(image, supabaseUrl)).toBeNull()
  })
})

describe('buildOgImagePath', () => {
  it('encodes a valid original image', () => {
    expect(buildOgImagePath(originalImage, supabaseUrl))
      .toBe(`/api/og-image?image=${encodeURIComponent(originalImage)}`)
  })

  it('uses the static fallback for an invalid image', () => {
    expect(buildOgImagePath('https://evil.example/menu.png', supabaseUrl))
      .toBe('/api/og-image')
  })
})

describe('OG image handler', () => {
  it('redirects to the original menu image', () => {
    const response = makeResponse()
    handler({ query: { image: originalImage } }, response)
    expect(response).toMatchObject({ statusCode: 307, location: originalImage })
  })

  it('redirects to the branded fallback without an image', () => {
    const response = makeResponse()
    handler({ query: {} }, response)
    expect(response).toMatchObject({ statusCode: 307, location: '/og-default.png' })
  })
})
```

Set and restore `process.env.VITE_SUPABASE_URL` around handler tests so they use `supabaseUrl`.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```bash
npx vitest run tests/ui/api/og-image.test.js
```

Expected: FAIL because `api/_og-image.js` does not exist and the current handler requires an ID/database lookup.

- [ ] **Step 4: Implement the allowlist helper**

Create `api/_og-image.js`:

```js
const MENU_IMAGE_PATH = '/storage/v1/object/public/menus/'

export function validateMenuImageUrl(value, supabaseUrl = process.env.VITE_SUPABASE_URL) {
  if (typeof value !== 'string' || !value || !supabaseUrl) return null

  try {
    const imageUrl = new URL(value)
    const allowedOrigin = new URL(supabaseUrl).origin
    if (imageUrl.origin !== allowedOrigin) return null
    if (!imageUrl.pathname.startsWith(MENU_IMAGE_PATH)) return null
    return imageUrl.toString()
  } catch {
    return null
  }
}

export function buildOgImagePath(value, supabaseUrl = process.env.VITE_SUPABASE_URL) {
  const imageUrl = validateMenuImageUrl(value, supabaseUrl)
  return imageUrl
    ? `/api/og-image?image=${encodeURIComponent(imageUrl)}`
    : '/api/og-image'
}
```

- [ ] **Step 5: Replace `api/og-image.js` with a redirect-only handler**

```js
import { validateMenuImageUrl } from './_og-image.js'

export default function handler(req, res) {
  const imageUrl = validateMenuImageUrl(req.query.image)
  res.redirect(307, imageUrl ?? '/og-default.png')
}
```

Remove the obsolete OG configuration test from `tests/ui/api/server-supabase.test.js`; server-side Supabase is no longer a dependency of `api/og-image.js`.

- [ ] **Step 6: Run focused API tests**

Run:

```bash
npx vitest run tests/ui/api/og-image.test.js tests/ui/api/server-supabase.test.js
```

Expected: PASS; no Chromium download or database call occurs.

- [ ] **Step 7: Update changelog, stage, inspect impact, and commit**

Append:

```json
"Ảnh xem trước khi chia sẻ luôn ưu tiên ảnh menu gốc và có ảnh mặc định an toàn"
```

Stage Task 2 files, run `gitnexus_detect_changes`, and commit:

```bash
git commit -m "feat: redirect OG previews to menu images"
```

---

### Task 3: Make the share HTML work without anonymous table access

**Files:**
- Modify: `api/share.js:1-120`
- Create: `tests/ui/api/share.test.js`
- Modify: `src/changelog.json`

**Interfaces:**
- Consumes: `buildOgImagePath(image, supabaseUrl)` from `api/_og-image.js`.
- Produces: share HTML containing absolute `og:image` and `twitter:image` URLs.

- [ ] **Step 1: Run GitNexus impact before editing the share handler**

Run upstream impact for `handler` in `api/share.js`.

Expected: review the handler blast radius and stop only for HIGH or CRITICAL risk.

- [ ] **Step 2: Write failing generic-metadata tests**

Create `tests/ui/api/share.test.js`:

```js
import { afterEach, describe, expect, it } from 'vitest'
import handler from '../../../api/share'

const originalUrl = process.env.VITE_SUPABASE_URL
const originalKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const image =
  'https://project.supabase.co/storage/v1/object/public/menus/user/menu.png'

afterEach(() => {
  if (originalUrl === undefined) delete process.env.VITE_SUPABASE_URL
  else process.env.VITE_SUPABASE_URL = originalUrl
  if (originalKey === undefined) delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  else process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalKey
})

function makeResponse() {
  return {
    body: '',
    headers: {},
    location: null,
    statusCode: null,
    redirect(statusCode, location) {
      this.statusCode = statusCode
      this.location = location
    },
    setHeader(name, value) {
      this.headers[name] = value
    },
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
    send(body) {
      this.body = body
      return this
    },
  }
}

async function renderShare(query) {
  delete process.env.VITE_SUPABASE_URL
  delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const response = makeResponse()
  await handler(
    {
      query,
      headers: {
        host: 'lunch.example',
        'x-forwarded-proto': 'https',
      },
    },
    response,
  )
  return response
}

describe('share metadata without anonymous table access', () => {
  it('serves generic metadata with the allowlisted original image', async () => {
    process.env.VITE_SUPABASE_URL = 'https://project.supabase.co'
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY

    const response = makeResponse()
    await handler(
      {
        query: { id: 'menu-1', image },
        headers: {
          host: 'lunch.example',
          'x-forwarded-proto': 'https',
        },
      },
      response,
    )

    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('<title>🍱 Menu cơm trưa</title>')
    expect(response.body).toContain(
      'content="https://lunch.example/api/og-image?image=https%3A%2F%2Fproject.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fmenus%2Fuser%2Fmenu.png"',
    )
    expect(response.body).toContain(
      'content="https://lunch.example/menu/menu-1"',
    )
  })

  it('uses the branded endpoint for a legacy link without an image', async () => {
    const response = await renderShare({ id: 'menu-2' })
    expect(response.statusCode).toBe(200)
    expect(response.body).toContain(
      'content="https://lunch.example/api/og-image"',
    )
  })
})
```

- [ ] **Step 3: Run focused test and verify RED**

Run:

```bash
npx vitest run tests/ui/api/share.test.js
```

Expected: FAIL because the current handler redirects when Supabase returns no menu and ignores the `image` query.

- [ ] **Step 4: Implement fail-open generic metadata**

Import:

```js
import { buildOgImagePath } from './_og-image.js'
```

Keep the missing-ID redirect. Replace Supabase-client setup with an optional lookup:

```js
let menu = null
try {
  const sb = createServerSupabaseClient()
  const { data, error } = await sb
    .from('menus')
    .select('id, title, menu_date, image_url, note, poster:profiles!menus_poster_id_fkey(full_name), orders(id)')
    .eq('id', id)
    .single()
  if (!error) menu = data
} catch {}
```

Do not redirect when `menu` is null. Use safe defaults:

```js
const posterName = menu?.poster?.full_name ?? 'Đồng nghiệp'
const menuTitle = menu?.title ?? 'Menu cơm trưa'
const dateStr = menu?.menu_date ? formatDate(menu.menu_date) : 'Hôm nay'
const orderCount = menu?.orders?.length ?? 0
const ogTitle = menu
  ? `🍱 ${posterName} rủ đặt cơm trưa — ${menuTitle}`
  : '🍱 Menu cơm trưa'
const ogDesc = menu
  ? (dishCount > 0
      ? `Hôm nay có ${dishCount} món ngon nè! ${dishNames}... • ${orderCount} người đã đặt rồi • ${dateStr} • Đặt nhanh kẻo hết chỗ nhé 😄`
      : `${posterName} vừa đăng menu cơm trưa hôm nay! ${orderCount} người đã đặt • ${dateStr} • Click vào xem và đặt ngay nhé 🍽️`)
  : 'Mở menu để xem món và đặt cơm cùng mọi người.'
```

Build the absolute image URL from the validated request parameter:

```js
const ogImage = `${origin}${buildOgImagePath(req.query.image)}`
```

Do not use `menu.image_url` as a fallback because crawlers cannot authenticate the menu lookup;
only the client-supplied, allowlisted `image` parameter selects the original image.

- [ ] **Step 5: Run focused share tests**

Run:

```bash
npx vitest run tests/ui/api/share.test.js tests/ui/api/og-image.test.js
```

Expected: PASS.

- [ ] **Step 6: Update changelog, stage, inspect impact, and commit**

Append:

```json
"Link chia sẻ cũ vẫn mở được với ảnh thương hiệu khi chưa có ảnh menu"
```

Stage Task 3 files, run `gitnexus_detect_changes`, and commit:

```bash
git commit -m "fix: keep anonymous share previews available"
```

---

### Task 4: Add the static fallback and remove runtime image tooling

**Files:**
- Create: `public/og-default.svg`
- Create: `public/og-default.png`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `docs/DEPLOY.md`
- Modify: `src/changelog.json`

**Interfaces:**
- Produces: public asset `/og-default.png`, 1200×630 PNG.
- Removes: `@sparticuz/chromium-min` and `puppeteer-core`.

- [ ] **Step 1: Create the editable fallback artwork**

Create `public/og-default.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f7f3ea"/>
  <circle cx="162" cy="152" r="70" fill="#2f6b4f"/>
  <rect x="119" y="112" width="86" height="76" rx="14" fill="#fffaf0"/>
  <path d="M119 145h86M162 112v76" stroke="#2f6b4f" stroke-width="9"/>
  <circle cx="141" cy="130" r="9" fill="#e9a23b"/>
  <circle cx="183" cy="166" r="10" fill="#d86645"/>
  <rect x="94" y="93" width="136" height="118" rx="26" fill="none"
        stroke="#173c2b" stroke-width="8"/>
  <text x="270" y="137" fill="#2f6b4f" font-family="Arial, sans-serif"
        font-size="34" font-weight="700" letter-spacing="8">CƠM TRƯA</text>
  <text x="94" y="330" fill="#17231c" font-family="Arial, sans-serif"
        font-size="68" font-weight="800">Menu hôm nay đang chờ bạn</text>
  <text x="98" y="410" fill="#657067" font-family="Arial, sans-serif"
        font-size="34">Mở link để xem và đặt món</text>
  <rect x="94" y="492" width="360" height="74" rx="37" fill="#2f6b4f"/>
  <text x="274" y="540" text-anchor="middle" fill="#ffffff"
        font-family="Arial, sans-serif" font-size="28" font-weight="700">XEM MENU NGAY</text>
</svg>
```

Use only vector shapes and system fonts so the raster output is deterministic and contains no
remote font dependency.

- [ ] **Step 2: Render and inspect the PNG**

Run:

```bash
node --input-type=module -e "import sharp from 'sharp'; await sharp('public/og-default.svg').png().toFile('public/og-default.png')"
```

Verify dimensions:

```bash
node --input-type=module -e "import sharp from 'sharp'; console.log(await sharp('public/og-default.png').metadata())"
```

Expected: `width: 1200`, `height: 630`, `format: 'png'`.

Open `public/og-default.png` with the local image viewer and confirm no clipped text, missing
glyphs, or transparent background.

- [ ] **Step 3: Remove unused runtime dependencies**

Run:

```bash
npm uninstall @sparticuz/chromium-min puppeteer-core
```

Then verify:

```bash
rg -n "@sparticuz/chromium-min|puppeteer-core|puppeteer|chromium" api src package.json
```

Expected: no matches.

- [ ] **Step 4: Update deployment documentation**

Update `docs/DEPLOY.md` so the OG section and smoke checklist state:

```text
- Share preview uses the original uploaded menu image.
- Text-only/legacy links use /og-default.png.
- No Puppeteer/Chromium download or runtime rendering is required.
```

- [ ] **Step 5: Update changelog, stage, inspect impact, and commit**

Append:

```json
"Thêm ảnh thương hiệu mặc định cho menu không có ảnh và giảm thời gian tạo bản xem trước"
```

Stage Task 4 files, run `gitnexus_detect_changes`, and commit:

```bash
git commit -m "chore: replace runtime OG rendering with static art"
```

---

### Task 5: Full verification and local HTTP smoke test

**Files:**
- Verify only; no source changes expected.

**Interfaces:**
- Verifies the complete feature and all existing UI/RLS behavior.

- [ ] **Step 1: Run all automated tests**

Run:

```bash
npm run test:all
```

Expected: every UI and RLS test passes with zero failures.

- [ ] **Step 2: Build production assets**

Run:

```bash
npm run build
```

Expected: exit code 0, `dist/og-default.png` exists, and there are no Chromium/Puppeteer bundles.
The known third-party `@vueuse/core` pure-annotation warnings may remain.

- [ ] **Step 3: Start Vercel local runtime**

Run `vercel dev` with the existing public variables loaded from `.env.local`:

```bash
set -a
source .env.local
set +a
vercel dev --yes --listen 4173
```

Expected: `Ready! Available at http://localhost:4173`.

- [ ] **Step 4: Smoke-test valid original and fallback redirects**

Use the configured Supabase origin to construct a bucket URL and run:

```bash
curl -I -G "http://127.0.0.1:4173/api/og-image" \
  --data-urlencode "image=${VITE_SUPABASE_URL}/storage/v1/object/public/menus/qa/menu.png"
curl -I "http://127.0.0.1:4173/api/og-image"
```

Expected:

```text
valid image -> 307 Location: <original-menu-storage-url>
no image    -> 307 Location: /og-default.png
```

Then request:

```bash
curl -sS -G "http://127.0.0.1:4173/api/share" \
  --data-urlencode "id=menu-1" \
  --data-urlencode "image=${VITE_SUPABASE_URL}/storage/v1/object/public/menus/qa/menu.png"
```

Expected: HTTP 200 HTML containing the encoded `/api/og-image?image=...` metadata even if the
anonymous menu lookup returns no row.

- [ ] **Step 5: Browser QA desktop and mobile**

In the local browser:

1. Verify `/`, `/post`, `/history`, `/manage/menus`, `/manage/payments`, and `/profile` still render.
2. At 1280px and 390px widths, confirm no horizontal overflow.
3. Confirm console has no application errors.
4. For an authenticated menu with an image, copy from Today, Post success, Menu detail, and My
   Menus; each clipboard URL must contain one encoded `image` parameter.
5. Confirm a text-only menu link has no `image` parameter and its OG endpoint redirects to
   `/og-default.png`.

- [ ] **Step 6: Final repository checks**

Run:

```bash
git status --short
git diff --check
rg -n "@sparticuz/chromium-min|puppeteer-core|puppeteer|chromium" api src package.json
```

Expected: clean worktree, no whitespace errors, and no runtime image-generation imports.
