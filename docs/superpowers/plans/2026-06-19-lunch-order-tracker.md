# Lunch Order Tracker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the logic foundation of an internal lunch-order tracker (Vue + Clerk + Supabase, no backend) — schema, RLS, auth wiring, and a clean data-access layer of composables — leaving UI/visual layout open for Antigravity to build on top.

**Architecture:** Static Vue (Vite) app on Vercel calls Supabase directly from the browser. Clerk handles Google login and issues a session token; Supabase reads that token and **RLS is the entire security boundary**. No backend, no serverless functions, no secret keys in code.

**Tech Stack:** Vue 3 + Vite, `@clerk/vue`, `@supabase/supabase-js`, `vue-router`, Supabase (Postgres + Storage), Vercel.

## Global Constraints

- **Free tier only** — Vercel, Supabase, Clerk. < 25 users, no quota risk.
- **No backend** — frontend talks to Supabase directly. No Express / serverless / Clerk webhook. If a task seems to need `service_role` or a webhook, STOP and revisit the design.
- **Security = RLS, not key-hiding.** Frontend holds only publishable keys (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`) — all public by design. NEVER put `service_role` (Supabase) or Clerk secret key in code/frontend/git.
- **Clerk uses string ids, not UUIDs.** `auth.uid()` does NOT work — always use `auth.jwt()->>'sub'`. `profiles.id` and all user FKs are `text`.
- **Behavioral contract (UI must not contradict):** ordering = free text; payment = boolean self-tick; only the order owner can change `is_paid` (no "mark paid for them" button); anyone can post a menu; payment info lives on poster's profile; "today" is computed in Vietnam time (UTC+7); profile provisioning = client-side upsert on first login (no webhook).
- **Testing: MANUAL ONLY** (per user). No automated/unit/e2e test suites. Each task ends with concrete manual verification steps the user performs. RLS is verified via a paste-into-Supabase SQL check (not e2e).
- Spec reference: `docs/superpowers/specs/2026-06-19-lunch-order-tracker-design.md`. Agent context: `AGENTS.md`.

---

## File Structure

```
.
├── index.html
├── package.json
├── vite.config.js
├── vercel.json                      # SPA rewrite for vue-router
├── .env.example                     # exists; names only
├── .env.local                       # user-filled; gitignored
├── supabase/
│   └── migrations/
│       ├── 0001_schema_rls.sql      # tables + indexes + RLS
│       └── 0002_storage.sql         # storage bucket + policy
├── src/
│   ├── main.js                      # Vue app + clerkPlugin + router
│   ├── App.vue                      # signed-in/out shell, ensureProfile on login
│   ├── router.js                    # routes + auth guard
│   ├── lib/
│   │   ├── supabase.js              # useSupabaseClient() — Clerk token wired
│   │   └── date.js                  # todayInVN(), formatVNDate()
│   ├── composables/
│   │   ├── useProfile.js            # ensureProfile, getProfile, updateProfile
│   │   ├── useMenus.js              # createMenu, listMenusByDate, getMenu
│   │   ├── useOrders.js             # createOrder, togglePaid, listMyOrders
│   │   └── useDashboard.js          # unpaidByPersonForMyMenus
│   └── pages/                       # minimal route stubs; Antigravity builds real UI
└── docs/domain/frontend-api.md      # composable contract for Antigravity
```

Each composable is one focused module exposing async functions returning `{ data, error }` (Supabase-style). Antigravity builds screens against these — it never writes raw Supabase queries.

---

### Task 1: Scaffold Vue + Vite project and dependencies

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/App.vue`, `vercel.json`
- Already present: `.env.example`, `.gitignore`

**Interfaces:**
- Produces: a runnable Vite dev server; `import.meta.env.VITE_*` available to all later tasks.

- [ ] **Step 1: Scaffold and install**

```bash
npm create vite@latest . -- --template vue
npm install
npm install @clerk/vue @supabase/supabase-js vue-router
```
(If the dir is non-empty, choose "Ignore files and continue". Keep the generated `src/` then overwrite in later steps.)

- [ ] **Step 2: Add SPA rewrite for Vercel**

Create `vercel.json`:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

- [ ] **Step 3: Manual verify**

Run: `npm run dev`
Expected: dev server starts at `http://localhost:5173` and shows the default Vite+Vue page. Open it in a browser to confirm.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vue+Vite project with Clerk, Supabase, router deps"
```

---

### Task 2: Provision external services (Clerk + Supabase) and wire native integration

> This task is dashboard configuration the user performs — no app code. Its deliverable is working credentials in `.env.local` and a live Clerk↔Supabase link. Required before auth (Task 5) and schema (Task 3) can be verified.

**Files:**
- Modify: `.env.local` (create from `.env.example`, fill values; gitignored)

- [ ] **Step 1: Create Clerk application**

In Clerk dashboard: create app → enable **Google** as social connection. Copy the **Publishable key** (`pk_...`). Do NOT copy the secret key — it is never used.

- [ ] **Step 2: Create Supabase project**

In Supabase dashboard: create a project. From Project Settings → API, copy **Project URL** and the **publishable/anon key**. Do NOT copy `service_role`.

- [ ] **Step 3: Wire Clerk as Supabase third-party auth provider**

In Clerk dashboard → Supabase integration setup → enable → copy the revealed **Clerk domain** (e.g. `xxx.clerk.accounts.dev`). Ensure the integration adds the `role: "authenticated"` claim to session tokens (Clerk's setup page does this automatically).
In Supabase dashboard → Authentication → Sign In / Providers → add **Clerk** → paste the Clerk domain.

- [ ] **Step 4: Fill `.env.local`**

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
VITE_CLERK_PUBLISHABLE_KEY=pk_...
```

- [ ] **Step 5: Manual verify**

Confirm `.env.local` has all three values and is listed in `.gitignore` (run `git status` — `.env.local` must NOT appear). No secret keys present.

---

### Task 3: Database schema + RLS migration

**Files:**
- Create: `supabase/migrations/0001_schema_rls.sql`

**Interfaces:**
- Produces: tables `profiles` (id text PK), `menus`, `orders` with RLS enforced via `auth.jwt()->>'sub'`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0001_schema_rls.sql`:
```sql
-- profiles: 1 row per user, id = Clerk user id
create table profiles (
  id            text primary key,
  full_name     text,
  avatar_url    text,
  payment_info  text,
  created_at    timestamptz not null default now()
);

create table menus (
  id          uuid primary key default gen_random_uuid(),
  poster_id   text not null references profiles(id),
  menu_date   date not null,
  title       text not null,
  image_url   text,
  note        text,
  created_at  timestamptz not null default now()
);

create table orders (
  id         uuid primary key default gen_random_uuid(),
  menu_id    uuid not null references menus(id) on delete cascade,
  user_id    text not null references profiles(id),
  item_text  text not null,
  note       text,
  is_paid    boolean not null default false,
  paid_at    timestamptz,
  created_at timestamptz not null default now()
);

create index on menus (menu_date);
create index on orders (menu_id);
create index on orders (user_id);

-- RLS: sub = auth.jwt()->>'sub' = Clerk user id
alter table profiles enable row level security;
create policy profiles_select on profiles for select to authenticated using (true);
create policy profiles_insert on profiles for insert to authenticated
  with check (id = (select auth.jwt()->>'sub'));
create policy profiles_update on profiles for update to authenticated
  using (id = (select auth.jwt()->>'sub'))
  with check (id = (select auth.jwt()->>'sub'));

alter table menus enable row level security;
create policy menus_select on menus for select to authenticated using (true);
create policy menus_insert on menus for insert to authenticated
  with check (poster_id = (select auth.jwt()->>'sub'));
create policy menus_update on menus for update to authenticated
  using (poster_id = (select auth.jwt()->>'sub'))
  with check (poster_id = (select auth.jwt()->>'sub'));
create policy menus_delete on menus for delete to authenticated
  using (poster_id = (select auth.jwt()->>'sub'));

alter table orders enable row level security;
create policy orders_select on orders for select to authenticated using (true);
create policy orders_insert on orders for insert to authenticated
  with check (user_id = (select auth.jwt()->>'sub'));
create policy orders_update on orders for update to authenticated
  using (user_id = (select auth.jwt()->>'sub'))
  with check (user_id = (select auth.jwt()->>'sub'));
create policy orders_delete on orders for delete to authenticated
  using (user_id = (select auth.jwt()->>'sub'));
```

- [ ] **Step 2: Run the migration**

Paste the file contents into Supabase dashboard → SQL Editor → Run. Expected: "Success, no rows returned".

- [ ] **Step 3: Manual verify RLS (paste-into-SQL check — not e2e)**

In SQL Editor, simulate two users and confirm cross-user writes are denied:
```sql
-- seed two profiles directly (bypasses RLS as table owner — setup only)
insert into profiles (id, full_name) values ('user_A','A'), ('user_B','B');
insert into menus (id, poster_id, menu_date, title)
  values ('11111111-1111-1111-1111-111111111111','user_A', current_date, 'A''s menu');

-- act as user_A
set request.jwt.claims = '{"sub":"user_A","role":"authenticated"}';
set role authenticated;
-- A can insert own order: OK
insert into orders (menu_id, user_id, item_text)
  values ('11111111-1111-1111-1111-111111111111','user_A','com ga');
-- A inserting an order AS user_B: must FAIL (new row violates RLS)
insert into orders (menu_id, user_id, item_text)
  values ('11111111-1111-1111-1111-111111111111','user_B','com ca');
reset role; reset request.jwt.claims;
```
Expected: first insert succeeds; the second FAILS with "new row violates row-level security policy". If the second succeeds, the `orders_insert` policy is wrong — fix before continuing.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_schema_rls.sql
git commit -m "feat: db schema + RLS policies (Clerk sub-based)"
```

---

### Task 4: Storage bucket + upload policy

**Files:**
- Create: `supabase/migrations/0002_storage.sql`

**Interfaces:**
- Produces: public-read bucket `menus`; authenticated users upload only into `menus/{their_sub}/...`.

- [ ] **Step 1: Create bucket**

Supabase dashboard → Storage → New bucket → name `menus` → **Public** bucket (public read). Create.

- [ ] **Step 2: Write upload policy**

Create `supabase/migrations/0002_storage.sql`:
```sql
create policy "menu upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'menus'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );
```
Paste into SQL Editor → Run.

- [ ] **Step 3: Manual verify**

After Task 9 wires upload, confirm: uploading produces a file at path `menus/<your clerk id>/<filename>` and the public URL loads in a browser. (No standalone check needed before Task 9.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_storage.sql
git commit -m "feat: storage bucket + own-folder upload policy"
```

---

### Task 5: Clerk provider + auth shell + router guard

**Files:**
- Modify: `src/main.js`, `src/App.vue`
- Create: `src/router.js`, `src/pages/SignInPage.vue`

**Interfaces:**
- Consumes: `VITE_CLERK_PUBLISHABLE_KEY` (Task 2).
- Produces: a signed-in app shell; `useSession()` / `useUser()` available app-wide; router guard redirecting signed-out users to `/sign-in`.

- [ ] **Step 1: Wire clerkPlugin and router in `main.js`**

```js
import { createApp } from 'vue'
import { clerkPlugin } from '@clerk/vue'
import App from './App.vue'
import router from './router'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!PUBLISHABLE_KEY) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY')

createApp(App)
  .use(router)
  .use(clerkPlugin, { publishableKey: PUBLISHABLE_KEY })
  .mount('#app')
```

- [ ] **Step 2: Auth shell in `App.vue`**

```vue
<script setup>
import { SignedIn, SignedOut, UserButton } from '@clerk/vue'
</script>

<template>
  <SignedIn>
    <header><UserButton /></header>
    <router-view />
  </SignedIn>
  <SignedOut>
    <router-view />
  </SignedOut>
</template>
```

- [ ] **Step 3: `src/pages/SignInPage.vue`**

```vue
<script setup>
import { SignIn } from '@clerk/vue'
</script>
<template>
  <SignIn />
</template>
```

- [ ] **Step 4: `src/router.js` with auth guard**

```js
import { createRouter, createWebHistory } from 'vue-router'
import SignInPage from './pages/SignInPage.vue'

const routes = [
  { path: '/sign-in', component: SignInPage, meta: { public: true } },
  { path: '/', component: () => import('./pages/TodayPage.vue') },
  { path: '/post', component: () => import('./pages/PostMenuPage.vue') },
  { path: '/dashboard', component: () => import('./pages/DashboardPage.vue') },
  { path: '/history', component: () => import('./pages/HistoryPage.vue') },
  { path: '/profile', component: () => import('./pages/ProfilePage.vue') },
]

const router = createRouter({ history: createWebHistory(), routes })

// guard: redirect to /sign-in when Clerk reports signed-out
router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const clerk = window.Clerk
  if (clerk) { await clerk.loaded; if (!clerk.user) return '/sign-in' }
  return true
})

