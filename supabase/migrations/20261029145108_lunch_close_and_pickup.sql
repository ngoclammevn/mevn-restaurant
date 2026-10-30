-- All callers retain RLS. The group has <25 people: a single BEFORE STATEMENT
-- transaction gate orders domain writes before the existing per-menu advisory locks.
-- This also covers legacy direct Data API writes, not just the new RPCs.
begin;
create function public.lunch_domain_write_lock() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('lunch_domain_write',0));
  return null;
end $$;
create trigger lunch_domain_write_gate before insert or update or delete on public.menus for each statement execute function public.lunch_domain_write_lock();
create trigger lunch_domain_write_gate before insert or update or delete on public.orders for each statement execute function public.lunch_domain_write_lock();
create trigger lunch_domain_write_gate before insert or update or delete on public.menu_items for each statement execute function public.lunch_domain_write_lock();
create trigger lunch_domain_write_gate before insert or update or delete on public.order_items for each statement execute function public.lunch_domain_write_lock();
create trigger lunch_domain_write_gate before insert or update or delete on public.pickup_contacts for each statement execute function public.lunch_domain_write_lock();
create trigger lunch_domain_write_gate before insert or update or delete on public.pickup_availability for each statement execute function public.lunch_domain_write_lock();
-- Archive is a database write boundary, including direct Data API writes and
-- nested item synchronization from any order RPC. Payment remains self-tick.
create function public.lunch_guard_archived_order_write() returns trigger
language plpgsql security invoker set search_path='' as $$
declare target_menu uuid; archived timestamptz;
begin
  if tg_table_name='orders' and tg_op='UPDATE' then
    if (to_jsonb(new)-array['is_paid','paid_at','updated_at'])
      is not distinct from (to_jsonb(old)-array['is_paid','paid_at','updated_at']) then
      return new;
    end if;
  end if;
  if tg_op='INSERT' then target_menu := new.menu_id;
  else target_menu := old.menu_id;
  end if;
  -- The BEFORE STATEMENT gate already owns the domain lock. Match the existing
  -- order guard's per-menu lock only after that gate, so archive cannot race us.
  perform pg_advisory_xact_lock_shared(hashtextextended(target_menu::text,0));
  select m.archived_at into archived from public.menus m where m.id=target_menu;
  if archived is not null then
    raise exception 'Menu đã lưu trữ, không thể thêm, sửa hoặc xoá món.';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger lunch_archived_order_guard before insert or update or delete on public.orders
  for each row execute function public.lunch_guard_archived_order_write();
create trigger lunch_archived_order_guard before insert or update or delete on public.order_items
  for each row execute function public.lunch_guard_archived_order_write();
revoke all on function public.lunch_guard_archived_order_write() from public,anon;
create table public.menu_pickups (
  id uuid primary key default gen_random_uuid(),
  closure_id uuid not null unique,
  menu_id uuid not null references public.menus(id),
  primary_user_id text references public.profiles(id),
  backup_user_id text references public.profiles(id),
  version integer not null default 1 check(version>0),
  status text not null default 'unassigned' check(status in ('unassigned','assigned','received')),
  received_at timestamptz,
  foreign key(closure_id,menu_id) references public.menu_closures(id,menu_id),
  check(backup_user_id is null or backup_user_id<>primary_user_id),
  check((status='unassigned' and primary_user_id is null and backup_user_id is null and received_at is null)
    or (status='assigned' and primary_user_id is not null and received_at is null)
    or (status='received' and primary_user_id is not null and received_at is not null))
);
create index menu_pickups_received on public.menu_pickups(primary_user_id,received_at) where received_at is not null;
create table public.menu_pickup_contacts (
  pickup_id uuid not null references public.menu_pickups(id),
  user_id text not null references public.profiles(id),
  phone_e164 text not null check(phone_e164 ~ '^\+84[35789][0-9]{8}$'),
  primary key(pickup_id,user_id)
);
alter table public.menu_pickups enable row level security;
alter table public.menu_pickup_contacts enable row level security;
grant select,insert,update on public.menu_pickups,public.menu_pickup_contacts to authenticated;
create policy pickups_read on public.menu_pickups for select to authenticated using(true);
create policy pickups_create on public.menu_pickups for insert to authenticated with check(
  exists(select 1 from public.menus m where m.id=menu_id and m.poster_id=(select auth.jwt()->>'sub')));
