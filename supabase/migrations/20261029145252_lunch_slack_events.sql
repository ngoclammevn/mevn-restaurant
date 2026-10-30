-- No machine credentials: all operations run with the caller's Clerk JWT and RLS.
alter table public.menus add column reminder_at timestamptz, add column reminder_version integer not null default 0;
create table public.slack_profile_links (
 user_id text not null references public.profiles(id),workspace_id text not null check(workspace_id ~ '^T[A-Z0-9]{8,20}$'),
 slack_user_id text not null check(slack_user_id ~ '^[UW][A-Z0-9]{8,20}$'),primary key(user_id,workspace_id),unique(workspace_id,slack_user_id)
);
alter table public.slack_profile_links enable row level security;
create policy slack_links_read on public.slack_profile_links for select to authenticated using(true);
create policy slack_links_insert on public.slack_profile_links for insert to authenticated with check(user_id=(select auth.jwt()->>'sub'));
create policy slack_links_update on public.slack_profile_links for update to authenticated using(user_id=(select auth.jwt()->>'sub')) with check(user_id=(select auth.jwt()->>'sub'));
create table public.slack_notifications (
 id uuid primary key default gen_random_uuid(),menu_id uuid not null references public.menus(id) on delete cascade,
 namespace text not null check(namespace ~ '^[a-z0-9][a-z0-9_-]{0,47}$'),
 kind text not null check(kind in ('published','shared','closed','reopened','pickup_changed','received','reminder_schedule','reminder_cancel')),
 revision integer not null check(revision>=0),status text not null default 'pending' check(status in ('pending','sending','sent','retryable','unknown','cancel_pending','cancelled')),
 claim_nonce uuid,lease_until timestamptz,receipt jsonb,last_error_code text,next_attempt_at timestamptz,
 unique(namespace,menu_id,kind,revision),check(receipt is null or octet_length(receipt::text)<=8192)
);
create table public.slack_daily_threads (
 id uuid primary key default gen_random_uuid(),namespace text not null check(namespace ~ '^[a-z0-9][a-z0-9_-]{0,47}$'),workspace_id text not null,
 menu_date date not null,channel_id text not null,thread_ts text,receipt jsonb,claim_nonce uuid,lease_until timestamptz,
 status text not null default 'pending' check(status in ('pending','sending','sent','retryable','unknown')),next_attempt_at timestamptz,
 unique(namespace,workspace_id,menu_date,channel_id),check(receipt is null or octet_length(receipt::text)<=8192)
);
create function public.can_manage_lunch_notification(p_menu_id uuid,p_kind text) returns boolean language sql stable security invoker set search_path=public,pg_temp as $$
 select exists(select 1 from public.menus m where m.id=p_menu_id and (m.poster_id=(select auth.jwt()->>'sub') or (p_kind='received' and exists(select 1 from public.menu_pickups p where p.menu_id=m.id and p.closure_id=m.current_closure_id and p.primary_user_id=(select auth.jwt()->>'sub')))))
$$;
alter table public.slack_notifications enable row level security;
create policy slack_events_read on public.slack_notifications for select to authenticated using(public.can_manage_lunch_notification(menu_id,kind));
create policy slack_events_insert on public.slack_notifications for insert to authenticated with check(public.can_manage_lunch_notification(menu_id,kind));
create policy slack_events_update on public.slack_notifications for update to authenticated using(public.can_manage_lunch_notification(menu_id,kind)) with check(public.can_manage_lunch_notification(menu_id,kind));
alter table public.slack_daily_threads enable row level security;
create policy slack_threads_read on public.slack_daily_threads for select to authenticated using(exists(select 1 from public.menus m where m.menu_date=slack_daily_threads.menu_date and m.poster_id=(select auth.jwt()->>'sub')));
create policy slack_threads_insert on public.slack_daily_threads for insert to authenticated with check(exists(select 1 from public.menus m where m.menu_date=slack_daily_threads.menu_date and m.poster_id=(select auth.jwt()->>'sub')));
create policy slack_threads_update on public.slack_daily_threads for update to authenticated using(exists(select 1 from public.menus m where m.menu_date=slack_daily_threads.menu_date and m.poster_id=(select auth.jwt()->>'sub'))) with check(exists(select 1 from public.menus m where m.menu_date=slack_daily_threads.menu_date and m.poster_id=(select auth.jwt()->>'sub')));
grant select,insert,update on public.slack_profile_links,public.slack_notifications,public.slack_daily_threads to authenticated;
revoke all on public.slack_profile_links,public.slack_notifications,public.slack_daily_threads from anon;
create function public.enqueue_lunch_notification(p_menu_id uuid,p_kind text,p_revision integer,p_namespace text) returns public.slack_notifications language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.slack_notifications;
begin
 if not public.can_manage_lunch_notification(p_menu_id,p_kind) then raise exception 'forbidden'; end if;
 insert into public.slack_notifications(menu_id,kind,revision,namespace) values(p_menu_id,p_kind,p_revision,p_namespace) on conflict(namespace,menu_id,kind,revision) do nothing;
 select * into strict e from public.slack_notifications where menu_id=p_menu_id and kind=p_kind and revision=p_revision and namespace=p_namespace;
 return e;
