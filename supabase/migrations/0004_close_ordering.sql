-- Migration 0004: Chốt đơn — poster khoá nhận món (thêm/sửa/xoá) cho một menu
-- Idempotent theo phong cách 0003 — an toàn chạy lại nhiều lần

alter table menus add column if not exists is_closed boolean not null default false;

do $$ begin
  drop policy if exists orders_insert on orders;
  drop policy if exists orders_update on orders;
  drop policy if exists orders_delete on orders;
end $$;

-- Đặt món (kể cả đặt hộ) chỉ được phép khi menu chưa bị poster chốt
create policy orders_insert on orders for insert to authenticated
  with check (
    exists (select 1 from menus m where m.id = menu_id and not m.is_closed)
  );

-- Sửa đơn của chính mình (is_paid vẫn sửa được kể cả khi đã chốt — xem trigger bên dưới
-- chặn riêng item_text/note)
create policy orders_update on orders for update to authenticated
  using (user_id = (select auth.jwt()->>'sub'))
  with check (user_id = (select auth.jwt()->>'sub'));

-- Xoá đơn của chính mình chỉ được phép khi menu chưa bị chốt
create policy orders_delete on orders for delete to authenticated
  using (
    user_id = (select auth.jwt()->>'sub')
    and exists (select 1 from menus m where m.id = orders.menu_id and not m.is_closed)
  );

-- Chặn riêng việc sửa nội dung món (item_text/note) khi menu đã chốt, KHÔNG chặn is_paid/paid_at
-- (đánh dấu đã thanh toán thường diễn ra sau khi chốt đơn nên phải luôn cho phép)
create or replace function orders_block_edit_when_closed()
returns trigger
language plpgsql
as $$
begin
  if (new.item_text is distinct from old.item_text or new.note is distinct from old.note)
     and exists (select 1 from menus m where m.id = old.menu_id and m.is_closed) then
    raise exception 'Đơn đã chốt, không thể sửa món.';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_block_edit_when_closed_trg on orders;
create trigger orders_block_edit_when_closed_trg
  before update on orders
  for each row execute function orders_block_edit_when_closed();
