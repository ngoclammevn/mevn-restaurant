-- Menu order deadlines are optional. Existing menus remain open by default.
alter table public.menus
  add column if not exists order_deadline timestamptz;

-- RLS continues to decide who may mutate an order. This trigger adds the
-- time-based rule so direct client calls cannot bypass a closed menu.
create or replace function public.enforce_order_deadline()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_menu_id uuid;
  deadline timestamptz;
begin
  if tg_op = 'UPDATE' then
    if new.menu_id is distinct from old.menu_id
      or new.user_id is distinct from old.user_id then
      raise exception using message = 'ORDER_FIELDS_IMMUTABLE';
    end if;

    -- Once a menu is closed, payment state and its edit timestamp may still
    -- change. Every other persisted order field remains content and is gated
    -- by the deadline below.
    if new.id is not distinct from old.id
      and new.menu_id is not distinct from old.menu_id
      and new.user_id is not distinct from old.user_id
      and new.item_text is not distinct from old.item_text
      and new.note is not distinct from old.note
      and new.created_at is not distinct from old.created_at then
      return new;
    end if;
  end if;

  target_menu_id := case
    when tg_op = 'DELETE' then old.menu_id
    else new.menu_id
  end;

  select order_deadline
    into deadline
    from public.menus
   where id = target_menu_id;

  if deadline is not null and now() >= deadline then
    raise exception using message = 'ORDER_DEADLINE_PASSED';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_enforce_order_deadline on public.orders;

create trigger orders_enforce_order_deadline
before insert or update or delete on public.orders
for each row execute function public.enforce_order_deadline();
