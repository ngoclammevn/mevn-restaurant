-- Personal avatar preferences. Provider photo remains in avatar_url.
alter table public.profiles
  add column if not exists avatar_mode text not null default 'auto',
  add column if not exists mascot_id text,
  add column if not exists uploaded_avatar_path text,
  add column if not exists provider_has_image boolean;

alter table public.profiles
  add constraint profiles_avatar_mode_check check (avatar_mode in ('auto', 'mascot', 'upload')),
  add constraint profiles_mascot_id_check check (mascot_id is null or mascot_id in ('fox','cat','bunny','panda','penguin','otter','robot','chef')),
  add constraint profiles_avatar_path_check check (
    uploaded_avatar_path is null or (
      split_part(uploaded_avatar_path, '/', 1) = id
      and uploaded_avatar_path !~ '(^|/)\.\.?(/|$)'
      and split_part(uploaded_avatar_path, '/', 2) ~ '^[a-zA-Z0-9_-]+\.(webp|jpe?g|png)$'
      and array_length(string_to_array(uploaded_avatar_path, '/'), 1) = 2
    )
  ),
  add constraint profiles_avatar_upload_required check (avatar_mode <> 'upload' or uploaded_avatar_path is not null);

create or replace function public.ensure_avatar_preferences(p_default_mascot_id text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if nullif(auth.jwt()->>'sub', '') is null then raise exception 'Not authenticated'; end if;
  if p_default_mascot_id is null or p_default_mascot_id not in ('fox','cat','bunny','panda','penguin','otter','robot','chef') then
    raise exception 'Invalid mascot';
  end if;
  update public.profiles set mascot_id = p_default_mascot_id
  where id = auth.jwt()->>'sub' and mascot_id is null;
end;
$$;
revoke all on function public.ensure_avatar_preferences(text) from public, anon;
grant execute on function public.ensure_avatar_preferences(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars','avatars',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "avatar upload own folder" on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  and array_length(string_to_array(name, '/'), 1) = 2
  and split_part(name, '/', 2) ~ '^[a-zA-Z0-9_-]+\.(webp|jpe?g|png)$'
);
-- Public image serving uses the public bucket URL; private object listing stays own-folder only.
create policy "avatar read own folder" on storage.objects for select to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
);
create policy "avatar delete own unreferenced" on storage.objects for delete to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  and not exists (select 1 from public.profiles where uploaded_avatar_path = name)
);
-- No UPDATE policy: uploads use unique names and cannot overwrite other objects.