end $$;
create function public.claim_lunch_notification(p_event_id uuid) returns public.slack_notifications language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.slack_notifications;
begin
 select * into strict e from public.slack_notifications where id=p_event_id for update;
 if not public.can_manage_lunch_notification(e.menu_id,e.kind) then raise exception 'forbidden'; end if;
 if e.status='sending' and e.lease_until<=clock_timestamp() then update public.slack_notifications set status='unknown',claim_nonce=null where id=e.id returning * into e;return e;end if;
 if e.status in ('pending','retryable','cancel_pending') and (e.next_attempt_at is null or e.next_attempt_at<=clock_timestamp()) then
 update public.slack_notifications set status='sending',claim_nonce=gen_random_uuid(),lease_until=clock_timestamp()+interval '30 seconds' where id=e.id returning * into e;
 else e.claim_nonce=null;
 end if;
 return e;
end $$;
create function public.finish_lunch_notification(p_event_id uuid,p_claim_nonce uuid,p_status text,p_receipt jsonb default null,p_error_code text default null,p_retry_after integer default null) returns public.slack_notifications language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.slack_notifications;
begin
 if p_status not in ('sent','retryable','unknown','cancel_pending','cancelled') then raise exception 'invalid_status';end if;
 update public.slack_notifications set status=p_status,receipt=coalesce(p_receipt,receipt),last_error_code=left(p_error_code,80),next_attempt_at=case when p_retry_after is null then null else clock_timestamp()+make_interval(secs=>greatest(1,least(3600,p_retry_after))) end,claim_nonce=null,lease_until=null
 where id=p_event_id and status='sending' and claim_nonce=p_claim_nonce and lease_until>clock_timestamp() and public.can_manage_lunch_notification(menu_id,kind) returning * into e;
 if e.id is null then raise exception 'stale_claim';end if; return e;
end $$;
create function public.resolve_lunch_notification(p_event_id uuid,p_resolution text) returns public.slack_notifications language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.slack_notifications;
begin
 if p_resolution not in ('sent','not_sent') then raise exception 'invalid_resolution';end if;
 update public.slack_notifications set status=case when p_resolution='sent' then 'cancelled' else 'retryable' end,claim_nonce=null,lease_until=null,last_error_code=case when p_resolution='sent' then 'operator_confirmed_sent' else 'operator_confirmed_not_sent' end
 where id=p_event_id and status='unknown' and exists(select 1 from public.menus m where m.id=menu_id and m.poster_id=(select auth.jwt()->>'sub')) returning * into e;
 if e.id is null then raise exception 'forbidden';end if;return e;
end $$;
-- A shared per-day lease prevents concurrent posters creating two roots.
create function public.claim_lunch_daily_thread(p_namespace text,p_workspace_id text,p_menu_date date,p_channel_id text) returns public.slack_daily_threads language plpgsql security invoker set search_path=public,pg_temp as $$
declare t public.slack_daily_threads;
begin
 insert into public.slack_daily_threads(namespace,workspace_id,menu_date,channel_id) values(p_namespace,p_workspace_id,p_menu_date,p_channel_id) on conflict(namespace,workspace_id,menu_date,channel_id) do nothing;
 select * into strict t from public.slack_daily_threads where namespace=p_namespace and workspace_id=p_workspace_id and menu_date=p_menu_date and channel_id=p_channel_id for update;
 if t.status='sending' and t.lease_until<=clock_timestamp() then update public.slack_daily_threads set status='unknown',claim_nonce=null where id=t.id returning * into t;return t;end if;
 if t.status in ('pending','retryable') and (t.next_attempt_at is null or t.next_attempt_at<=clock_timestamp()) then update public.slack_daily_threads set status='sending',claim_nonce=gen_random_uuid(),lease_until=clock_timestamp()+interval '30 seconds' where id=t.id returning * into t;else t.claim_nonce=null;end if;
 return t;
end $$;
create function public.finish_lunch_daily_thread(p_thread_id uuid,p_claim_nonce uuid,p_status text,p_receipt jsonb default null,p_retry_after integer default null) returns public.slack_daily_threads language plpgsql security invoker set search_path=public,pg_temp as $$
declare t public.slack_daily_threads;
begin
 if p_status not in ('sent','retryable','unknown') then raise exception 'invalid_status';end if;
 update public.slack_daily_threads set status=p_status,next_attempt_at=case when p_retry_after is null then null else clock_timestamp()+make_interval(secs=>greatest(1,least(3600,p_retry_after))) end,receipt=p_receipt,thread_ts=p_receipt->'payload'->>'ts',claim_nonce=null,lease_until=null where id=p_thread_id and status='sending' and claim_nonce=p_claim_nonce and lease_until>clock_timestamp() returning * into t;
 if t.id is null then raise exception 'stale_claim';end if;return t;
