create policy "menu upload own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'menus'
    and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  );
