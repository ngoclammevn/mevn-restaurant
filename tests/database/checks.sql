create function public.test_assert(value boolean, label text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'FAIL: %',label; end if;
  raise notice 'PASS: %',label;
end $$;
create function public.test_rejected(statement text) returns void language plpgsql security invoker as $$
begin
  begin execute statement;
  exception when others then return;
  end;
  raise exception 'Expected rejection: %', statement;
end $$;

select public.test_assert((select count(*)=2 from public.menu_items where menu_id='00000000-0000-4000-8000-000000000001'),'legacy structured items backfilled');
select public.test_assert((select count(*)=2 from public.order_items where menu_id='00000000-0000-4000-8000-000000000001' and menu_item_id is not null),'exact legacy match becomes two linked items');
select public.test_assert((select count(*)=3 from public.order_items where menu_item_id is null),'unmatched/plain/incompatible legacy remain unlinked');
select public.test_assert((select count(*)=0 from public.restaurant_dishes),'legacy does not guess restaurants');

set role authenticated;
set request.jwt.claims='{"sub":"user_a","role":"authenticated"}';
insert into public.restaurants(id,name) values
('10000000-0000-4000-8000-000000000001','Quán A'),('10000000-0000-4000-8000-000000000002','Quán B');
select id as menu_a from public.save_lunch_menu(p_title=>'Menu A',p_menu_date=>current_date-1,
  p_restaurant_id=>'10000000-0000-4000-8000-000000000001',
  p_note=>'{"dishes":[{"name":"Cơm gà","price":35000},{"name":"Rau","price":null}]}') \gset
select id as menu_b from public.save_lunch_menu(p_title=>'Menu B',p_menu_date=>current_date-1,
  p_restaurant_id=>'10000000-0000-4000-8000-000000000002',p_note=>'{"dishes":[{"name":"Cơm gà","price":40000}]}') \gset
select id as chicken_a, restaurant_dish_id as dish_a from public.menu_items where menu_id=:'menu_a' and name='Cơm gà' \gset
select id as veg_a from public.menu_items where menu_id=:'menu_a' and name='Rau' \gset
select id as chicken_b, restaurant_dish_id as dish_b from public.menu_items where menu_id=:'menu_b' \gset
select public.test_assert(:'dish_a'<>:'dish_b','same dish name has distinct shop identity');
insert into public.orders(menu_id,user_id,item_text,menu_item_ids)
  values(:'menu_a','user_b',E'Cơm gà\nRau',array[:'chicken_a'::uuid,:'veg_a'::uuid]) returning id as delegated \gset
select id as review_item from public.order_items where order_id=:'delegated' and menu_item_id=:'chicken_a' \gset
select public.test_assert((select count(*)=2 from public.order_items where order_id=:'delegated'),'delegated creation atomically creates recipient items');
update public.orders set is_paid=true where id=:'delegated';
select public.test_assert((select not is_paid from public.orders where id=:'delegated'),'placing user cannot mark recipient paid');
select public.test_rejected(format('insert into public.dish_reviews(order_item_id,rating) values(%L,5)',:'review_item'));
select public.test_rejected(format('insert into public.orders(menu_id,user_id,item_text,menu_item_ids) values(%L,''user_a'',''Cơm gà'',array[%L::uuid])',:'menu_a',:'chicken_b'));
select public.test_rejected(format('insert into public.order_items(order_id,menu_id,menu_item_id,name_snapshot) values(%L,%L,%L,''Giả'')',:'delegated',:'menu_a',:'chicken_b'));
select public.test_rejected(format('update public.restaurant_dishes set restaurant_id=''10000000-0000-4000-8000-000000000002'' where id=%L',:'dish_a'));
select public.test_rejected('select public.save_lunch_menu(p_title=>''Giá lỗi'',p_note=>''{"dishes":[{"name":"Lỗi","price":-1}]}'')');
update public.menu_items set name='Đổi tên' where id=:'chicken_a';
select public.test_assert((select name='Cơm gà' from public.menu_items where id=:'chicken_a'),'direct item edit without menu transaction affects no rows');
select public.test_rejected(format('select public.save_lunch_menu(p_id=>%L,p_title=>''A'',p_menu_date=>current_date-1,p_restaurant_id=>''10000000-0000-4000-8000-000000000002'',p_note=>''{"dishes":[{"name":"Cơm gà"},{"name":"Rau"}]}'')',:'menu_a'));
update public.menus set note=jsonb_set(note::jsonb,'{dishes,0,available}','false')::text where id=:'menu_a';
select public.test_assert((select not available from public.menu_items where id=:'chicken_a'),'poster marks dish sold out without changing its identity');
select public.test_rejected(format('insert into public.orders(menu_id,user_id,item_text,menu_item_ids) values(%L,''user_a'',''Cơm gà'',array[%L::uuid])',:'menu_a',:'chicken_a'));

set request.jwt.claims='{"sub":"user_b","role":"authenticated"}';
insert into public.dish_reviews(order_item_id,rating,labels,note) values(:'review_item',4,array['Thịt mềm','Hơi mặn'],'Ghi chú tự do');
insert into public.dish_reviews(order_item_id,rating,labels) values(:'review_item',3,array['Hơi dai']) on conflict(order_item_id) do update set rating=excluded.rating,labels=excluded.labels;
select public.test_assert((select count(*)=1 and max(rating)=3 from public.dish_reviews where order_item_id=:'review_item'),'recipient creates/updates one review per item');
select public.test_assert((select average_rating=3 and rating_count=1 and reviewer_count=1 from public.restaurant_dish_stats where id=:'dish_a'),'shop A statistics count correct reviews');
select public.test_assert((select average_rating is null and rating_count=0 from public.restaurant_dish_stats where id=:'dish_b'),'shop B ratings stay separate');
update public.orders set note='Ít cơm' where id=:'delegated';
select public.test_assert((select count(*)=1 from public.dish_reviews where order_item_id=:'review_item'),'note edit preserves item IDs and reviews');
begin;
update public.orders set item_text=E'Rau\nCơm gà',menu_item_ids=array[:'veg_a'::uuid,:'chicken_a'::uuid] where id=:'delegated';
update public.orders set item_text=E'Cơm gà\nRau',menu_item_ids=array[:'chicken_a'::uuid,:'veg_a'::uuid] where id=:'delegated';
commit;
select public.test_assert((select count(*)=2 from public.order_items where order_id=:'delegated'),'repeated edits in one transaction keep complete selected items');
select public.test_assert((select position=0 from public.order_items where id=:'review_item'),'selected item position and review ID remain stable');
select public.test_rejected(format('update public.dish_reviews set rating=0 where order_item_id=%L',:'review_item'));
begin;
update public.orders set note='Kiểm tra snapshot' where id=:'delegated';
select public.test_rejected(format('update public.order_items set name_snapshot=''Giả'' where id=%L',:'review_item'));
rollback;
select id as future_menu from public.save_lunch_menu(p_title=>'Mai',p_menu_date=>current_date+2,p_note=>'Món tự nhập') \gset
insert into public.orders(menu_id,user_id,item_text) values(:'future_menu','user_b','Bún') returning id as future_order \gset
select id as future_item from public.order_items where order_id=:'future_order' \gset
select public.test_rejected(format('insert into public.dish_reviews(order_item_id,rating) values(%L,5)',:'future_item'));

set request.jwt.claims='{"sub":"user_a","role":"authenticated"}';
update public.menus set is_closed=true where id=:'menu_a';
set request.jwt.claims='{"sub":"user_b","role":"authenticated"}';
select public.test_rejected(format('update public.orders set note=''Đổi khi chốt'' where id=%L',:'delegated'));
select public.test_rejected(format('insert into public.orders(menu_id,user_id,item_text) values(%L,''user_b'',''Cơm gà'')',:'menu_a'));
delete from public.orders where id=:'delegated';
select public.test_assert((select count(*)=1 from public.orders where id=:'delegated'),'closed order cannot be deleted');
update public.orders set is_paid=true,paid_at=now() where id=:'delegated';
select public.test_assert((select is_paid from public.orders where id=:'delegated'),'owner can self-pay after closure');
update public.dish_reviews set rating=5 where order_item_id=:'review_item';
select public.test_assert((select rating=5 from public.dish_reviews where order_item_id=:'review_item'),'owner can review after closure');

set role anon;
select public.test_assert((select count(*)=0 from public.restaurants),'anonymous cannot read restaurants');
select public.test_assert((select count(*)=0 from public.dish_reviews),'anonymous cannot read reviews');
reset role;
select public.test_assert((select note='Ít cơm' from public.orders where id=:'delegated'),'rejected edits are atomic');
select public.test_assert((select name_snapshot='Cơm gà' from public.order_items where id=:'review_item'),'snapshot cannot be forged');
