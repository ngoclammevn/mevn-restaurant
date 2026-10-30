-- Additive sponsorship and immutable financial revision storage; no legacy backfill.
begin;
alter table public.menus add column payment_mode text not null default 'self' check(payment_mode in ('self','sponsored'));
alter table public.menus add column sponsor_user_id text references public.profiles(id);
alter table public.menus add column sponsor_reason text check(length(sponsor_reason)<=240);
alter table public.menus add column archived_at timestamptz;
alter table public.menus add constraint menus_sponsor_matches_mode check(
  (payment_mode='self' and sponsor_user_id is null) or (payment_mode='sponsored' and sponsor_user_id=poster_id));
create function public.lunch_guard_sponsorship() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.payment_mode='sponsored' then
    if new.sponsor_user_id is not null and new.sponsor_user_id<>new.poster_id then raise exception 'Người mời phải là người đăng menu.'; end if;
    new.sponsor_user_id := new.poster_id;
  elsif new.sponsor_user_id is not null then raise exception 'Menu tự trả không có người mời.';
  end if;
  if tg_op='UPDATE' and new.payment_mode<>old.payment_mode and exists(select 1 from public.orders where menu_id=old.id) then
    raise exception 'Menu đã có đơn, không thể đổi hình thức thanh toán.';
  end if;
  return new;
end $$;
create trigger lunch_sponsorship_guard before insert or update on public.menus for each row execute function public.lunch_guard_sponsorship();
create function public.save_lunch_menu_v2(p_id uuid default null,p_title text default '',
  p_menu_date date default (clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date,
  p_note text default null,p_restaurant_id uuid default null,p_image_url text default null,
  p_payment_mode text default null,p_sponsor_reason text default null)
returns public.menus language plpgsql security invoker set search_path='' as $$
declare result public.menus;
begin
  result := public.save_lunch_menu(p_id,p_title,p_menu_date,p_note,p_restaurant_id,p_image_url);
  update public.menus set payment_mode=coalesce(p_payment_mode,payment_mode),
    sponsor_user_id=case when coalesce(p_payment_mode,payment_mode)='sponsored' then poster_id else null end,
    sponsor_reason=case when coalesce(p_payment_mode,payment_mode)='sponsored' then p_sponsor_reason else null end
    where id=result.id returning * into result;
  return result;
end $$;
create table public.menu_closures (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.menus(id),
  revision integer not null check(revision>0),
  closed_by text not null references public.profiles(id),
  closed_at timestamptz not null default clock_timestamp(),
  payment_mode text not null check(payment_mode in ('self','sponsored')),
  sponsor_user_id text references public.profiles(id),
  unique(menu_id,revision), unique(id,menu_id)
);
-- IDs are historical references, deliberately not cascading FKs: reopening can edit/remove an order item.
create table public.closure_items (
  closure_id uuid not null references public.menu_closures(id),
  order_item_id uuid not null,
  order_id uuid not null,
  user_id text not null references public.profiles(id),
  name_snapshot text not null,
  unit_price integer check(unit_price between 0 and 100000000),
  primary key(closure_id,order_item_id)
);
create index closure_items_order on public.closure_items(order_id);
alter table public.menus add column current_closure_id uuid;
alter table public.menus add constraint menus_current_closure_id_fkey foreign key(current_closure_id) references public.menu_closures(id);
grant select on public.menu_closures,public.closure_items to anon;
alter table public.menu_closures enable row level security;
alter table public.closure_items enable row level security;
grant select,insert on public.menu_closures,public.closure_items to authenticated;
create policy closures_read on public.menu_closures for select to authenticated using(true);
create policy closure_items_read on public.closure_items for select to authenticated using(true);
create policy closures_insert on public.menu_closures for insert to authenticated with check(
  closed_by=(select auth.jwt()->>'sub') and exists(select 1 from public.menus m where m.id=menu_id and m.poster_id=(select auth.jwt()->>'sub')));
create policy closure_items_insert on public.closure_items for insert to authenticated with check(
  exists(select 1 from public.menu_closures c join public.menus m on m.id=c.menu_id where c.id=closure_id and m.poster_id=(select auth.jwt()->>'sub')));
create function public.lunch_guard_financial_snapshot() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op<>'INSERT' or pg_trigger_depth()<2 then raise exception 'Giá chốt chỉ được tạo trong giao dịch chốt menu.'; end if;
  return new;
end $$;
create trigger closure_guard before insert or update or delete on public.menu_closures for each row execute function public.lunch_guard_financial_snapshot();
create trigger closure_item_guard before insert or update or delete on public.closure_items for each row execute function public.lunch_guard_financial_snapshot();
revoke all on function public.lunch_guard_sponsorship(),public.lunch_guard_financial_snapshot(),public.save_lunch_menu_v2(uuid,text,date,text,uuid,text,text,text) from public,anon;
grant execute on function public.save_lunch_menu_v2(uuid,text,date,text,uuid,text,text,text) to authenticated;
commit;