create policy pickups_update on public.menu_pickups for update to authenticated
  using(primary_user_id=(select auth.jwt()->>'sub') or exists(select 1 from public.menus m where m.id=menu_id and m.poster_id=(select auth.jwt()->>'sub')))
  with check(primary_user_id=(select auth.jwt()->>'sub') or exists(select 1 from public.menus m where m.id=menu_id and m.poster_id=(select auth.jwt()->>'sub')));
create policy pickup_snapshots_read on public.menu_pickup_contacts for select to authenticated using(
  user_id=(select auth.jwt()->>'sub') or exists(select 1 from public.menu_pickups p join public.menus m on m.id=p.menu_id
    where p.id=pickup_id and m.poster_id=(select auth.jwt()->>'sub')));
create policy pickup_snapshots_create on public.menu_pickup_contacts for insert to authenticated with check(
  exists(select 1 from public.menu_pickups p join public.menus m on m.id=p.menu_id where p.id=pickup_id and m.poster_id=(select auth.jwt()->>'sub')));
create policy pickup_snapshots_update on public.menu_pickup_contacts for update to authenticated
  using(user_id=(select auth.jwt()->>'sub')) with check(user_id=(select auth.jwt()->>'sub'));
-- A poster can validate consenting ordered candidates while the current pickup
-- is unassigned, then retains only current assignees' contacts after assignment.
create policy contacts_active_assignment on public.pickup_contacts for select to authenticated using(
  exists(select 1 from public.menu_pickups p join public.menus m on m.id=p.menu_id where m.current_closure_id=p.closure_id
    and m.is_closed and m.poster_id=(select auth.jwt()->>'sub') and (
      (p.status='assigned' and (p.primary_user_id=pickup_contacts.user_id or p.backup_user_id=pickup_contacts.user_id))
      or (p.status='unassigned' and exists(select 1 from public.orders o join public.pickup_availability a
        on a.user_id=o.user_id and a.menu_date=m.menu_date and a.available
        where o.menu_id=m.id and o.user_id=pickup_contacts.user_id)))));
create function public.list_pickup_candidates(p_menu_id uuid)
returns table(user_id text,full_name text,available boolean,last_received_at timestamptz,received_count integer,phone_e164 text)
language plpgsql security invoker set search_path='' as $$
declare menu public.menus;
begin
  select * into menu from public.menus where id=p_menu_id;
  if menu.poster_id is distinct from (auth.jwt()->>'sub') then raise exception 'Chỉ người đăng menu được xem ứng viên nhận cơm.'; end if;
  return query select p.id,p.full_name,coalesce(a.available,false),history.last_received_at,coalesce(history.received_count,0),c.phone_e164
    from public.profiles p
    left join public.pickup_availability a on a.user_id=p.id and a.menu_date=menu.menu_date
    left join public.pickup_contacts c on c.user_id=p.id and a.available
    left join lateral(select max(mp.received_at) as last_received_at,count(distinct mp.menu_id)::integer as received_count
      from public.menu_pickups mp where mp.primary_user_id=p.id and mp.status='received' and mp.received_at>=clock_timestamp()-interval '30 days') history on true
    where exists(select 1 from public.orders o where o.menu_id=p_menu_id and o.user_id=p.id)
      or (p.id=menu.poster_id and not exists(select 1 from public.orders o join public.pickup_availability av on av.user_id=o.user_id
        and av.menu_date=menu.menu_date and av.available where o.menu_id=p_menu_id))
    order by p.full_name,p.id;