export default router
```
Create empty stub pages for `TodayPage.vue`, `PostMenuPage.vue`, `DashboardPage.vue`, `HistoryPage.vue`, `ProfilePage.vue` each containing only `<template><div>TODO</div></template>` (Antigravity replaces these).

- [ ] **Step 5: Manual verify**

Run `npm run dev`. Visit `/` → redirected to `/sign-in` → sign in with Google → land on app shell with a `UserButton`. Confirm signing out returns you to `/sign-in`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: Clerk auth shell + router with auth guard"
```

---

### Task 6: Supabase client composable (Clerk token wired)

**Files:**
- Create: `src/lib/supabase.js`

**Interfaces:**
- Consumes: `useSession` from `@clerk/vue`; `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Produces: `useSupabaseClient()` returning a singleton `SupabaseClient` whose every request carries the current Clerk session token.

- [ ] **Step 1: Write the composable**

```js
import { createClient } from '@supabase/supabase-js'
import { useSession } from '@clerk/vue'

let client = null

export function useSupabaseClient() {
  const { session } = useSession()
  if (!client) {
    client = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      {
        // accessToken is called per-request; reads the live session ref each time
        accessToken: async () => (await session.value?.getToken()) ?? null,
      },
    )
  }
  return client
}
```

- [ ] **Step 2: Manual verify**

Temporarily in `TodayPage.vue` `<script setup>`:
```js
import { useSupabaseClient } from '../lib/supabase'
const sb = useSupabaseClient()
sb.from('profiles').select('*').then(r => console.log('profiles select', r))
```
Run dev, sign in, open browser console. Expected: a successful response (`error: null`, `data: []` or seeded rows), NOT a 401/permission error. Remove the temporary code after verifying.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.js && git commit -m "feat: Supabase client composable with Clerk token"
```

