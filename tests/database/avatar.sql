-- Avatar isolation and provisioning contract. Runs after the shared test helpers.
reset role;
select public.test_assert((select avatar_mode='auto' and provider_has_image is null and uploaded_avatar_path is null from public.profiles where id='user_b'),'existing profile defaults retain legacy provider eligibility');
select public.test_assert((select public and file_size_limit=2097152 and allowed_mime_types=array['image/jpeg','image/png','image/webp'] from storage.buckets where id='avatars'),'avatar bucket restricts size and MIME');

set role authenticated;
set request.jwt.claims='{"sub":"user_a","role":"authenticated"}';
select public.ensure_avatar_preferences('fox');
select public.ensure_avatar_preferences('cat');
select public.test_assert((select mascot_id='fox' from public.profiles where id='user_a'),'repeated provisioning never changes assigned mascot');
update public.profiles set avatar_mode='mascot',mascot_id='otter' where id='user_a';
insert into public.profiles(id,full_name,avatar_url,provider_has_image)
values('user_a','Google name','provider.jpg',true)
on conflict(id) do update set full_name=excluded.full_name,avatar_url=excluded.avatar_url,provider_has_image=excluded.provider_has_image;
select public.ensure_avatar_preferences('panda');
select public.test_assert((select avatar_mode='mascot' and mascot_id='otter' and avatar_url='provider.jpg' from public.profiles where id='user_a'),'provider sync and default RPC preserve member choice');
update public.profiles set avatar_mode='mascot',mascot_id='chef' where id='user_b';
select public.test_assert((select avatar_mode='auto' and mascot_id is null from public.profiles where id='user_b'),'A cannot change B avatar');
select public.test_rejected($test$update public.profiles set uploaded_avatar_path='user_b/other.webp',avatar_mode='upload' where id='user_a'$test$);
select public.test_rejected($test$update public.profiles set uploaded_avatar_path='user_a/../other.webp' where id='user_a'$test$);
select public.test_rejected($test$update public.profiles set avatar_mode='upload',uploaded_avatar_path=null where id='user_a'$test$);
select public.test_rejected($test$update public.profiles set mascot_id='unknown' where id='user_a'$test$);
insert into storage.objects(bucket_id,name) values ('avatars','user_a/old.webp'),('avatars','user_a/new.webp');
select public.test_rejected($test$insert into storage.objects(bucket_id,name) values('avatars','user_b/attack.webp')$test$);
select public.test_rejected($test$insert into storage.objects(bucket_id,name) values('avatars','user_a/payload.svg')$test$);
update public.profiles set avatar_mode='upload',uploaded_avatar_path='user_a/old.webp' where id='user_a';
delete from storage.objects where bucket_id='avatars' and name='user_a/old.webp';
select public.test_assert((select count(*)=1 from storage.objects where bucket_id='avatars' and name='user_a/old.webp'),'referenced avatar cannot be deleted');
update public.profiles set avatar_mode='mascot' where id='user_a';
delete from storage.objects where bucket_id='avatars' and name='user_a/old.webp';
select public.test_assert((select count(*)=1 from storage.objects where bucket_id='avatars' and name='user_a/old.webp'),'switch to mascot retains saved upload');
update public.profiles set avatar_mode='upload',uploaded_avatar_path='user_a/new.webp' where id='user_a';
delete from storage.objects where bucket_id='avatars' and name='user_a/old.webp';
select public.test_assert((select count(*)=0 from storage.objects where bucket_id='avatars' and name='user_a/old.webp'),'old avatar deletable only after successful replacement');
set request.jwt.claims='{"sub":"user_b","role":"authenticated"}';
delete from storage.objects where bucket_id='avatars' and name='user_a/new.webp';
update storage.objects set name='user_b/stolen.webp' where bucket_id='avatars' and name='user_a/new.webp';
set request.jwt.claims='{"sub":"user_a","role":"authenticated"}';
select public.ensure_avatar_preferences('bunny');
select public.test_assert((select avatar_mode='upload' and uploaded_avatar_path='user_a/new.webp' and mascot_id='otter' from public.profiles where id='user_a'),'upload and mascot persist across another login');
select public.test_assert((select count(*)=1 from storage.objects where bucket_id='avatars' and name='user_a/new.webp'),'B cannot delete or overwrite A avatar');
set role anon;
select public.test_rejected($test$select public.ensure_avatar_preferences('fox')$test$);
select public.test_rejected($test$insert into storage.objects(bucket_id,name) values('avatars','user_a/anon.webp')$test$);
reset role;