end $$;
create function public.lunch_validate_pickup_candidate(p_menu_id uuid,p_user_id text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_user_id is null or not exists(select 1 from public.list_pickup_candidates(p_menu_id) c
    where c.user_id=p_user_id and c.available and c.phone_e164 is not null) then
    raise exception 'Người nhận cần có đơn, đồng ý nhận cơm đúng ngày và lưu số liên hệ hợp lệ.';
  end if;
end $$;
create function public.lunch_guard_pickup() returns trigger
language plpgsql security invoker set search_path='' as $$
declare menu public.menus; actor text := auth.jwt()->>'sub';
begin
  if tg_op='INSERT' then
    if pg_trigger_depth()<2 then raise exception 'Phân công chỉ được tạo khi chốt menu.'; end if;
    return new;
  end if;
  select * into menu from public.menus where id=old.menu_id;
  if new.id<>old.id or new.menu_id<>old.menu_id or new.closure_id<>old.closure_id or old.status='received'
    or menu.current_closure_id<>old.closure_id or not menu.is_closed then raise exception 'Lượt nhận cơm không còn hoạt động.'; end if;
  if new.status='received' and old.status='assigned' then
    if actor is distinct from old.primary_user_id and actor is distinct from menu.poster_id then raise exception 'Chỉ người nhận hiện tại hoặc người đăng được xác nhận.'; end if;
    if new.primary_user_id is distinct from old.primary_user_id or new.backup_user_id is distinct from old.backup_user_id then raise exception 'Không thể đổi người nhận khi xác nhận.'; end if;
    new.received_at := clock_timestamp();
  elsif old.status='unassigned' and new.status='assigned' then
    if actor is distinct from menu.poster_id then raise exception 'Chỉ người đăng được phân công.'; end if;
    perform public.lunch_validate_pickup_candidate(old.menu_id,new.primary_user_id);
    if new.backup_user_id is not null then perform public.lunch_validate_pickup_candidate(old.menu_id,new.backup_user_id); end if;
    new.received_at := null;
  elsif old.status='assigned' and new.status='assigned' and new.primary_user_id=old.backup_user_id and new.backup_user_id is null then
    if actor is distinct from menu.poster_id then raise exception 'Chỉ người đăng được gọi người dự phòng.'; end if;
    perform public.lunch_validate_pickup_candidate(old.menu_id,new.primary_user_id);
    new.received_at := null;
  else raise exception 'Thay đổi phân công không hợp lệ.';
  end if;
  new.version := case when old.status='unassigned' then old.version else old.version+1 end;
  return new;
end $$;
create trigger lunch_pickup_guard before insert or update on public.menu_pickups for each row execute function public.lunch_guard_pickup();
create trigger lunch_domain_write_gate before insert or update or delete on public.menu_pickups for each statement execute function public.lunch_domain_write_lock();
create function public.lunch_guard_pickup_snapshot() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='INSERT' then
    if pg_trigger_depth()<2 then raise exception 'Liên hệ phân công chỉ được tạo cùng phân công.'; end if;
  elsif new.pickup_id<>old.pickup_id or new.user_id<>old.user_id or new.user_id is distinct from (auth.jwt()->>'sub')
    or not exists(select 1 from public.menu_pickups p join public.menus m on m.id=p.menu_id where p.id=old.pickup_id
      and p.status='assigned' and m.is_closed and m.current_closure_id=p.closure_id)
    or new.phone_e164 is distinct from (select c.phone_e164 from public.pickup_contacts c where c.user_id=new.user_id) then
    raise exception 'Chỉ chính chủ cập nhật liên hệ của lượt đang hoạt động.';
  end if;
  return new;
end $$;
create trigger lunch_pickup_snapshot_guard before insert or update on public.menu_pickup_contacts for each row execute function public.lunch_guard_pickup_snapshot();
create function public.lunch_sync_pickup_contacts() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if old.status='unassigned' and new.status='assigned' then
    insert into public.menu_pickup_contacts(pickup_id,user_id,phone_e164)
      select new.id,c.user_id,c.phone_e164 from public.pickup_contacts c where c.user_id in(new.primary_user_id,new.backup_user_id);
  end if;
  return new;
end $$;
create trigger lunch_pickup_contact_sync after update on public.menu_pickups for each row execute function public.lunch_sync_pickup_contacts();
create function public.lunch_sync_saved_pickup_phone() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  update public.menu_pickup_contacts s set phone_e164=new.phone_e164 where s.user_id=new.user_id and exists(
    select 1 from public.menu_pickups p join public.menus m on m.id=p.menu_id where p.id=s.pickup_id
      and p.status='assigned' and m.is_closed and m.current_closure_id=p.closure_id);
  return new;
end $$;
create trigger lunch_saved_phone_sync after update on public.pickup_contacts for each row execute function public.lunch_sync_saved_pickup_phone();
create function public.lunch_guard_domain_menu() returns trigger
language plpgsql security invoker set search_path='' as $$
declare closure uuid; revision integer; previous public.menu_pickups; pickup uuid;
begin
  if tg_op='DELETE' then
    if exists(select 1 from public.orders where menu_id=old.id) then raise exception 'Menu đã có đơn, hãy lưu trữ thay vì xoá.'; end if;
    return old;
  end if;
  if tg_op='INSERT' then
    if new.is_closed or new.current_closure_id is not null then raise exception 'Menu mới cần mở nhận đơn trước khi chốt.'; end if;
    return new;
  end if;
  if new.current_closure_id is distinct from old.current_closure_id then raise exception 'Không thể thay phiên chốt trực tiếp.'; end if;
  if (old.is_closed or new.is_closed) and (new.note is distinct from old.note or new.restaurant_id is distinct from old.restaurant_id
    or new.payment_mode is distinct from old.payment_mode or new.sponsor_reason is distinct from old.sponsor_reason
    or new.title is distinct from old.title or new.menu_date is distinct from old.menu_date or new.image_url is distinct from old.image_url) then
    raise exception 'Hãy mở lại menu trước khi sửa nội dung hoặc giá.';
  end if;
  if new.is_closed and not old.is_closed then
    select coalesce(max(c.revision),0)+1 into revision from public.menu_closures c where c.menu_id=old.id;
    insert into public.menu_closures(menu_id,revision,closed_by,payment_mode,sponsor_user_id)
      values(old.id,revision,auth.jwt()->>'sub',new.payment_mode,new.sponsor_user_id) returning id into closure;
    insert into public.closure_items(closure_id,order_item_id,order_id,user_id,name_snapshot,unit_price)
      select closure,i.id,i.order_id,o.user_id,i.name_snapshot,
        case when i.menu_item_id is not null then mi.price
          when (select count(*) from public.menu_items n where n.menu_id=old.id and n.name=i.name_snapshot)=1
          then (select n.price from public.menu_items n where n.menu_id=old.id and n.name=i.name_snapshot) else null end
      from public.order_items i join public.orders o on o.id=i.order_id
      left join public.menu_items mi on mi.id=i.menu_item_id and mi.menu_id=old.id where i.menu_id=old.id;
    select * into previous from public.menu_pickups where closure_id=old.current_closure_id and status='received';
    insert into public.menu_pickups(closure_id,menu_id,primary_user_id,backup_user_id,status,received_at)
      values(closure,old.id,previous.primary_user_id,previous.backup_user_id,coalesce(previous.status,'unassigned'),previous.received_at) returning id into pickup;
    if previous.id is not null then
      insert into public.menu_pickup_contacts(pickup_id,user_id,phone_e164)
        select pickup,s.user_id,s.phone_e164 from public.menu_pickup_contacts s where s.pickup_id=previous.id;
    end if;
    new.current_closure_id := closure;
  end if;
  return new;
end $$;
create trigger lunch_z_domain_menu_guard before insert or update or delete on public.menus for each row execute function public.lunch_guard_domain_menu();
-- Catalog transaction markers are not permission to alter a closed menu's price.
create function public.lunch_guard_closed_menu_item() returns trigger
language plpgsql security invoker set search_path='' as $$
declare menu_closed boolean;
begin
  if tg_op='DELETE' then
    select is_closed into menu_closed from public.menus where id=old.menu_id;
    if coalesce(menu_closed,false) then raise exception 'Hãy mở lại menu trước khi sửa giá hoặc món.'; end if;
    return old;
  end if;
  select is_closed into menu_closed from public.menus where id=new.menu_id;
  if coalesce(menu_closed,false) then
    if tg_op='INSERT' then raise exception 'Hãy mở lại menu trước khi sửa giá hoặc món.'; end if;
    if new is distinct from old then raise exception 'Hãy mở lại menu trước khi sửa giá hoặc món.'; end if;
  end if;
  return new;
end $$;
create trigger lunch_z_closed_item_guard before insert or update or delete on public.menu_items for each row execute function public.lunch_guard_closed_menu_item();
create function public.close_lunch_menu(p_menu_id uuid,p_expected_revision integer,p_primary_user_id text,p_backup_user_id text default null,p_allow_unassigned boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare menu public.menus; revision integer; pickup public.menu_pickups; previous public.menu_pickups;
begin
  perform pg_advisory_xact_lock(hashtextextended('lunch_domain_write',0));
  perform pg_advisory_xact_lock(hashtextextended(p_menu_id::text,0));
  select * into menu from public.menus where id=p_menu_id for update;
  if menu.poster_id is distinct from (auth.jwt()->>'sub') then raise exception 'Chỉ người đăng được chốt menu.'; end if;
  select coalesce(max(c.revision),0) into revision from public.menu_closures c where c.menu_id=p_menu_id;
  if menu.is_closed or p_expected_revision is distinct from revision then raise exception 'Menu đã thay đổi, hãy tải lại trước khi chốt.'; end if;
  -- A revised financial close must not assign a second delivery or recheck
  -- today's eligibility for the delivery already recorded as completed.
  select * into previous from public.menu_pickups where closure_id=menu.current_closure_id and status='received';
  if previous.id is null then
    if p_primary_user_id is null then
      if p_allow_unassigned is distinct from true or p_backup_user_id is not null then
        raise exception 'Hãy chọn người nhận hoặc xác nhận chốt khi chưa có người nhận.';
      end if;
    else
      if p_primary_user_id=p_backup_user_id then raise exception 'Người nhận và dự phòng phải khác nhau.'; end if;
      perform public.lunch_validate_pickup_candidate(p_menu_id,p_primary_user_id);
      if p_backup_user_id is not null then perform public.lunch_validate_pickup_candidate(p_menu_id,p_backup_user_id); end if;
    end if;
  end if;
  update public.menus set is_closed=true where id=p_menu_id returning * into menu;
  select * into pickup from public.menu_pickups where closure_id=menu.current_closure_id;
  if pickup.status='unassigned' and p_primary_user_id is not null then
    update public.menu_pickups set primary_user_id=p_primary_user_id,backup_user_id=p_backup_user_id,status='assigned'
      where id=pickup.id returning * into pickup;
    -- Assignment starts at version 1; subsequent transitions use optimistic versions.
  end if;
  return jsonb_build_object('menu_id',menu.id,'closure_id',menu.current_closure_id,'revision',revision+1,'pickup_id',pickup.id);
end $$;
create function public.reopen_lunch_menu(p_menu_id uuid,p_expected_revision integer) returns public.menus
language plpgsql security invoker set search_path='' as $$
declare result public.menus; revision integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('lunch_domain_write',0));
  perform pg_advisory_xact_lock(hashtextextended(p_menu_id::text,0));
  select * into result from public.menus where id=p_menu_id for update;
  if result.poster_id is distinct from (auth.jwt()->>'sub') then raise exception 'Chỉ người đăng được mở lại menu.'; end if;
  select coalesce(max(c.revision),0) into revision from public.menu_closures c where c.menu_id=p_menu_id;
  if not result.is_closed or p_expected_revision is distinct from revision then raise exception 'Phiên chốt đã thay đổi, hãy tải lại.'; end if;
  update public.menus set is_closed=false where id=p_menu_id returning * into result;
  return result;
end $$;
create function public.activate_pickup_backup(p_pickup_id uuid,p_expected_version integer) returns public.menu_pickups
language plpgsql security invoker set search_path='' as $$
declare result public.menu_pickups;
begin
  perform pg_advisory_xact_lock(hashtextextended('lunch_domain_write',0));
  select * into result from public.menu_pickups where id=p_pickup_id for update;
  if not exists(select 1 from public.menus m where m.id=result.menu_id and m.poster_id=(auth.jwt()->>'sub'))
    or result.version is distinct from p_expected_version or result.status<>'assigned' or result.backup_user_id is null then
    raise exception 'Không thể gọi dự phòng, hãy tải lại phân công.';
  end if;
  update public.menu_pickups set primary_user_id=backup_user_id,backup_user_id=null where id=p_pickup_id returning * into result;
  return result;
end $$;
create function public.mark_lunch_received(p_pickup_id uuid) returns public.menu_pickups
language plpgsql security invoker set search_path='' as $$
declare result public.menu_pickups;
begin
  perform pg_advisory_xact_lock(hashtextextended('lunch_domain_write',0));
  select * into result from public.menu_pickups where id=p_pickup_id for update;
  if result.primary_user_id is distinct from (auth.jwt()->>'sub') and not exists(select 1 from public.menus m
    where m.id=result.menu_id and m.poster_id=(auth.jwt()->>'sub')) then raise exception 'Bạn không có quyền xác nhận nhận cơm.'; end if;
  if result.status='received' then return result; end if;
  update public.menu_pickups set status='received' where id=p_pickup_id returning * into result;
  return result;
end $$;
create function public.archive_lunch_menu(p_menu_id uuid) returns public.menus
language plpgsql security invoker set search_path='' as $$
declare result public.menus;
begin
  update public.menus set archived_at=coalesce(archived_at,clock_timestamp()) where id=p_menu_id and poster_id=(auth.jwt()->>'sub') returning * into result;
  if result.id is null then raise exception 'Chỉ người đăng được lưu trữ menu.'; end if;
  return result;
end $$;
revoke all on function public.lunch_guard_closed_menu_item(),public.lunch_domain_write_lock(),public.lunch_guard_pickup(),public.lunch_guard_pickup_snapshot(),public.lunch_sync_pickup_contacts(),public.lunch_sync_saved_pickup_phone(),public.lunch_guard_domain_menu(),public.list_pickup_candidates(uuid),public.lunch_validate_pickup_candidate(uuid,text),public.close_lunch_menu(uuid,integer,text,text,boolean),public.reopen_lunch_menu(uuid,integer),public.activate_pickup_backup(uuid,integer),public.mark_lunch_received(uuid),public.archive_lunch_menu(uuid) from public,anon;
grant execute on function public.list_pickup_candidates(uuid),public.lunch_validate_pickup_candidate(uuid,text),public.close_lunch_menu(uuid,integer,text,text,boolean),public.reopen_lunch_menu(uuid,integer),public.activate_pickup_backup(uuid,integer),public.mark_lunch_received(uuid),public.archive_lunch_menu(uuid) to authenticated;
commit;
