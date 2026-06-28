-- Create the menus bucket if it does not exist
insert into storage.buckets (id, name, public)
values ('menus', 'menus', true)
on conflict (id) do nothing;

-- RLS policies on storage.objects
create policy "menu upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'menus'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );

create policy "menu read access" on storage.objects
  for select to authenticated
  using (bucket_id = 'menus');

create policy "menu delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'menus'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );
