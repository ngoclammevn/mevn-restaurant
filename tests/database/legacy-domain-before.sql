-- Run immediately before the three domain migrations.
create temporary table domain_legacy_orders as select id,user_id,menu_id,item_text,note,is_paid,paid_at from public.orders;
create temporary table domain_legacy_profiles as select id,payment_info from public.profiles;
