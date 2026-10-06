-- Additive restaurant/dish identity. All business functions run with caller RLS.
begin;

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 240),
  branch text check (length(branch) <= 120),
  created_by text not null default (auth.jwt()->>'sub') references public.profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.restaurant_dishes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id),
  name text not null check (length(btrim(name)) between 1 and 240),
  variant text not null default '' check (length(variant) <= 120),
  created_by text not null default (auth.jwt()->>'sub') references public.profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index restaurant_dishes_identity on public.restaurant_dishes
  (restaurant_id, lower(btrim(name)), lower(btrim(variant)));
alter table public.menus add column restaurant_id uuid references public.restaurants(id);
alter table public.menus add column catalog_tx text;
alter table public.orders add column menu_item_ids uuid[];
alter table public.orders add column placed_by text references public.profiles(id);
alter table public.orders add column created_tx text;
alter table public.orders add column items_tx text;
alter table public.orders add constraint orders_id_menu_id_key unique (id, menu_id);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus(id) on delete cascade,
  restaurant_dish_id uuid references public.restaurant_dishes(id),
  name text not null check (length(btrim(name)) between 1 and 240),
  price integer check (price between 0 and 100000000),
  category text not null default 'Khác' check (length(category) <= 120),
  calories integer check (calories between 0 and 100000),
  description text not null default '' check (length(description) <= 1000),
  available boolean not null default true,
  position integer not null default 0 check (position >= 0),
  unique (id, menu_id), unique (menu_id, name)
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  menu_id uuid not null,
  menu_item_id uuid,
  name_snapshot text not null,
  restaurant_name_snapshot text,
  position integer not null default 0 check (position >= 0),
  foreign key (order_id, menu_id) references public.orders(id, menu_id) on delete cascade,
  foreign key (menu_item_id, menu_id) references public.menu_items(id, menu_id) on delete cascade,
  unique (order_id, menu_item_id)
);
create unique index order_items_one_unlinked on public.order_items(order_id) where menu_item_id is null;
create index order_items_menu on public.order_items(menu_id);
create index order_items_dish on public.order_items(menu_item_id);

create function public.lunch_labels_valid(labels text[]) returns boolean
language sql immutable security invoker set search_path = '' as $$
  select cardinality(labels) <= 6 and cardinality(labels) = (
    select count(distinct btrim(label)) from unnest(labels) label
  ) and not exists (
    select 1 from unnest(labels) label where label is null or length(btrim(label)) not between 1 and 48
  )