---

### Task 7: Vietnam-timezone date utility

**Files:**
- Create: `src/lib/date.js`

**Interfaces:**
- Produces: `todayInVN(): string` → `'YYYY-MM-DD'` for the current day in `Asia/Ho_Chi_Minh`; `formatVNDate(dateStr): string` → human label.

- [ ] **Step 1: Write the util**

```js
// Day boundaries follow Vietnam time (UTC+7), never UTC.
export function todayInVN() {
  // en-CA gives YYYY-MM-DD; timeZone pins the day to Vietnam
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date())
}

export function formatVNDate(dateStr) {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}
```

- [ ] **Step 2: Manual verify**

In the browser console (or a temporary import): `todayInVN()` returns today's date in Vietnam as `YYYY-MM-DD`. Sanity check: if your machine clock is set near UTC midnight, the returned date should still match the Vietnam calendar day (7h ahead of UTC).

- [ ] **Step 3: Commit**

```bash
git add src/lib/date.js && git commit -m "feat: Vietnam-timezone date util"
```

---

### Task 8: Profile provisioning + read/update composable

**Files:**
- Create: `src/composables/useProfile.js`
- Modify: `src/App.vue` (call `ensureProfile` after sign-in)

**Interfaces:**
- Consumes: `useSupabaseClient()`, `useUser()` from `@clerk/vue`.
- Produces:
  - `ensureProfile(): Promise<{ error }>` — upsert own profile (id/name/avatar from Clerk), never touches `payment_info`.
  - `getProfile(id): Promise<{ data, error }>`
  - `updateProfile({ full_name, payment_info }): Promise<{ data, error }>`

