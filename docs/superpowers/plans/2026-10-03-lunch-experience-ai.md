# Lunch experience and AI implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. The human explicitly chooses implementation first and concentrated testing at the end; this overrides test-first and per-edit test loops.

**Goal:** Give posters restaurant-aware menus and practical management tools, give diners a meal calendar and per-dish feedback, with name-specific suggestions served by a Cloudflare Worker in this repository.

**Architecture:** Vue continues calling Supabase with Clerk tokens and a publishable key for business data. Five additional RLS-protected tables preserve restaurant-specific dish identity and individual items in orders; database triggers synchronize items atomically with parent order writes. An independently deployed `ai-worker/` verifies existing Clerk tokens, reads permitted order context and returns selectable suggestions, with cache and graceful fallback.

**Tech Stack:** Vue/Vite, Supabase Postgres, Clerk, Cloudflare Workers AI, TypeScript/Wrangler. Keep existing root dependencies; pin any new dependencies and commit lockfiles.

**Spec:** ../specs/2026-10-03-main-ui-ux-restaurants-feedback-ai-design.md

## Global constraints

- Base: main `e13f916aabcc43c7a824654f3487f35bf91dac66`, branch `codex/lunch-experience-ai` in the managed worktree.
- No GitNexus. Search all shared-pattern consumers in `src/` before editing.
- Complete implementation before running the concentrated verification batch. Add automatic tests only for meaningful data/permission/contract behavior.
- Clerk identity is text `auth.jwt()->>'sub'`. No service_role or Clerk secret in client or Worker.
- Anyone signed in can post. Multiple menus per Vietnam calendar day. A menu belongs to one restaurant, nullable for legacy/unknown menus.
- Plain text menus allow free text; structured menus require MenuBoard selection with exact dish names. Notes remain free text.
- Preserve manual `menus.is_closed`, copy-summary confirmation and reopening. Closed menus block content changes but allow owner payment and reviews.
- Delegated orders belong to the recipient. The creator may create that order and its items atomically; only the recipient can subsequently change its contents, payment or reviews.
- Frontend on Vercel; Worker code/dependencies/deploy in `ai-worker/` at root, quota belongs to owner's Cloudflare account. No provider/model/quota UI.
- No production database mutation, paid plan activation or external publication as part of local implementation. Produce deployment instructions and reviewable migrations.

## File responsibilities and boundaries

| Area | Files | Responsibility |
|---|---|---|
| Data | `supabase/migrations/*_lunch_catalog_reviews.sql` | Tables, constraints, RLS, atomic synchronization and safe legacy backfill |
| Shared menu adapter | `src/lib/menu.js` | Parse legacy JSON, hydrate relational menus, preserve exact matching and export CSV |
| Calendar | `src/lib/calendar.js` | Vietnam date keys, month grid and query bounds |
| API contract | `shared/feedback.js`, `shared/feedback.d.ts`, `docs/api/feedback-v1.md` | Validated suggestion labels and fallback shared by UI and Worker |
| Data client | `src/composables/useMenus.js`, `useOrders.js`, `useCatalog.js`, `useReviews.js` | Read/write entities through Supabase, no privileged credentials |
| AI client | `src/composables/useFeedbackSuggestions.js` | Session token, abort/timeout, selected-label preservation and local fallback |
| Components | `src/components/catalog/RestaurantPicker.vue`, `src/components/reviews/DishReviewDialog.vue`, `src/components/ui/MenuEditorDialog.vue` | Restaurant selection, inline item review, structured editor for published menus |
| Pages | `src/pages/{TodayPage,MenuPage,PostMenuPage,HistoryPage,MyMenusPage,DashboardPage,CatalogPage,ManagePage}.vue` | Everyday ordering, posting, calendar, catalog and management |
| Shell | `src/App.vue`, `src/router.js`, `src/styles/tokens.css` | Four work areas, minimal visual system and responsive layout |
| Worker | `ai-worker/` only | Authenticated suggestions endpoint, account inference, bounded requests, cache/rate limits and separate deployment |

### Task 1: Relational menus and atomic order items

**Files:** Create CLI-named migration, `src/lib/menu.js`, `src/lib/calendar.js`, shared feedback module/type declaration and API contract. Modify the menus/orders composables and add catalog/review composables.

**Interfaces:**
- `restaurants`: `id,name,branch,created_by,is_active`.
- `restaurant_dishes`: `id,restaurant_id,name,variant,created_by,is_active`.
- `menu_items`: `id,menu_id,restaurant_dish_id,name,price,category,calories,description,available,position`.
- `order_items`: `id,order_id,menu_id,menu_item_id,name_snapshot,restaurant_name_snapshot,position`.
- `dish_reviews`: `id,order_item_id,user_id,rating,labels,note,created_at,updated_at`.
- Menus include `restaurant_id`; orders include `menu_item_ids` plus database-controlled creator/transaction markers for delegated item creation.
- `useMenus.createMenu({title,menu_date,note,imageFile,restaurant_id})`, `updateMenu({id,title,note,restaurant_id})`, `getMenu(id)`, `listMyMenus()`, `setMenuClosed(id,boolean)` keep `{data,error}` results.
- `useOrders.createOrder({menu_id,item_text,note,user_id,menu_item_ids})`, `updateOrder({id,item_text,note,menu_item_ids})`; `listMyOrders({from,to})` returns nested menu and items/reviews.
- `useCatalog`: `listRestaurants()`, `createRestaurant({name,branch})`, `listDishes(restaurantId)`.
- `useReviews`: `saveReview({order_item_id,rating,labels,note})`, `deleteReview(id)`, `listRestaurantReviews(restaurantId)`.

