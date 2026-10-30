set role authenticated;
set request.jwt.claims='{"sub":"user_a","role":"authenticated"}';
select id as close_menu from public.save_lunch_menu_v2(p_title=>'Chốt có giá',p_menu_date=>current_date,p_note=>' {"dishes":[{"name":"Cơm","price":35000},{"name":"Rau","price":null},{"name":"Nước","price":0}]}') \gset
insert into public.orders(menu_id,user_id,item_text) values(:'close_menu','user_b',E'Cơm\nRau\nNước') returning id as close_order \gset
insert into public.orders(menu_id,user_id,item_text) values(:'close_menu','user_a','Cơm');
select public.save_pickup_preferences(current_date,true,'0987654321');
set request.jwt.claims='{"sub":"user_b","role":"authenticated"}';
select public.test_rejected(format('select public.close_lunch_menu(%L,0,''user_b'')',:'close_menu'));
set request.jwt.claims='{"sub":"user_a","role":"authenticated"}';
select public.test_rejected(format('select public.close_lunch_menu(%L,0,''user_c'')',:'close_menu'));
select public.test_rejected(format('select public.close_lunch_menu(%L,0,''user_b'',''user_b'')',:'close_menu'));
select public.close_lunch_menu(:'close_menu',0,'user_b','user_a')->>'pickup_id' as close_pickup \gset
select current_closure_id as closure_one from public.menus where id=:'close_menu' \gset
select public.test_assert((select count(*)=4 and count(*) filter(where unit_price is null)=1 and count(*) filter(where unit_price=0)=1 from public.closure_items where closure_id=:'closure_one'),'closure freezes exact known, unknown and zero prices');
select public.test_rejected(format('select public.close_lunch_menu(%L,0,''user_b'')',:'close_menu'));
select public.test_rejected(format('update public.menus set note=''change'' where id=%L',:'close_menu'));
begin;
update public.menus set title=title where id=:'close_menu';
select public.test_rejected(format('update public.menu_items set price=1 where menu_id=%L',:'close_menu'));
rollback;
set request.jwt.claims='{"sub":"user_c","role":"authenticated"}';
select public.test_rejected(format('select public.mark_lunch_received(%L)',:'close_pickup'));
set request.jwt.claims='{"sub":"user_a","role":"authenticated"}';

select public.test_rejected(format('insert into public.menu_closures(menu_id,revision,closed_by,payment_mode) values(%L,99,''user_a'',''self'')',:'close_menu'));
select public.test_rejected(format('update public.closure_items set unit_price=1 where closure_id=%L',:'closure_one'));
select public.test_rejected(format('delete from public.menus where id=%L',:'close_menu'));
set request.jwt.claims='{"sub":"user_b","role":"authenticated"}';
update public.orders set is_paid=true,paid_at=clock_timestamp() where id=:'close_order';
select public.test_assert((select is_paid from public.orders where id=:'close_order'),'owner self-pays after domain closure');
select public.update_pickup_phone('0912345678');
select public.test_assert((select phone_e164='+84912345678' from public.menu_pickup_contacts where pickup_id=:'close_pickup' and user_id='user_b'),'active snapshot follows own phone update');
select public.test_assert((select count(*)=1 from public.menu_pickup_contacts where pickup_id=:'close_pickup'),'primary cannot read backup phone');
set request.jwt.claims='{"sub":"user_a","role":"authenticated"}';
select public.activate_pickup_backup(:'close_pickup',1);
select public.test_rejected(format('select public.activate_pickup_backup(%L,1)',:'close_pickup'));
select public.mark_lunch_received(:'close_pickup');
select public.mark_lunch_received(:'close_pickup');
select public.update_pickup_phone('0977777777');
select public.test_assert((select phone_e164='+84987654321' from public.menu_pickup_contacts where pickup_id=:'close_pickup' and user_id='user_a'),'received contact snapshot is immutable');
select public.reopen_lunch_menu(:'close_menu',1);
update public.menus set note='{"dishes":[{"name":"Cơm","price":40000},{"name":"Rau","price":10000},{"name":"Nước","price":0}]}' where id=:'close_menu';
select public.close_lunch_menu(:'close_menu',1,'user_a','user_b');
select public.test_assert((select count(*)=2 from public.menu_closures where menu_id=:'close_menu'),'reclose creates a revision without deleting history');
select public.test_assert((select unit_price=35000 from public.closure_items where closure_id=:'closure_one' and order_id=:'close_order' and name_snapshot='Cơm'),'earlier revision price stays frozen');
select public.test_assert((select received_count=1 from public.list_pickup_candidates(:'close_menu') where user_id='user_a'),'received fairness counts distinct menus across revisions');
select public.archive_lunch_menu(:'close_menu');
select public.test_assert((select archived_at is not null from public.menus where id=:'close_menu'),'archive retains a menu with orders');
select public.test_assert((select is_paid from public.orders where id=:'close_order'),'archive preserves paid state');
select public.test_assert((select not is_paid from public.orders where menu_id=:'close_menu' and user_id='user_a'),'archive preserves outstanding debt');
select id as direct_close from public.save_lunch_menu(p_title=>'Client cũ',p_menu_date=>current_date,p_note=>'Món chữ') \gset
insert into public.orders(menu_id,user_id,item_text) values(:'direct_close','user_b','Bún');
update public.menus set is_closed=true where id=:'direct_close';
select public.test_assert((select p.status='unassigned' and ci.unit_price is null from public.menus m join public.menu_pickups p on p.closure_id=m.current_closure_id join public.closure_items ci on ci.closure_id=m.current_closure_id where m.id=:'direct_close'),'old direct close creates financial snapshot and unassigned pickup');
reset role;