- [ ] **Step 1: Write the composable**

```js
import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'

export function useProfile() {
  const { user } = useUser()
  const sb = useSupabaseClient()

  // Client-side provisioning on first login. NO webhook (would need a backend).
  async function ensureProfile() {
    const u = user.value
    if (!u) return { error: new Error('not signed in') }
    const { error } = await sb.from('profiles').upsert(
      { id: u.id, full_name: u.fullName, avatar_url: u.imageUrl },
      { onConflict: 'id' }, // does not overwrite payment_info
    )
    return { error }
  }

  async function getProfile(id) {
    return sb.from('profiles').select('*').eq('id', id).single()
  }

  async function updateProfile({ full_name, payment_info }) {
    const u = user.value
    return sb.from('profiles')
      .update({ full_name, payment_info })
      .eq('id', u.id)
      .select()
      .single()
  }

  return { ensureProfile, getProfile, updateProfile }
}
```

- [ ] **Step 2: Call `ensureProfile` after sign-in in `App.vue`**

```vue
<script setup>
import { watch } from 'vue'
import { useUser, SignedIn, SignedOut, UserButton } from '@clerk/vue'
import { useProfile } from './composables/useProfile'

const { isSignedIn } = useUser()
const { ensureProfile } = useProfile()
watch(isSignedIn, (v) => { if (v) ensureProfile() }, { immediate: true })
</script>
```
(Keep the `<template>` from Task 5.)