- [ ] Create migration through Supabase CLI; create tables with bounded text/rating/label constraints, indexes and explicit grants. Enable RLS on every new table; catalog/reviews readable by signed-in users, writes owned by creator/parent owner.
- [ ] Add `save_lunch_menu(p_id,p_title,p_menu_date,p_note,p_restaurant_id,p_image_url)` as SECURITY INVOKER. It inserts/updates a poster's menu, creates/reuses exact dishes within its restaurant and synchronizes menu items and JSON projection in one transaction. Validate duplicate names, finite nonnegative prices, maximum 200 items and restaurant membership. Preserve IDs and prohibit removing/reassigning ordered items or changing a known restaurant after orders exist.
- [ ] Synchronize `order_items` in database triggers on insert/content update. Set creator and transaction markers in a before trigger; children may be inserted by the delegated creator only within the creating transaction. Subsequent item writes require parent ownership and a parent synchronization transaction. Freeze parent ID/user/menu links and child snapshot links. Check menu closed/availability and create only exact item matches. Preserve IDs/reviews for unchanged selections.
- [ ] Backfill valid legacy structured menus without assigning a guessed restaurant; backfill only exact order matches. Preserve unparseable text as one unlinked item, excluded from canonical restaurant averages. Do not alter payment data.
- [ ] Implement menu adapter with these pure interfaces:

```js
export function parseMenuNote(note) { // null for plain/invalid notes
  try {
    const value = JSON.parse(note)
    if (!Array.isArray(value?.dishes) || !value.dishes.every(d => typeof d.name === 'string' && d.name.trim())) return null
    return value
  } catch { return null }
}
export function normalizeMenu(menu) {
  const parsed = parseMenuNote(menu.note)
  const items = menu.menu_items?.length ? [...menu.menu_items].sort((a,b) => a.position-b.position) : parsed?.dishes
  return items ? {...menu,note:JSON.stringify({...parsed,dishes:items})} : menu
}
```

- [ ] Implement calendar helpers `monthBounds(monthKey)`, `monthDays(monthKey)`, `shiftMonth(monthKey,offset)` and query ranges using ISO date-only strings and UTC arithmetic for grid construction; derive current date from existing `todayInVN()`.
- [ ] Implement composables with signed-in guards, explicit foreign keys, owner filters and stable query ranges. Use `save_lunch_menu` for menu edits/creation, retaining image upload cleanup on failure.
- [ ] Write shared functions `fallbackLabels(name)` and `validateLabels(value)` returning 4–6 unique strings at most 48 characters; feedback examples differ for grilled meat, fried dishes, soups and vegetables.

### Task 2: Cloudflare suggestion service

**Files:** Create `ai-worker/package.json`, `package-lock.json`, `wrangler.jsonc`, `tsconfig.json`, `.dev.vars.example`, `.gitignore`, `README.md`, source modules and focused contract tests. Ownership: this task edits only `ai-worker/`.

**Interfaces:** Import shared `fallbackLabels`/`validateLabels` from `../../shared/feedback.js` when useful. Business tables/column names above are the contract; no business writes from Worker.

```json
// POST /v1/feedback-suggestions, Authorization: Bearer <existing Clerk token>
{"order_id":"uuid","order_item_ids":["uuid"],"locale":"vi"}
// 200 response
{"version":"1","suggestions":[{"order_item_id":"uuid","labels":["Thịt mềm","Hơi dai","Ướp vừa","Hơi mặn"],"source":"ai"}]}
```