end $$;
create function public.set_lunch_reminder(p_menu_id uuid,p_at timestamptz default null) returns public.menus language plpgsql security invoker set search_path=public,pg_temp as $$
declare m public.menus;
begin
 perform pg_advisory_xact_lock(hashtextextended('lunch_domain_write',0));
 select * into strict m from public.menus where id=p_menu_id for update;
 if m.poster_id is distinct from (select auth.jwt()->>'sub') or (p_at is not null and (m.is_closed or p_at<=clock_timestamp() or (p_at at time zone 'Asia/Ho_Chi_Minh')::date<>m.menu_date)) then raise exception 'invalid_reminder';end if;
 update public.menus set reminder_at=p_at,reminder_version=reminder_version+1 where id=m.id returning * into m;return m;
end $$;
-- Explicit grants: Postgres otherwise gives EXECUTE to PUBLIC by default.
revoke execute on function public.can_manage_lunch_notification(uuid,text),public.enqueue_lunch_notification(uuid,text,integer,text),public.claim_lunch_notification(uuid),public.finish_lunch_notification(uuid,uuid,text,jsonb,text,integer),public.resolve_lunch_notification(uuid,text),public.claim_lunch_daily_thread(text,text,date,text),public.finish_lunch_daily_thread(uuid,uuid,text,jsonb,integer),public.set_lunch_reminder(uuid,timestamptz) from public,anon;
grant execute on function public.can_manage_lunch_notification(uuid,text),public.enqueue_lunch_notification(uuid,text,integer,text),public.claim_lunch_notification(uuid),public.finish_lunch_notification(uuid,uuid,text,jsonb,text,integer),public.resolve_lunch_notification(uuid,text),public.claim_lunch_daily_thread(text,text,date,text),public.finish_lunch_daily_thread(uuid,uuid,text,jsonb,integer),public.set_lunch_reminder(uuid,timestamptz) to authenticated;

create function public.link_lunch_slack_account(p_workspace_id text,p_slack_user_id text) returns void language sql security invoker set search_path=public,pg_temp as $$
 insert into public.slack_profile_links(user_id,workspace_id,slack_user_id) values((select auth.jwt()->>'sub'),p_workspace_id,p_slack_user_id) on conflict(user_id,workspace_id) do update set slack_user_id=excluded.slack_user_id;
$$;
create function public.mark_lunch_schedule_cancelled(p_event_id uuid,p_cancelled boolean) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 update public.slack_notifications set status=case when p_cancelled then 'cancelled' else 'cancel_pending' end where id=p_event_id and kind='reminder_schedule' and public.can_manage_lunch_notification(menu_id,'reminder_schedule');
 if not found then raise exception 'forbidden';end if;
end $$;
revoke execute on function public.link_lunch_slack_account(text,text),public.mark_lunch_schedule_cancelled(uuid,boolean) from public,anon;
grant execute on function public.link_lunch_slack_account(text,text),public.mark_lunch_schedule_cancelled(uuid,boolean) to authenticated;
drop policy slack_threads_read on public.slack_daily_threads;
create policy slack_threads_read on public.slack_daily_threads for select to authenticated using(exists(select 1 from public.menus m where m.menu_date=slack_daily_threads.menu_date and (m.poster_id=(select auth.jwt()->>'sub') or exists(select 1 from public.menu_pickups p where p.menu_id=m.id and p.closure_id=m.current_closure_id and p.primary_user_id=(select auth.jwt()->>'sub')))));

-- Explicit human confirmation may release an unknown daily-root attempt; a timestamp is never accepted from the browser.
create function public.resolve_lunch_daily_thread(p_menu_id uuid,p_namespace text,p_workspace_id text,p_channel_id text) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare m public.menus;
begin
 select * into strict m from public.menus where id=p_menu_id and poster_id=(select auth.jwt()->>'sub');
 update public.slack_daily_threads set status='retryable',claim_nonce=null,lease_until=null,receipt=null,thread_ts=null where namespace=p_namespace and workspace_id=p_workspace_id and channel_id=p_channel_id and menu_date=m.menu_date and status='unknown';
end $$;
revoke execute on function public.resolve_lunch_daily_thread(uuid,text,text,text) from public,anon;
grant execute on function public.resolve_lunch_daily_thread(uuid,text,text,text) to authenticated;

create function public.invalidate_lunch_notification(p_event_id uuid) returns void language sql security invoker set search_path=public,pg_temp as $$
 update public.slack_notifications set status='unknown',claim_nonce=null,lease_until=null,last_error_code='invalid_receipt' where id=p_event_id and status='sent' and public.can_manage_lunch_notification(menu_id,kind);
$$;
create function public.invalidate_lunch_daily_thread(p_thread_id uuid) returns void language sql security invoker set search_path=public,pg_temp as $$
 update public.slack_daily_threads set status='unknown',claim_nonce=null,lease_until=null where id=p_thread_id and status='sent';
$$;
revoke execute on function public.invalidate_lunch_notification(uuid),public.invalidate_lunch_daily_thread(uuid) from public,anon;
grant execute on function public.invalidate_lunch_notification(uuid),public.invalidate_lunch_daily_thread(uuid) to authenticated;
