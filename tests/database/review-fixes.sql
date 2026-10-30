-- Focused review regressions; dedicated identities prevent earlier fixtures' menus
-- from granting legitimate contact access that would mask isolation assertions.
reset role;
insert into public.profiles(id,full_name) values
  ('review_poster','Người đăng kiểm thử'),('review_recipient','Người nhận kiểm thử');
set role authenticated;
set request.jwt.claims='{"sub":"review_poster","role":"authenticated"}';
select id as review_unassigned_menu from public.save_lunch_menu_v2(p_title=>'Chốt chưa có người nhận',p_menu_date=>current_date+10,p_note=>'Cơm tự chọn') \gset
insert into public.orders(menu_id,user_id,item_text) values(:'review_unassigned_menu','review_recipient','Cơm');
select public.test_assert((select not exists(select 1 from public.list_pickup_candidates(:'review_unassigned_menu') where available)),'review: no volunteers available');
select public.test_rejected(format('select public.close_lunch_menu(%L,0,null)',:'review_unassigned_menu'));
select public.test_rejected(format('select public.close_lunch_menu(%L,0,null,null,false)',:'review_unassigned_menu'));
select public.test_rejected(format('select public.close_lunch_menu(%L,0,null,''review_recipient'',true)',:'review_unassigned_menu'));
select public.test_assert((select not is_closed and current_closure_id is null from public.menus where id=:'review_unassigned_menu'),'review: unconfirmed close leaves menu open');
select public.close_lunch_menu(:'review_unassigned_menu',0,null,null,true)->>'pickup_id' as review_unassigned_pickup \gset
select public.test_assert((select status='unassigned' and primary_user_id is null and backup_user_id is null and received_at is null from public.menu_pickups where id=:'review_unassigned_pickup'),'review: explicit no-volunteer close remains unassigned');
select public.test_assert((select count(*)=0 from public.menu_pickup_contacts where pickup_id=:'review_unassigned_pickup'),'review: unassigned close invents no contact');
select public.test_assert((select m.is_closed and count(ci.order_item_id)=1 from public.menus m join public.closure_items ci on ci.closure_id=m.current_closure_id where m.id=:'review_unassigned_menu' group by m.is_closed),'review: unassigned close freezes financial items');

-- Closed/unassigned candidate visibility stays limited to the poster's consenting order owners.
set request.jwt.claims='{"sub":"review_recipient","role":"authenticated"}';
select public.save_pickup_preferences(current_date+10,true,'0901234567');
set request.jwt.claims='{"sub":"review_poster","role":"authenticated"}';
select public.test_assert((select phone_e164='+84901234567' from public.list_pickup_candidates(:'review_unassigned_menu') where user_id='review_recipient'),'review: closed unassigned pickup permits candidate validation');
reset role;
insert into public.profiles(id,full_name) values('review_non_orderer','Người không đặt') on conflict(id) do nothing;
set role authenticated;
set request.jwt.claims='{"sub":"review_non_orderer","role":"authenticated"}';
select public.save_pickup_preferences(current_date+10,true,'0987654321');
set request.jwt.claims='{"sub":"review_poster","role":"authenticated"}';
select public.test_assert((select count(*)=0 from public.pickup_contacts where user_id='review_non_orderer'),'review: closed unassigned pickup never exposes a non-orderer contact');
set request.jwt.claims='{"sub":"review_recipient","role":"authenticated"}';
select public.save_pickup_preferences(current_date+10,false);
set request.jwt.claims='{"sub":"review_poster","role":"authenticated"}';
select public.test_assert((select count(*)=0 from public.pickup_contacts where user_id='review_recipient'),'review: unassigned contact visibility ends when consent is withdrawn');

select id as review_received_menu from public.save_lunch_menu_v2(p_title=>'Sửa giá sau khi nhận cơm',p_menu_date=>current_date+11,p_note=>' {"dishes":[{"name":"Cơm","price":35000}]}') \gset
insert into public.orders(menu_id,user_id,item_text) values(:'review_received_menu','review_recipient','Cơm') returning id as review_received_order \gset
set request.jwt.claims='{"sub":"review_recipient","role":"authenticated"}';
select public.save_pickup_preferences(current_date+11,true,'0901234567');
set request.jwt.claims='{"sub":"review_poster","role":"authenticated"}';
select public.close_lunch_menu(:'review_received_menu',0,'review_recipient')->>'pickup_id' as review_received_pickup \gset
select public.mark_lunch_received(:'review_received_pickup');
select current_closure_id as review_received_closure from public.menus where id=:'review_received_menu' \gset
select received_at::text as review_received_at from public.menu_pickups where id=:'review_received_pickup' \gset
select public.reopen_lunch_menu(:'review_received_menu',1);
update public.menus set note='{"dishes":[{"name":"Cơm","price":40000}]}' where id=:'review_received_menu';
set request.jwt.claims='{"sub":"review_recipient","role":"authenticated"}';
select public.save_pickup_preferences(current_date+11,false);
select public.update_pickup_phone('0912345678');
set request.jwt.claims='{"sub":"review_poster","role":"authenticated"}';
select public.test_assert((select not available and phone_e164 is null from public.list_pickup_candidates(:'review_received_menu') where user_id='review_recipient'),'review: recorded recipient has withdrawn availability and current phone is private');
select public.close_lunch_menu(:'review_received_menu',1,'review_recipient')->>'pickup_id' as review_reclosed_pickup \gset
select public.test_assert((select count(*)=2 from public.menu_closures where menu_id=:'review_received_menu'),'review: completed reclose creates second financial revision');
select public.test_assert((select status='received' and primary_user_id='review_recipient' and received_at=:'review_received_at'::timestamptz from public.menu_pickups where id=:'review_reclosed_pickup'),'review: completed reclose carries recipient and received time');
select public.test_assert((select count(*)=2 and bool_and(phone_e164='+84901234567') from public.menu_pickup_contacts where pickup_id in(:'review_received_pickup',:'review_reclosed_pickup')),'review: completed reclose carries immutable original contact');
select public.test_assert((select unit_price=35000 from public.closure_items where closure_id=:'review_received_closure' and order_id=:'review_received_order'),'review: original financial snapshot remains unchanged');
select public.test_assert((select ci.unit_price=40000 from public.closure_items ci join public.menus m on m.current_closure_id=ci.closure_id where m.id=:'review_received_menu'),'review: new financial snapshot uses revised price');
-- A further financial revision can omit assignment parameters entirely; no new delivery is assigned.
select public.reopen_lunch_menu(:'review_received_menu',2);
select public.close_lunch_menu(:'review_received_menu',2,null)->>'pickup_id' as review_third_pickup \gset
select public.test_assert((select count(*)=3 and bool_and(status='received') and bool_and(primary_user_id='review_recipient') and bool_and(received_at=:'review_received_at'::timestamptz) from public.menu_pickups where menu_id=:'review_received_menu'),'review: all completed pickup revisions keep original recipient and time');
select public.test_assert((select count(*)=3 and bool_and(phone_e164='+84901234567') from public.menu_pickup_contacts c join public.menu_pickups p on p.id=c.pickup_id where p.menu_id=:'review_received_menu'),'review: no new assignment needed for subsequent completed revisions');
reset role;

