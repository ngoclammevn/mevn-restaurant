-- Run after checks.sql and the domain migrations.
set role authenticated;
set request.jwt.claims='{"sub":"user_a","role":"authenticated"}';
select id as pickup_menu from public.save_lunch_menu(p_title=>'Pickup privacy',p_note=>'Món tự nhập',p_menu_date=>current_date) \gset
insert into public.orders(menu_id,user_id,item_text) values(:'pickup_menu','user_b','Cơm') returning id as pickup_order \gset
select public.test_assert((select count(*)=0 from public.pickup_availability where user_id='user_b'),'delegated order does not create consent');
select public.test_rejected('insert into public.pickup_contacts(user_id,phone_e164) values(''user_b'',''+84901234567'')');
select public.test_rejected('insert into public.pickup_availability(user_id,menu_date,available) values(''user_b'',current_date,true)');
set request.jwt.claims='{"sub":"user_b","role":"authenticated"}';
select public.test_rejected('select public.save_pickup_preferences(current_date,true)');
select public.save_pickup_preferences(current_date,true,'090 123 4567');
select public.save_pickup_preferences(current_date+1,true);
select public.test_assert((select phone_e164='+84901234567' from public.pickup_contacts where user_id='user_b'),'saved phone reused on another day');
select public.save_pickup_preferences(current_date+2,false);
select public.test_assert((select not available from public.pickup_availability where user_id='user_b' and menu_date=current_date+2),'negative consent is saved');
set request.jwt.claims='{"sub":"user_a","role":"authenticated"}';
select public.test_assert((select count(*)=1 from public.pickup_contacts where user_id='user_b'),'poster sees consenting ordered candidate contact');
update public.pickup_contacts set phone_e164='+84909876543' where user_id='user_b';
select public.test_assert((select phone_e164='+84901234567' from public.pickup_contacts where user_id='user_b'),'poster cannot change contact');
reset role;
insert into public.profiles(id,full_name) values('user_c','Người ngoài');
set role authenticated;
set request.jwt.claims='{"sub":"user_c","role":"authenticated"}';
select public.test_assert((select count(*)=0 from public.pickup_contacts where user_id='user_b'),'unrelated member cannot read contact');
select public.test_assert((select count(*)=0 from public.pickup_availability where user_id='user_b'),'unrelated member cannot read consent');
set role anon;
select public.test_rejected('select * from public.pickup_contacts');
reset role;
