-- Private saved contacts and explicit daily consent; no profile-wide contact exposure.
begin;
create table public.pickup_contacts (
  user_id text primary key references public.profiles(id),
  phone_e164 text not null check (phone_e164 ~ '^\+84[35789][0-9]{8}$'),
  updated_at timestamptz not null default clock_timestamp()
);
create table public.pickup_availability (
  user_id text not null references public.profiles(id),
  menu_date date not null,
  available boolean not null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key(user_id,menu_date)
);
alter table public.pickup_contacts enable row level security;
alter table public.pickup_availability enable row level security;
grant select,insert,update on public.pickup_contacts,public.pickup_availability to authenticated;
create policy availability_read on public.pickup_availability for select to authenticated using (
  user_id=(select auth.jwt()->>'sub') or exists(select 1 from public.menus m join public.orders o on o.menu_id=m.id
    where m.poster_id=(select auth.jwt()->>'sub') and m.menu_date=pickup_availability.menu_date and o.user_id=pickup_availability.user_id)
);
create policy availability_insert on public.pickup_availability for insert to authenticated with check(user_id=(select auth.jwt()->>'sub'));
create policy availability_update on public.pickup_availability for update to authenticated
  using(user_id=(select auth.jwt()->>'sub')) with check(user_id=(select auth.jwt()->>'sub'));
create policy contacts_read on public.pickup_contacts for select to authenticated using (
  user_id=(select auth.jwt()->>'sub') or exists(select 1 from public.pickup_availability a
    join public.menus m on m.menu_date=a.menu_date join public.orders o on o.menu_id=m.id and o.user_id=a.user_id
    where a.user_id=pickup_contacts.user_id and a.available and not m.is_closed and m.poster_id=(select auth.jwt()->>'sub'))
);
create policy contacts_insert on public.pickup_contacts for insert to authenticated with check(user_id=(select auth.jwt()->>'sub'));
create policy contacts_update on public.pickup_contacts for update to authenticated
  using(user_id=(select auth.jwt()->>'sub')) with check(user_id=(select auth.jwt()->>'sub'));
create function public.lunch_normalize_phone(p_phone text) returns text
language plpgsql immutable security invoker set search_path='' as $$
declare phone text := regexp_replace(btrim(coalesce(p_phone,'')), '[[:space:]().-]', '', 'g');
begin
  if left(phone,1)='0' then phone := '+84'||substr(phone,2); end if;
  if phone !~ '^\+84[35789][0-9]{8}$' then raise exception 'Số điện thoại Việt Nam không hợp lệ.'; end if;
  return phone;
end $$;
create function public.lunch_guard_pickup_preference() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='UPDATE' and new.user_id<>old.user_id then raise exception 'Không thể đổi chủ liên hệ.'; end if;
  new.updated_at := clock_timestamp();
  if tg_table_name='pickup_availability' then
    if tg_op='UPDATE' and new.menu_date<>old.menu_date then raise exception 'Không thể chuyển ngày đồng ý.'; end if;
    if new.available and not exists(select 1 from public.pickup_contacts c where c.user_id=new.user_id) then
      raise exception 'Hãy lưu số điện thoại trước khi đồng ý nhận cơm.';
    end if;
  end if;
  return new;
end $$;
create trigger pickup_contact_guard before insert or update on public.pickup_contacts for each row execute function public.lunch_guard_pickup_preference();
create trigger pickup_availability_guard before insert or update on public.pickup_availability for each row execute function public.lunch_guard_pickup_preference();
create function public.update_pickup_phone(p_phone text) returns public.pickup_contacts
language plpgsql security invoker set search_path='' as $$
declare uid text := auth.jwt()->>'sub'; result public.pickup_contacts;
begin
  if uid is null then raise exception 'Vui lòng đăng nhập.'; end if;
  insert into public.pickup_contacts(user_id,phone_e164) values(uid,public.lunch_normalize_phone(p_phone))
    on conflict(user_id) do update set phone_e164=excluded.phone_e164 returning * into result;
  return result;
end $$;
create function public.save_pickup_preferences(p_date date,p_available boolean,p_phone text default null)
returns public.pickup_availability language plpgsql security invoker set search_path='' as $$
declare uid text := auth.jwt()->>'sub'; result public.pickup_availability;
begin
  if uid is null then raise exception 'Vui lòng đăng nhập.'; end if;
  if p_phone is not null then perform public.update_pickup_phone(p_phone); end if;
  insert into public.pickup_availability(user_id,menu_date,available) values(uid,p_date,p_available)
    on conflict(user_id,menu_date) do update set available=excluded.available returning * into result;
  return result;
end $$;
revoke all on function public.lunch_normalize_phone(text),public.lunch_guard_pickup_preference(),public.update_pickup_phone(text),public.save_pickup_preferences(date,boolean,text) from public,anon;
grant execute on function public.lunch_normalize_phone(text),public.update_pickup_phone(text),public.save_pickup_preferences(date,boolean,text) to authenticated;
commit;
