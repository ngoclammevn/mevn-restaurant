-- Migration 0003: Production-safe — chạy trên DB đã có sẵn từ main
-- Dùng IF NOT EXISTS / DO $$ ... $$ để không lỗi nếu đã tồn tại
-- Chạy trong Supabase Dashboard → SQL Editor

-- ── 1. Tables (IF NOT EXISTS) ────────────────────────────────────────────────

create table if not exists profiles (
  id            text primary key,
  full_name     text,
  avatar_url    text,
  payment_info  text,
  created_at    timestamptz not null default now()
);

create table if not exists menus (
  id          uuid primary key default gen_random_uuid(),
  poster_id   text not null references profiles(id),
  menu_date   date not null,
  title       text not null,
  image_url   text,
  note        text,
  created_at  timestamptz not null default now()
);

create table if not exists orders (
  id         uuid primary key default gen_random_uuid(),
  menu_id    uuid not null references menus(id) on delete cascade,
  user_id    text not null references profiles(id),
  item_text  text not null,
  note       text,
  is_paid    boolean not null default false,
  paid_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ── 2. Columns mới (ADD IF NOT EXISTS) ───────────────────────────────────────

-- orders.updated_at: dùng để hiện "đã sửa lúc ..." trong UI
alter table orders add column if not exists updated_at timestamptz;

-- menus.note: chứa JSON OCR dishes (nếu chưa có)
alter table menus add column if not exists note text;

-- ── 3. Indexes ────────────────────────────────────────────────────────────────

create index if not exists menus_menu_date_idx on menus (menu_date);
create index if not exists orders_menu_id_idx  on orders (menu_id);
create index if not exists orders_user_id_idx  on orders (user_id);

-- ── 4. RLS (enable + policies — safe to re-run) ───────────────────────────────

alter table profiles enable row level security;
alter table menus    enable row level security;
alter table orders   enable row level security;

-- Drop policies nếu đã tồn tại rồi tạo lại (idempotent)
do $$ begin
  drop policy if exists profiles_select on profiles;
  drop policy if exists profiles_insert on profiles;
  drop policy if exists profiles_update on profiles;
  drop policy if exists menus_select    on menus;
  drop policy if exists menus_insert    on menus;
  drop policy if exists menus_update    on menus;
  drop policy if exists menus_delete    on menus;
  drop policy if exists orders_select   on orders;
  drop policy if exists orders_insert   on orders;
  drop policy if exists orders_update   on orders;
  drop policy if exists orders_delete   on orders;
end $$;

create policy profiles_select on profiles for select to authenticated using (true);
create policy profiles_insert on profiles for insert to authenticated
  with check (id = (select auth.jwt()->>'sub'));
create policy profiles_update on profiles for update to authenticated
  using  (id = (select auth.jwt()->>'sub'))
  with check (id = (select auth.jwt()->>'sub'));

create policy menus_select on menus for select to authenticated using (true);
create policy menus_insert on menus for insert to authenticated
  with check (poster_id = (select auth.jwt()->>'sub'));
create policy menus_update on menus for update to authenticated
  using  (poster_id = (select auth.jwt()->>'sub'))
  with check (poster_id = (select auth.jwt()->>'sub'));
create policy menus_delete on menus for delete to authenticated
  using (poster_id = (select auth.jwt()->>'sub'));

create policy orders_select on orders for select to authenticated using (true);
create policy orders_insert on orders for insert to authenticated with check (true);
create policy orders_update on orders for update to authenticated
  using  (user_id = (select auth.jwt()->>'sub'))
  with check (user_id = (select auth.jwt()->>'sub'));
create policy orders_delete on orders for delete to authenticated
  using (user_id = (select auth.jwt()->>'sub'));

-- ── 5. Grants ─────────────────────────────────────────────────────────────────

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;
grant usage, select on all sequences in schema public
  to anon, authenticated, service_role;

-- ── 6. Storage bucket menus (idempotent) ─────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('menus', 'menus', true)
on conflict (id) do update set public = true;

do $$ begin
  drop policy if exists "menu upload own folder" on storage.objects;
  drop policy if exists "menu read access"       on storage.objects;
  drop policy if exists "menu delete own folder" on storage.objects;
end $$;

create policy "menu upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'menus'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

create policy "menu read access" on storage.objects
  for select to authenticated
  using (bucket_id = 'menus');

create policy "menu delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'menus'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );
