# Frontend API (for UI builders / Antigravity)

UI components MUST use these composables — never write raw Supabase queries in components.
Behavioral rules that UI must not violate are in AGENTS.md. Screens to build live in
`src/pages/` (currently TODO stubs): TodayPage, PostMenuPage, DashboardPage, HistoryPage, ProfilePage.

All data-access functions return Supabase-style `{ data, error }` (or `{ error }` for write-only
helpers). Always check `error` before using `data`. Security is enforced server-side by RLS —
these composables never bypass it, and there is **no** client-side way to act on another user's behalf.

---

## Routes (`src/router.js`)

| Path | Page component | Access |
|------|----------------|--------|
| `/sign-in` | `SignInPage.vue` | public |
| `/` | `TodayPage.vue` | signed-in |
| `/post` | `PostMenuPage.vue` | signed-in |
| `/dashboard` | `DashboardPage.vue` | signed-in |
| `/history` | `HistoryPage.vue` | signed-in |
| `/profile` | `ProfilePage.vue` | signed-in |

A global `beforeEach` guard redirects signed-out users to `/sign-in` for any non-public route.
The signed-in shell (`App.vue`) renders a header with Clerk's `<UserButton />` above `<router-view />`.

> Auth-shell note: this project uses `@clerk/vue` 2.x. Conditional rendering uses
> `<Show when="signed-in">` (with a `#fallback` slot for signed-out) — the React-SDK
> `<SignedIn>`/`<SignedOut>` components do not exist in `@clerk/vue`.

---

## `useSupabaseClient()` — `src/lib/supabase.js`

Returns a singleton `SupabaseClient` whose every request carries the current Clerk session token.
UI components normally don't call this directly — the composables below use it. Use it only if you
need a query not covered here (and prefer adding a composable instead).

---

## `useProfile()` — `src/composables/useProfile.js`

- `ensureProfile(): Promise<{ error }>` — upserts the signed-in user's own profile
  (id / full_name / avatar from Clerk). **Never touches `payment_info`** (won't overwrite on
  re-login). Called automatically in `App.vue` on sign-in; UI rarely needs to call it.
- `getProfile(id): Promise<{ data, error }>` — single profile row by id.
- `updateProfile({ full_name, payment_info }): Promise<{ data, error }>` — updates the signed-in
  user's own profile. This is the only way a user sets their bank/payment info.

---

## `useMenus()` — `src/composables/useMenus.js`

- `createMenu({ title, menu_date = todayInVN(), note = null, imageFile = null }): Promise<{ data, error }>`
  — uploads `imageFile` (if any) to `menus/{userId}/...`, sets `image_url`, inserts the menu with
  `poster_id = current user`. The poster is the person who collects payment for that menu.
- `listMenusByDate(date = todayInVN()): Promise<{ data, error }>` — menus on `date`, each with a
  nested `poster` profile (`id, full_name, avatar_url, payment_info`) and its `orders` array. Each
  order also carries a nested `user` (`id, full_name, avatar_url`) = the person who ordered, so the
  Today screen can show "who ordered what".
- `getMenu(id): Promise<{ data, error }>` — one menu with the same nested `poster` + `orders`
  (each order with its nested `user`).

A day can have multiple menus. `payment_info` shown on a menu comes from the poster's profile.

---

## `useOrders()` — `src/composables/useOrders.js`

- `createOrder({ menu_id, item_text, note = null }): Promise<{ data, error }>` — `user_id = current
  user`. Ordering is **free text** (`item_text`); there is no structured menu-item list and no
  automatic price calculation.
- `togglePaid(orderId, isPaid): Promise<{ data, error }>` — sets `is_paid` + `paid_at`.
  **Only callable on the signed-in user's own orders** (RLS `orders_update`). There is **NO** API to
  mark someone else's order paid — payment is a self-tick by the orderer. Do not build a
  "mark paid for them" button; the payment collector only *views* who is unpaid.
- `listMyOrders(): Promise<{ data, error }>` — the signed-in user's own orders, newest first, each
  with a nested `menu` (`id, title, menu_date`). Use for the History screen.

---

## `useDashboard()` — `src/composables/useDashboard.js`

- `unpaidByPersonForMyMenus(date = todayInVN()): Promise<{ data, error }>` — for the payment
  collector view. `data` is grouped by person across all of *my* menus on `date`:

  ```js
  [
    { user_id, full_name, items: [{ menu_title, item_text, order_id }] },
    ...
  ]
  ```

  Only unpaid orders on menus the signed-in user posted are included. Handles multiple menus/day:
  a person who ordered on two of my menus appears once with both items. Marking an order paid
  (the orderer self-ticks via `togglePaid`) drops it from this result.

---

## `src/lib/date.js`

- `todayInVN(): string` → `'YYYY-MM-DD'` for the current day in `Asia/Ho_Chi_Minh` (UTC+7).
  "Today" is always Vietnam time, never UTC — use this for any "today" query.
- `formatVNDate(dateStr): string` → `'DD/MM/YYYY'` for display.