- [ ] Install pinned current TypeScript/Wrangler/jose dependencies, generate binding types using `wrangler types`. Use compatibility date `2026-10-03`, `nodejs_compat`, observability without tokens, images or personal notes.
- [ ] Configure AI binding and rate limit bindings; nonsecret settings: `CLERK_ISSUER`, `ALLOWED_ORIGINS`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Owner supplies account configuration at deployment; do not deploy or change billing.
- [ ] Verify public JWKS signature using pinned HTTPS issuer, RS256, exp/nbf and azp matching allowed app origins. Require an authenticated subject, bound request body (max 16 KiB), UUID IDs, `vi` locale and 1–20 items. Validate Origin/CORS and apply per-user/service rate limits before inference.
- [ ] Read order/items through Supabase REST with publishable key plus user's token. Explicitly verify `orders.user_id === token.sub`, that every requested item belongs to that order, and that menu date is not in future in Vietnam. Reject missing or foreign IDs with a generic 403.
- [ ] Build prompts only from bounded dish names/categories, treating those as data. Ask for balanced positive/negative Vietnamese selectable labels, no star rating or saved review. Use a documented free-supported Workers AI text model, bounded output, request timeout and strict JSON validation.
- [ ] Cache by normalized dish snapshot/category/locale/prompt-model version only, using hashed keys and Cache API. Cache writes use `ctx.waitUntil`. Do not include user IDs/tokens/notes in cache keys or logs.
- [ ] Return shared fallback labels on provider timeout/quota/invalid JSON while preserving item mapping. Return 401/403 for auth/ownership failures, 413 for oversized body, 429 for local rate limits. Health endpoint returns version without user data.
- [ ] Document local/deploy/configuration commands, Free account limits and independent deploy. OCR migration is quality-gated after a real Vietnamese image benchmark; retain existing OCR until benchmark evidence exists.
- [ ] Prepare focused tests for malformed body, JWT, ownership and provider fallback after implementation; do not run them until the final verification batch.

### Task 3: Minimal daily UI, posting and management

**Files:** App/router/tokens, existing pages/components listed above, new restaurant/review/editor components and new Catalog/Manage pages. Ownership excludes `ai-worker/`.

**Interfaces:** Use Task 1 composables. AI client calls Task 2 contract using `VITE_AI_API_BASE_URL` and existing Clerk session token; local fallback when URL missing or API unavailable.

- [ ] Change navigation to Today `/`, Calendar `/history`, Catalog `/catalog`, Manage `/manage`; post remains a visible action and profile stays in account actions. Preserve `/post`, `/my-menus`, `/dashboard`, `/menu/:id` and share URLs. Use warm white, green action color, clear type, restrained borders, reduced decorative animations and mobile safe areas.
- [ ] Make Today menu cards show restaurant, open/closed state and concise previews rather than full menu/orders. Show user's orders and direct links/payment/review actions. Route content editing to the shared menu selection path so closed/structured rules cannot diverge.
- [ ] Add RestaurantPicker before image/text selection. Reuse existing MenuBoard edit mode for OCR confirmation. Save restaurant association, isolate drafts by account and allow reuse of an earlier restaurant menu as a new-day draft. Remove provider/model/quota copy from posting UI.
- [ ] Add a structured editor for published menus. Select restaurant until identity is locked by existing orders; preserve stable item IDs, make sold-out toggles visible, expose plain text notes only for plain menus. Save errors retain changes.
- [ ] Keep MenuPage structured selection, free note, delegated recipient, QR and summary behavior. Pass selected item IDs; display restaurant and per-dish rating context; label summary copy as “Sao chép & chốt đơn” while open. Reduce repeated/decorative blocks without changing business controls.
- [ ] Implement month calendar with Monday start, previous/next/today controls, desktop day panel and compact mobile cells. Query visible range; cancel/ignore stale loads on month/account changes. Show all orders per day including delegated ones, owner payment and review, and separate unpaid count.
- [ ] Implement per-item review dialog: no preselected stars, 4–6 selectable labels, optional note max 1,000 chars. Load AI with timeout/abort; selected labels survive late responses, edit/clear respects ownership. Saving writes selected rating/labels/note to Supabase only.
- [ ] Implement restaurant catalog with search, dishes specific to restaurant, average/count/unique reviewers and recent feedback. Signed-in-only read. Unlinked legacy items remain readable and never contribute to guessed canonical averages.
- [ ] Improve management with restaurant-aware menu list, open/reopen controls, structured edit, reuse and CSV export, and tabs by dish/person/unpaid. Dashboard filters use menu IDs. Poster only reads payment status.

### Task 4: Concentrated verification and handoff

**Files:** Meaningful shared/calendar/data tests, focused Worker tests, deployment guide, AGENTS.md and Vietnamese changelog.

- [ ] After Tasks 1–3 are implemented, install dependencies and run one production build, focused pure/UI behavior tests and Worker typecheck/contract tests. Verify migration against isolated local Postgres with Clerk-style text-sub claims and RLS; no production mutation.
- [ ] Verify two restaurants with identical dish names, two days of the same dish, multiple dishes/order, delegated ownership, closed-menu content blocking with payment/review still allowed, review/link forgery rejection and preserved legacy data.
- [ ] Walk through mobile/desktop navigation, posting, selection, calendar, feedback and management; distinguish missing environment credentials from application failures. Capture usable UI evidence when authentication permits it.
- [ ] Review complete diff for spec compliance and quality. Fix discovered failures, then rerun only affected checks.
- [ ] Update AGENTS.md to reflect approved additive schema and AI exception; update `src/changelog.json` for `2026-10-03` with user-facing Vietnamese changes. Document migrations/configuration/independent deployments and OCR benchmark prerequisite.
- [ ] Keep local work on the feature branch, report actual checks and remaining external configuration. Do not claim live Cloudflare AI, production migration or OCR quality without direct evidence.
