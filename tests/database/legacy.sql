insert into public.profiles(id,full_name) values ('user_a','Người đăng'),('user_b','Người ăn');
insert into public.menus(id,poster_id,menu_date,title,note) values
('00000000-0000-4000-8000-000000000001','user_a','2026-08-01','Menu cũ','{"dishes":[{"name":"Cơm gà","price":35000},{"name":"Rau","price":null}]}'),
('00000000-0000-4000-8000-000000000002','user_a','2026-08-01','Menu chữ','Món tự nhập'),
('00000000-0000-4000-8000-000000000003','user_a','2026-08-01','JSON lỗi cũ','{"dishes":[{"name":"Trùng"},{"name":"Trùng"}]}');
insert into public.orders(menu_id,user_id,item_text) values
('00000000-0000-4000-8000-000000000001','user_b',E'Cơm gà\nRau'),
('00000000-0000-4000-8000-000000000001','user_b','Tên không khớp'),
('00000000-0000-4000-8000-000000000002','user_b','Bún tùy chọn'),
('00000000-0000-4000-8000-000000000003','user_b','Trùng');
update public.menus set is_closed=true;