-- Require the archive guard's exact rejection: a duplicate-item constraint or
-- an unrelated RLS error must not make these archive regressions pass.
create function public.test_archived_write_rejected(statement text) returns boolean
language plpgsql security invoker as $$
begin
  execute statement;
  raise exception 'archive_write_unexpectedly_succeeded';
exception when others then
  return sqlerrm='Menu đã lưu trữ, không thể thêm, sửa hoặc xoá món.';
end $$;
begin;
set role authenticated;
set request.jwt.claims='{"sub":"review_poster","role":"authenticated"}';
select id as review_archived_menu from public.save_lunch_menu_v2(p_title=>'Lưu trữ menu đang mở',p_menu_date=>current_date+12,p_note=>'Cơm tự chọn') \gset
set request.jwt.claims='{"sub":"review_recipient","role":"authenticated"}';
insert into public.orders(menu_id,user_id,item_text) values(:'review_archived_menu','review_recipient','Cơm') returning id as review_archived_order \gset
select id as review_archived_item from public.order_items where order_id=:'review_archived_order' \gset
set request.jwt.claims='{"sub":"review_poster","role":"authenticated"}';
select public.archive_lunch_menu(:'review_archived_menu');
select public.test_assert((select archived_at is not null and not is_closed and current_closure_id is null and payment_mode='self' from public.menus where id=:'review_archived_menu'),'review: archiving an open menu neither closes it nor invents financial revisions');
set request.jwt.claims='{"sub":"review_recipient","role":"authenticated"}';
select public.test_assert(public.test_archived_write_rejected(format('insert into public.orders(menu_id,user_id,item_text) values(%L,''review_recipient'',''Bún'')',:'review_archived_menu')),'review: archived menu rejects new orders through the database');
select public.test_assert(public.test_archived_write_rejected(format('update public.orders set item_text=''Bún'' where id=%L',:'review_archived_order')),'review: archived order rejects changed dishes');
select public.test_assert(public.test_archived_write_rejected(format('update public.orders set note=''Đổi ghi chú'' where id=%L',:'review_archived_order')),'review: archived order rejects changed notes');
select public.test_assert(public.test_archived_write_rejected(format('delete from public.orders where id=%L',:'review_archived_order')),'review: archived order cannot be deleted');
-- Same transaction as creation deliberately satisfies the catalog's items_tx
-- RLS marker, proving archive protection even for an otherwise-authorized RPC.
select public.test_assert(public.test_archived_write_rejected(format('insert into public.order_items(order_id,menu_id,name_snapshot) values(%L,%L,''Cơm'')',:'review_archived_order',:'review_archived_menu')),'review: archived order rejects direct item insertion before constraints');
select public.test_assert(public.test_archived_write_rejected(format('update public.order_items set position=position where id=%L',:'review_archived_item')),'review: archived order rejects item updates even with current transaction permission');
select public.test_assert(public.test_archived_write_rejected(format('delete from public.order_items where id=%L',:'review_archived_item')),'review: archived order rejects item deletion even with current transaction permission');
update public.orders set is_paid=true,paid_at=clock_timestamp() where id=:'review_archived_order';
select public.test_assert((select is_paid and paid_at is not null and item_text='Cơm' and note is null from public.orders where id=:'review_archived_order'),'review: archived order still allows owner self-payment without changing content');
update public.orders set is_paid=false,paid_at=null where id=:'review_archived_order';
select public.test_assert((select not is_paid and paid_at is null from public.orders where id=:'review_archived_order'),'review: archived order still allows owner to undo self-payment');
select public.test_assert((select count(*)=1 from public.order_items where order_id=:'review_archived_order'),'review: rejected archived writes preserve historical order items');
reset role;
commit;
