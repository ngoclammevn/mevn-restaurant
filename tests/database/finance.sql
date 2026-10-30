select public.test_assert(not exists((select * from domain_legacy_orders except select id,user_id,menu_id,item_text,note,is_paid,paid_at from public.orders) union all (select id,user_id,menu_id,item_text,note,is_paid,paid_at from public.orders where id in(select id from domain_legacy_orders) except select * from domain_legacy_orders)),'domain migration preserves all legacy order/payment fields');
select public.test_assert(not exists(select * from domain_legacy_profiles except select id,payment_info from public.profiles),'domain migration preserves profile payment information');
select public.test_assert(not exists(select 1 from public.menus where id in('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003') and (payment_mode<>'self' or current_closure_id is not null)),'legacy closed menus have self-pay and no invented historical prices');
set role authenticated;
set request.jwt.claims='{"sub":"user_a","role":"authenticated"}';
select id as sponsor_menu from public.save_lunch_menu_v2(p_title=>'Được mời',p_menu_date=>current_date,p_note=>'Món tự nhập',p_payment_mode=>'sponsored',p_sponsor_reason=>'Công ty mời') \gset
select public.test_assert((select sponsor_user_id='user_a' and payment_mode='sponsored' from public.menus where id=:'sponsor_menu'),'sponsor is derived from poster');
insert into public.orders(menu_id,user_id,item_text) values(:'sponsor_menu','user_b','Cơm');
select public.test_rejected(format('update public.menus set payment_mode=''self'',sponsor_user_id=null where id=%L',:'sponsor_menu'));
select public.test_assert((select not is_paid and paid_at is null from public.orders where menu_id=:'sponsor_menu'),'sponsorship leaves original self-payment fields unchanged');
select public.test_rejected(format('update public.menus set sponsor_user_id=''user_b'' where id=%L',:'sponsor_menu'));
reset role;
