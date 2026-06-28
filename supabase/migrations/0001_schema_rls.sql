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
  with check (true);
create policy orders_update on orders for update to authenticated
  using (user_id = (select auth.jwt()->>'sub'))
  with check (user_id = (select auth.jwt()->>'sub'));
create policy orders_delete on orders for delete to authenticated
  using (user_id = (select auth.jwt()->>'sub'));

-- Grant table privileges to public roles
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