$$;
create table public.dish_reviews (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  user_id text not null default (auth.jwt()->>'sub') references public.profiles(id),
  rating smallint not null check (rating between 1 and 5),
  labels text[] not null default '{}' check (public.lunch_labels_valid(labels)),
  note text not null default '' check (length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dish_reviews_author on public.dish_reviews(user_id);
create index menus_restaurant on public.menus(restaurant_id);

alter table public.restaurants enable row level security;
alter table public.restaurant_dishes enable row level security;
alter table public.menu_items enable row level security;
alter table public.order_items enable row level security;
alter table public.dish_reviews enable row level security;

create policy restaurants_read on public.restaurants for select to authenticated using (true);
create policy restaurants_create on public.restaurants for insert to authenticated
  with check (created_by = (select auth.jwt()->>'sub'));
create policy restaurants_edit on public.restaurants for update to authenticated
  using (created_by = (select auth.jwt()->>'sub')) with check (created_by = (select auth.jwt()->>'sub'));
create policy dishes_read on public.restaurant_dishes for select to authenticated using (true);
create policy dishes_create on public.restaurant_dishes for insert to authenticated
  with check (created_by = (select auth.jwt()->>'sub') and exists (
    select 1 from public.restaurants r where r.id = restaurant_id and r.is_active
  ));
create policy dishes_edit on public.restaurant_dishes for update to authenticated
  using (created_by = (select auth.jwt()->>'sub')) with check (created_by = (select auth.jwt()->>'sub'));
create policy menu_items_read on public.menu_items for select to authenticated using (true);
create policy menu_items_write on public.menu_items for all to authenticated
  using (exists (select 1 from public.menus m where m.id = menu_id
    and m.poster_id = (select auth.jwt()->>'sub') and m.catalog_tx = pg_current_xact_id()::text))
  with check (exists (select 1 from public.menus m where m.id = menu_id
    and m.poster_id = (select auth.jwt()->>'sub') and m.catalog_tx = pg_current_xact_id()::text));
create policy order_items_read on public.order_items for select to authenticated using (true);
create policy order_items_create on public.order_items for insert to authenticated with check (
  exists (select 1 from public.orders o join public.menus m on m.id = o.menu_id
    where o.id = order_id and o.menu_id = order_items.menu_id and not m.is_closed
      and o.items_tx = pg_current_xact_id()::text
      and (o.user_id = (select auth.jwt()->>'sub') or
        (o.placed_by = (select auth.jwt()->>'sub') and o.created_tx = pg_current_xact_id()::text)))
);
create policy order_items_edit on public.order_items for update to authenticated
  using (exists (select 1 from public.orders o join public.menus m on m.id = o.menu_id
    where o.id = order_id and o.user_id = (select auth.jwt()->>'sub') and not m.is_closed
      and o.items_tx = pg_current_xact_id()::text))
  with check (exists (select 1 from public.orders o join public.menus m on m.id = o.menu_id
    where o.id = order_id and o.user_id = (select auth.jwt()->>'sub') and not m.is_closed
      and o.items_tx = pg_current_xact_id()::text));
create policy order_items_remove on public.order_items for delete to authenticated
  using (exists (select 1 from public.orders o join public.menus m on m.id = o.menu_id
    where o.id = order_id and o.user_id = (select auth.jwt()->>'sub') and not m.is_closed
      and o.items_tx = pg_current_xact_id()::text));
create policy reviews_read on public.dish_reviews for select to authenticated using (true);
create policy reviews_create on public.dish_reviews for insert to authenticated with check (
  user_id = (select auth.jwt()->>'sub') and exists (
    select 1 from public.order_items i join public.orders o on o.id = i.order_id
      join public.menus m on m.id = o.menu_id
    where i.id = order_item_id and o.user_id = (select auth.jwt()->>'sub')
      and m.menu_date <= (clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date
  )
);
create policy reviews_edit on public.dish_reviews for update to authenticated
  using (user_id = (select auth.jwt()->>'sub')) with check (
    user_id = (select auth.jwt()->>'sub') and exists (
      select 1 from public.order_items i join public.orders o on o.id = i.order_id
        join public.menus m on m.id = o.menu_id
      where i.id = order_item_id and o.user_id = (select auth.jwt()->>'sub')
        and m.menu_date <= (clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date
    )
  );
create policy reviews_remove on public.dish_reviews for delete to authenticated
  using (user_id = (select auth.jwt()->>'sub'));
grant select, insert, update on public.restaurants, public.restaurant_dishes to authenticated;
grant select, insert, update, delete on public.menu_items, public.order_items, public.dish_reviews to authenticated;
-- Guest nested menu reads do not fail on missing grants; catalog/feedback still have no anon policy.
grant select on public.restaurants, public.restaurant_dishes, public.menu_items, public.order_items, public.dish_reviews to anon;

-- Canonical IDs always stay in their original restaurant, including an unreferenced dish.
-- Renaming metadata cannot change historical order-item name snapshots.
create function public.lunch_guard_dish() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.id <> old.id or new.restaurant_id <> old.restaurant_id
    or new.created_by <> old.created_by) then
    raise exception 'Không thể chuyển danh tính hoặc quán của món.';
  end if;
  new.name := regexp_replace(btrim(new.name), '\s+', ' ', 'g');
  new.variant := regexp_replace(btrim(new.variant), '\s+', ' ', 'g');
  return new;
end $$;
create trigger lunch_dish_guard before insert or update on public.restaurant_dishes
for each row execute function public.lunch_guard_dish();

create function public.lunch_dishes(note text) returns jsonb
language plpgsql immutable security invoker set search_path = '' as $$
declare value jsonb;
begin
  value := note::jsonb;
  if jsonb_typeof(value->'dishes') <> 'array' or value->'dishes' is null then return null; end if;
  if exists (select 1 from jsonb_array_elements(value->'dishes') d
    where jsonb_typeof(d->'name') <> 'string' or nullif(btrim(d->>'name'), '') is null) then return null; end if;
  return value->'dishes';
exception when invalid_text_representation then return null;
end $$;

create function public.lunch_integer(value jsonb, maximum integer) returns integer
language plpgsql immutable security invoker set search_path = '' as $$
declare n numeric;
begin
  if value is null or jsonb_typeof(value) = 'null' then return null; end if;
  n := (value#>>'{}')::numeric;
  if n < 0 or n > maximum or trunc(n) <> n then return null; end if;
  return n::integer;
exception when invalid_text_representation or numeric_value_out_of_range then return null;
end $$;

create function public.lunch_guard_menu() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.id::text, 0));
  new.catalog_tx := pg_current_xact_id()::text;
  if new.restaurant_id is not null and (tg_op = 'INSERT' or new.restaurant_id is distinct from old.restaurant_id)
    and not exists(select 1 from public.restaurants where id = new.restaurant_id and is_active) then
    raise exception 'Quán không tồn tại hoặc đã ngừng sử dụng.';
  end if;
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.poster_id <> old.poster_id then raise exception 'Không thể chuyển chủ menu.'; end if;
    if exists(select 1 from public.orders where menu_id = old.id) then
      if old.restaurant_id is not null and new.restaurant_id is distinct from old.restaurant_id then
        raise exception 'Menu đã có đơn, không thể đổi quán.';
      end if;
      if new.menu_date <> old.menu_date then raise exception 'Menu đã có đơn, không thể đổi ngày.'; end if;
    end if;
  end if;
  return new;
end $$;
create trigger lunch_menu_guard before insert or update on public.menus
for each row execute function public.lunch_guard_menu();

create function public.lunch_guard_menu_item() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare restaurant uuid; ordered boolean;
begin
  if tg_op = 'DELETE' then
    if exists(select 1 from public.menus where id = old.menu_id)
      and exists(select 1 from public.order_items where menu_item_id = old.id) then
      raise exception 'Món đã có người đặt, hãy đánh dấu hết món thay vì xoá.';
    end if;
    return old;
  end if;
  select restaurant_id into restaurant from public.menus where id = new.menu_id;
  if new.restaurant_dish_id is not null and not exists (
    select 1 from public.restaurant_dishes where id = new.restaurant_dish_id and restaurant_id = restaurant
  ) then raise exception 'Món không thuộc quán của menu.'; end if;
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.menu_id <> old.menu_id then raise exception 'Không thể chuyển món sang menu khác.'; end if;
    select exists(select 1 from public.order_items where menu_item_id = old.id) into ordered;
    if ordered and (new.name <> old.name or
      (old.restaurant_dish_id is not null and new.restaurant_dish_id is distinct from old.restaurant_dish_id)) then
      raise exception 'Món đã có đơn, không thể đổi tên hoặc liên kết quán.';
    end if;
  end if;
  return new;
end $$;
create trigger lunch_menu_item_guard before insert or update or delete on public.menu_items
for each row execute function public.lunch_guard_menu_item();

create function public.lunch_sync_menu() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare dishes jsonb; dish jsonb; existing public.menu_items; item_id uuid; canonical uuid;
  item_name text; variant_name text; keep uuid[] := '{}'; names text[] := '{}';
  ordinal integer := 0; projection jsonb; validate_numbers boolean;
begin
  if pg_trigger_depth() > 1 then return new; end if;
  dishes := public.lunch_dishes(new.note);
  if dishes is null then
    delete from public.menu_items where menu_id = new.id;
    return new;
  end if;
  if jsonb_array_length(dishes) > 200 then raise exception 'Menu tối đa 200 món.'; end if;
  -- Legacy malformed numbers remain unknown during the no-op backfill. New content
  -- must never silently turn a negative, non-finite or fractional number into NULL.
  validate_numbers := tg_op = 'INSERT';
  if tg_op = 'UPDATE' then validate_numbers := new.note is distinct from old.note; end if;
  for dish in select value from jsonb_array_elements(dishes) loop
    item_name := regexp_replace(btrim(dish->>'name'), '\s+', ' ', 'g');
    variant_name := regexp_replace(btrim(coalesce(dish->>'variant', '')), '\s+', ' ', 'g');
    if lower(item_name) = any(names) then raise exception 'Menu có tên món trùng nhau.'; end if;
    names := array_append(names,lower(item_name));
    if validate_numbers and ((dish->'price' is not null and jsonb_typeof(dish->'price') <> 'null'
      and public.lunch_integer(dish->'price',100000000) is null) or
      (dish->'calories' is not null and jsonb_typeof(dish->'calories') <> 'null'
      and public.lunch_integer(dish->'calories',100000) is null)) then
      raise exception 'Giá và calo phải là số nguyên không âm trong giới hạn cho phép.';
    end if;
    existing := null;
    if nullif(dish->>'id', '') is not null then
      select * into existing from public.menu_items where id = (dish->>'id')::uuid and menu_id = new.id;
      if existing.id is null and exists(select 1 from public.menu_items where id = (dish->>'id')::uuid) then
        raise exception 'Mã món thuộc menu khác.';
      end if;
    end if;
    if existing.id is null then
      select * into existing from public.menu_items where menu_id = new.id and name = item_name;
    end if;
    item_id := coalesce(existing.id, nullif(dish->>'id', '')::uuid, gen_random_uuid());
    if item_id = any(keep) then raise exception 'Menu có tên hoặc mã món trùng nhau.'; end if;
    canonical := null;
    if new.restaurant_id is not null then
      if nullif(dish->>'restaurant_dish_id', '') is not null then
        canonical := (dish->>'restaurant_dish_id')::uuid;
        if not exists(select 1 from public.restaurant_dishes where id = canonical and restaurant_id = new.restaurant_id) then
          raise exception 'Món không thuộc quán đã chọn.';
        end if;
      else
        select id into canonical from public.restaurant_dishes where restaurant_id = new.restaurant_id
          and lower(btrim(name)) = lower(item_name) and lower(btrim(variant)) = lower(btrim(variant_name));
        if canonical is null then
          insert into public.restaurant_dishes(restaurant_id, name, variant)
            values(new.restaurant_id, item_name, variant_name) on conflict do nothing returning id into canonical;
          if canonical is null then
            select id into canonical from public.restaurant_dishes where restaurant_id = new.restaurant_id
              and lower(btrim(name)) = lower(item_name) and lower(btrim(variant)) = lower(btrim(variant_name));
          end if;
        end if;
      end if;
    end if;
    insert into public.menu_items(id,menu_id,restaurant_dish_id,name,price,category,calories,description,available,position)
    values(item_id,new.id,canonical,item_name,public.lunch_integer(dish->'price',100000000),
      coalesce(nullif(dish->>'category',''),'Khác'),public.lunch_integer(dish->'calories',100000),
      coalesce(dish->>'description',''),coalesce((dish->>'available')::boolean,true),ordinal)
    on conflict (id) do update set restaurant_dish_id = excluded.restaurant_dish_id, name = excluded.name,
      price = excluded.price, category = excluded.category, calories = excluded.calories,
      description = excluded.description, available = excluded.available, position = excluded.position;
    keep := array_append(keep,item_id);
    ordinal := ordinal + 1;
  end loop;
  delete from public.menu_items where menu_id = new.id and not (id = any(keep));
  select jsonb_agg(jsonb_build_object('id',id,'restaurant_dish_id',restaurant_dish_id,'name',name,
    'price',price,'category',category,'calories',calories,'description',description,'available',available,
    'position',position) order by position) into projection from public.menu_items where menu_id = new.id;
  update public.menus set note = jsonb_set(new.note::jsonb,'{dishes}',coalesce(projection,'[]'::jsonb))::text where id = new.id;
  return new;
end $$;
create trigger lunch_menu_sync after insert or update of note, restaurant_id on public.menus
for each row execute function public.lunch_sync_menu();

create function public.lunch_ids_for_text(menu uuid, item_text text) returns uuid[]
language plpgsql stable security invoker set search_path = '' as $$
declare line text; id uuid; result uuid[] := '{}';
begin
  for line in select btrim(value) from regexp_split_to_table(item_text,E'\n') value where btrim(value) <> '' loop
    select mi.id into id from public.menu_items mi where mi.menu_id = menu and mi.name = line;
    if id is null or id = any(result) then return null; end if;
    result := array_append(result,id);
  end loop;
  if cardinality(result) = 0 then return null; end if;
  return result;
end $$;

-- Safe backfill: no restaurant inference, no reinterpretation of uncertain text.
do $$
declare legacy record;
begin
  for legacy in select id from public.menus where public.lunch_dishes(note) is not null loop
    begin
      update public.menus set note = note where id = legacy.id;
    exception when check_violation or unique_violation or invalid_text_representation
      or numeric_value_out_of_range or not_null_violation or foreign_key_violation or raise_exception then
      -- Keep incompatible legacy JSON readable as-is. Its orders receive a single
      -- unlinked snapshot below, rather than a partial or guessed catalog match.
      null;
    end;
  end loop;
end $$;
update public.orders set menu_item_ids = public.lunch_ids_for_text(menu_id,item_text),
  created_tx = pg_current_xact_id()::text, items_tx = pg_current_xact_id()::text;
insert into public.order_items(order_id,menu_id,menu_item_id,name_snapshot,restaurant_name_snapshot,position)
select o.id,o.menu_id,mi.id,mi.name,r.name,selection.ordinality::integer-1
from public.orders o cross join lateral unnest(o.menu_item_ids) with ordinality selection(id,ordinality)
join public.menu_items mi on mi.id = selection.id join public.menus m on m.id = o.menu_id
left join public.restaurants r on r.id = m.restaurant_id;
insert into public.order_items(order_id,menu_id,name_snapshot,position)
select id,menu_id,item_text,0 from public.orders where menu_item_ids is null;

create function public.lunch_guard_order() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare menu public.menus; selected uuid[]; previous uuid[] := '{}'; changed boolean; expected text;
begin
  if tg_op = 'INSERT' then
    changed := true;
    new.placed_by := auth.jwt()->>'sub'; new.created_tx := pg_current_xact_id()::text;
  else
    if new.id <> old.id or new.user_id <> old.user_id or new.menu_id <> old.menu_id then
      raise exception 'Không thể chuyển chủ hoặc menu của đơn.';
    end if;
    new.placed_by := old.placed_by; new.created_tx := old.created_tx; new.items_tx := old.items_tx;
    previous := coalesce(old.menu_item_ids,'{}');
    changed := new.item_text is distinct from old.item_text or new.note is distinct from old.note
      or new.menu_item_ids is distinct from old.menu_item_ids;
    if not changed then return new; end if;
  end if;
  perform pg_advisory_xact_lock_shared(hashtextextended(new.menu_id::text,0));
  select * into menu from public.menus where id = new.menu_id;
  if menu.id is null or menu.is_closed then raise exception 'Đơn đã chốt, không thể thêm hoặc sửa món.'; end if;
  if length(btrim(new.item_text)) = 0 or length(new.item_text) > 4000 or length(coalesce(new.note,'')) > 1000 then
    raise exception 'Món hoặc ghi chú quá dài.';
  end if;
  if public.lunch_dishes(menu.note) is not null then
    selected := new.menu_item_ids;
    if tg_op = 'UPDATE' then
      if new.item_text is distinct from old.item_text and new.menu_item_ids is not distinct from old.menu_item_ids then
        selected := public.lunch_ids_for_text(new.menu_id,new.item_text);
      end if;
    end if;
    if selected is null then selected := public.lunch_ids_for_text(new.menu_id,new.item_text); end if;
    if selected is null or cardinality(selected) not between 1 and 30
      or cardinality(selected) <> (select count(distinct selection.id) from unnest(selected) selection(id)) then
      raise exception 'Hãy chọn món từ thực đơn.';
    end if;
    if exists(select 1 from unnest(selected) selection(id) where not exists (
      select 1 from public.menu_items mi where mi.id = selection.id and mi.menu_id = new.menu_id
        and (mi.available or mi.id = any(previous)))) then
      raise exception 'Món không thuộc menu hoặc đã hết.';
    end if;
    select string_agg(mi.name,E'\n' order by selection.ordinality) into expected
      from unnest(selected) with ordinality selection(id,ordinality) join public.menu_items mi on mi.id = selection.id;
    if new.item_text <> expected then raise exception 'Tên món phải khớp lựa chọn trong thực đơn.'; end if;
    new.menu_item_ids := selected;
  else
    new.menu_item_ids := null;
  end if;
  new.items_tx := pg_current_xact_id()::text;
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  return new;
end $$;
create trigger lunch_order_guard before insert or update on public.orders
for each row execute function public.lunch_guard_order();

create function public.lunch_guard_order_item() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare parent public.orders; dish public.menu_items; restaurant text;
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.order_id <> old.order_id or new.menu_id <> old.menu_id
      or new.menu_item_id is distinct from old.menu_item_id or new.name_snapshot <> old.name_snapshot
      or new.restaurant_name_snapshot is distinct from old.restaurant_name_snapshot then
      raise exception 'Không thể chuyển liên kết hoặc thay snapshot món đã đặt.';
    end if;
    select * into parent from public.orders where id = new.order_id;
    new.position := coalesce(array_position(parent.menu_item_ids,new.menu_item_id)-1,0);
    return new;
  end if;
  select * into parent from public.orders where id = new.order_id;
  if parent.id is null or parent.menu_id <> new.menu_id then raise exception 'Món không thuộc đơn này.'; end if;
  select r.name into restaurant from public.menus m left join public.restaurants r on r.id = m.restaurant_id
    where m.id = parent.menu_id;
  new.restaurant_name_snapshot := restaurant;
  if new.menu_item_id is not null then
    select * into dish from public.menu_items where id = new.menu_item_id and menu_id = parent.menu_id;
    if dish.id is null or not coalesce(dish.id = any(parent.menu_item_ids),false) then
      raise exception 'Món không có trong lựa chọn của đơn.';
    end if;
    new.name_snapshot := dish.name;
    new.position := array_position(parent.menu_item_ids,dish.id)-1;
  else
    if parent.menu_item_ids is not null then raise exception 'Đơn có cấu trúc không nhận món nhập tay.'; end if;
    new.name_snapshot := parent.item_text; new.position := 0;
  end if;
  return new;
end $$;
create trigger lunch_order_item_guard before insert or update on public.order_items
for each row execute function public.lunch_guard_order_item();

create function public.lunch_sync_order() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.item_text is not distinct from old.item_text and new.note is not distinct from old.note
      and new.menu_item_ids is not distinct from old.menu_item_ids then return new; end if;
  end if;
  if new.menu_item_ids is null then
    delete from public.order_items where order_id = new.id
      and (menu_item_id is not null or name_snapshot <> new.item_text);
    insert into public.order_items(order_id,menu_id,name_snapshot)
      select new.id,new.menu_id,new.item_text where not exists(select 1 from public.order_items where order_id = new.id);
  else
    delete from public.order_items where order_id = new.id
      and (menu_item_id is null or not (menu_item_id = any(new.menu_item_ids)));
    update public.order_items set position = array_position(new.menu_item_ids,menu_item_id)-1
      where order_id = new.id and position <> array_position(new.menu_item_ids,menu_item_id)-1;
    insert into public.order_items(order_id,menu_id,menu_item_id,name_snapshot,position)
      select new.id,new.menu_id,selection.id,mi.name,selection.ordinality::integer-1
      from unnest(new.menu_item_ids) with ordinality selection(id,ordinality)
      join public.menu_items mi on mi.id = selection.id
      where not exists(select 1 from public.order_items i where i.order_id = new.id and i.menu_item_id = selection.id);
  end if;
  return new;
end $$;
create trigger lunch_order_sync after insert or update on public.orders
for each row execute function public.lunch_sync_order();

create function public.lunch_guard_review() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.id <> old.id or new.order_item_id <> old.order_item_id or new.user_id <> old.user_id) then
    raise exception 'Không thể chuyển chủ hoặc món của đánh giá.';
  end if;
  if tg_op = 'UPDATE' then new.created_at := old.created_at; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger lunch_review_guard before insert or update on public.dish_reviews
for each row execute function public.lunch_guard_review();

create function public.save_lunch_menu(p_id uuid default null,p_title text default '',
  p_menu_date date default (clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date,
  p_note text default null,p_restaurant_id uuid default null,p_image_url text default null)
returns public.menus language plpgsql security invoker set search_path = '' as $$
declare result public.menus; uid text := auth.jwt()->>'sub';
begin
  if uid is null then raise exception 'Vui lòng đăng nhập.'; end if;
  if length(btrim(p_title)) not between 1 and 240 or length(coalesce(p_note,'')) > 250000 then
    raise exception 'Tiêu đề hoặc nội dung menu không hợp lệ.';
  end if;
  if p_id is null then
    insert into public.menus(poster_id,title,menu_date,note,restaurant_id,image_url)
      values(uid,btrim(p_title),p_menu_date,p_note,p_restaurant_id,p_image_url) returning * into result;
  else
    update public.menus set title=btrim(p_title),menu_date=p_menu_date,note=p_note,restaurant_id=p_restaurant_id,
      image_url=coalesce(p_image_url,image_url) where id=p_id and poster_id=uid returning * into result;
    if result.id is null then raise exception 'Bạn không có quyền sửa menu này.'; end if;
  end if;
  select * into result from public.menus where id=result.id;
  return result;
end $$;
revoke all on function public.save_lunch_menu(uuid,text,date,text,uuid,text) from public, anon;
grant execute on function public.save_lunch_menu(uuid,text,date,text,uuid,text) to authenticated;

create view public.restaurant_dish_stats with (security_invoker=true) as
select d.id,d.restaurant_id,d.name,d.variant,d.is_active,
  round(avg(r.rating)::numeric,2) as average_rating,count(r.id)::integer as rating_count,
  count(distinct r.user_id)::integer as reviewer_count
from public.restaurant_dishes d left join public.menu_items mi on mi.restaurant_dish_id=d.id
left join public.order_items i on i.menu_item_id=mi.id left join public.dish_reviews r on r.order_item_id=i.id
group by d.id;
create view public.restaurant_feedback with (security_invoker=true) as
select r.*,mi.restaurant_dish_id,d.restaurant_id,i.name_snapshot as item_name,
  p.full_name as author_name,m.menu_date
from public.dish_reviews r join public.order_items i on i.id=r.order_item_id
join public.menu_items mi on mi.id=i.menu_item_id join public.restaurant_dishes d on d.id=mi.restaurant_dish_id
join public.orders o on o.id=i.order_id join public.menus m on m.id=o.menu_id
join public.profiles p on p.id=r.user_id;
grant select on public.restaurant_dish_stats,public.restaurant_feedback to authenticated;

commit;