- [ ] **Step 3: Manual verify**

Sign in with a fresh Google account. In Supabase → Table editor → `profiles`, confirm a new row with your Clerk id, name, and avatar appeared. Confirm `payment_info` is null (not overwritten on re-login).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: client-side profile provisioning + read/update"
```

---

### Task 9: Menus data-access composable (with image upload)

**Files:**
- Create: `src/composables/useMenus.js`

**Interfaces:**
- Consumes: `useSupabaseClient()`, `useUser()`, `todayInVN()`.
- Produces:
  - `createMenu({ title, menu_date, note, imageFile }): Promise<{ data, error }>` — uploads `imageFile` (if any) to `menus/{userId}/...`, sets `image_url`, inserts menu with `poster_id = userId`.
  - `listMenusByDate(date = todayInVN()): Promise<{ data, error }>` — menus on date, each with poster profile + its orders.
  - `getMenu(id): Promise<{ data, error }>`

- [ ] **Step 1: Write the composable**

```js
import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'
import { todayInVN } from '../lib/date'

export function useMenus() {
  const { user } = useUser()
  const sb = useSupabaseClient()

  async function createMenu({ title, menu_date = todayInVN(), note = null, imageFile = null }) {
    const uid = user.value?.id
    if (!uid) return { error: new Error('not signed in') }

    let image_url = null
    if (imageFile) {
      const path = `${uid}/${Date.now()}-${imageFile.name}`
      const up = await sb.storage.from('menus').upload(path, imageFile)
      if (up.error) return { error: up.error }
      image_url = sb.storage.from('menus').getPublicUrl(path).data.publicUrl
    }

    return sb.from('menus')
      .insert({ poster_id: uid, title, menu_date, note, image_url })
      .select()
      .single()
  }

  async function listMenusByDate(date = todayInVN()) {
    return sb.from('menus')
      .select('*, poster:profiles!menus_poster_id_fkey(id,full_name,avatar_url,payment_info), orders(*)')
      .eq('menu_date', date)
      .order('created_at', { ascending: true })
  }

  async function getMenu(id) {
    return sb.from('menus')
      .select('*, poster:profiles!menus_poster_id_fkey(id,full_name,avatar_url,payment_info), orders(*)')
      .eq('id', id)
      .single()
  }

  return { createMenu, listMenusByDate, getMenu }
}
```

- [ ] **Step 2: Manual verify**

Temporarily call `createMenu({ title: 'Test', note: 'hello' })` then `listMenusByDate()` from a page's `<script setup>` and log the result. Expected: menu inserted with your id as `poster_id`; `listMenusByDate()` returns it with a nested `poster` object and empty `orders` array. Then test with an image file via a temporary `<input type="file">` and confirm `image_url` is a working public URL pointing at `menus/<your id>/...` (this also verifies Task 4). Remove temporary code after.

- [ ] **Step 3: Commit**

```bash
git add src/composables/useMenus.js && git commit -m "feat: menus data-access composable + image upload"
```

---

### Task 10: Orders data-access composable

**Files:**
- Create: `src/composables/useOrders.js`

**Interfaces:**
- Consumes: `useSupabaseClient()`, `useUser()`.
- Produces:
  - `createOrder({ menu_id, item_text, note }): Promise<{ data, error }>` — `user_id = current user`.
  - `togglePaid(orderId, isPaid): Promise<{ data, error }>` — sets `is_paid` + `paid_at`. RLS guarantees only own orders.
  - `listMyOrders(): Promise<{ data, error }>` — own orders newest first, with menu date/title.

- [ ] **Step 1: Write the composable**

```js
import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'

export function useOrders() {
  const { user } = useUser()
  const sb = useSupabaseClient()

  async function createOrder({ menu_id, item_text, note = null }) {
    const uid = user.value?.id
    if (!uid) return { error: new Error('not signed in') }
    return sb.from('orders')
      .insert({ menu_id, user_id: uid, item_text, note })
      .select()
      .single()
  }

  // Only the order owner can update is_paid (enforced by RLS orders_update).
  async function togglePaid(orderId, isPaid) {
    return sb.from('orders')
      .update({ is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null })
      .eq('id', orderId)
      .select()
      .single()
  }

  async function listMyOrders() {
    const uid = user.value?.id
    return sb.from('orders')
      .select('*, menu:menus(id,title,menu_date)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
  }

  return { createOrder, togglePaid, listMyOrders }
}
```

- [ ] **Step 2: Manual verify**

With a menu existing (Task 9): call `createOrder({ menu_id, item_text: 'com ga' })` → inserted with your id. Call `togglePaid(orderId, true)` → `is_paid=true`, `paid_at` set. Then confirm the RLS guard already proven in Task 3 Step 3 (a user cannot toggle another user's order) — no new e2e needed; the policy is the same `orders_update`.

- [ ] **Step 3: Commit**

```bash
git add src/composables/useOrders.js && git commit -m "feat: orders data-access composable (create, toggle paid, history)"
```

---

### Task 11: Dashboard query composable

**Files:**
- Create: `src/composables/useDashboard.js`

**Interfaces:**
- Consumes: `useSupabaseClient()`, `useUser()`, `todayInVN()`.
- Produces: `unpaidByPersonForMyMenus(date = todayInVN()): Promise<{ data, error }>` where `data` is `[{ user_id, full_name, items: [{ menu_title, item_text, order_id }] }]` — unpaid orders on MY menus on `date`, grouped by person. Handles multiple menus/day.

- [ ] **Step 1: Write the composable**

```js
import { useUser } from '@clerk/vue'
import { useSupabaseClient } from '../lib/supabase'
import { todayInVN } from '../lib/date'

export function useDashboard() {
  const { user } = useUser()
  const sb = useSupabaseClient()

  async function unpaidByPersonForMyMenus(date = todayInVN()) {
    const uid = user.value?.id
    // all my menus on this date, with their unpaid orders + orderer profile
    const { data, error } = await sb.from('menus')
      .select('id,title,orders(id,item_text,is_paid,user_id,user:profiles!orders_user_id_fkey(full_name))')
      .eq('poster_id', uid)
      .eq('menu_date', date)
    if (error) return { error }

    // group unpaid orders across all my menus by person
    const byPerson = new Map()
    for (const menu of data) {
      for (const o of menu.orders) {
        if (o.is_paid) continue
        const entry = byPerson.get(o.user_id) ?? {
          user_id: o.user_id, full_name: o.user?.full_name, items: [],
        }
        entry.items.push({ menu_title: menu.title, item_text: o.item_text, order_id: o.id })
        byPerson.set(o.user_id, entry)
      }
    }
    return { data: [...byPerson.values()] }
  }

  return { unpaidByPersonForMyMenus }
}
```

- [ ] **Step 2: Manual verify**

Seed (via the app) two menus you posted today, each with an unpaid order from a different person (use a second test account, or insert via Table editor). Call `unpaidByPersonForMyMenus()` and log: expect one entry per unpaid person, each listing their items across both menus. Mark one order paid → it drops out of the result.

- [ ] **Step 3: Commit**

```bash
git add src/composables/useDashboard.js && git commit -m "feat: dashboard unpaid-by-person query"
```

---

### Task 12: Frontend API contract doc for Antigravity

**Files:**
- Create: `docs/domain/frontend-api.md`

**Interfaces:**
- Produces: the documented composable contract Antigravity builds UI against.

- [ ] **Step 1: Write the contract doc**

Create `docs/domain/frontend-api.md` documenting every composable's exported functions, their parameters, and return shapes — copied verbatim from the `Interfaces > Produces` blocks of Tasks 6–11, plus the route list from Task 5. Add at top:
```markdown
# Frontend API (for UI builders / Antigravity)

UI components MUST use these composables — never write raw Supabase queries in components.
Behavioral rules that UI must not violate are in AGENTS.md. Screens to build live in
`src/pages/` (currently TODO stubs): TodayPage, PostMenuPage, DashboardPage, HistoryPage, ProfilePage.
```
Then list, for each composable, the functions and shapes (e.g. `useOrders().togglePaid(orderId, isPaid)` — only callable on the signed-in user's own orders; there is NO API to mark someone else's order paid).

- [ ] **Step 2: Manual verify**

Read the doc against `AGENTS.md` and the composable files: every exported function appears, signatures match the code, and the "no mark-paid-for-others" rule is stated. Fix mismatches.

- [ ] **Step 3: Commit**

```bash
git add docs/domain/frontend-api.md
git commit -m "docs: frontend composable API contract for UI builders"
```

---

## Self-Review

**Spec coverage:**
- §3.1 Clerk↔Supabase native auth → Tasks 2, 6. ✓
- §3.2 key safety → Global Constraints + Task 2 (no secrets). ✓
- §4 data model → Task 3. ✓
- §5 RLS policies → Task 3 (+ manual SQL verify). ✓
- §5 storage → Task 4 + Task 9 upload. ✓
- §6 timezone → Task 7, used in Tasks 9/11. ✓
- §7 profile provisioning (client upsert, no webhook) → Task 8. ✓
- §8 screens/behaviors → composables Tasks 8–11 + route stubs Task 5; UI left to Antigravity per spec. ✓
- §8 dashboard (unpaid, grouped, multi-menu/day) → Task 11. ✓
- §9 testing → manual per user; RLS via SQL check (Task 3). E2E intentionally omitted per user. ✓
- §10 deployment → Task 1 (vercel.json) + Task 2 env. ✓

**Placeholder scan:** Route-stub pages are intentionally `TODO` (handed to Antigravity, documented in Task 12) — not a logic placeholder. All logic tasks contain complete code. No "add error handling"/"TBD" left.

**Type consistency:** `useSupabaseClient()`, `useProfile()/ensureProfile/getProfile/updateProfile`, `useMenus()/createMenu/listMenusByDate/getMenu`, `useOrders()/createOrder/togglePaid/listMyOrders`, `useDashboard()/unpaidByPersonForMyMenus` — names consistent across producing and consuming tasks. `profiles.id` is `text` everywhere; FK hints (`menus_poster_id_fkey`, `orders_user_id_fkey`) match default Supabase constraint names from Task 3.
