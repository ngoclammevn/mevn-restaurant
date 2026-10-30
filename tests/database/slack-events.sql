-- Runs only against the isolated local harness after domain migrations.
set role authenticated;
set request.jwt.claims='{"sub":"user_a","role":"authenticated"}';
select id as slack_menu_a from public.save_lunch_menu(p_title=>'Slack A',p_menu_date=>current_date,p_note=>'Cơm') \gset
select id as slack_event_a from public.enqueue_lunch_notification(:'slack_menu_a','published',1,'offline') \gset
select id as slack_event_a_repeat from public.enqueue_lunch_notification(:'slack_menu_a','published',1,'offline') \gset
select public.test_assert(:'slack_event_a'=:'slack_event_a_repeat','same revision enqueues one event');
select claim_nonce as slack_nonce from public.claim_lunch_notification(:'slack_event_a') \gset
select public.test_assert((select claim_nonce is null from public.claim_lunch_notification(:'slack_event_a')),'second claim has no nonce');
select public.test_rejected(format('select public.finish_lunch_notification(%L,''00000000-0000-4000-8000-000000000099'',''sent'',''{}'')',:'slack_event_a'));
select id as slack_thread_a,claim_nonce as slack_thread_nonce from public.claim_lunch_daily_thread('offline','T0123456789',current_date,'C0123456789') \gset
set request.jwt.claims='{"sub":"user_b","role":"authenticated"}';
select id as slack_menu_b from public.save_lunch_menu(p_title=>'Slack B',p_menu_date=>current_date,p_note=>'Bún') \gset
select public.test_assert((select id=:'slack_thread_a'::uuid and claim_nonce is null from public.claim_lunch_daily_thread('offline','T0123456789',current_date,'C0123456789')),'two posters share one daily lease');
select public.test_rejected(format('select public.finish_lunch_notification(%L,%L,''sent'',''{}'')',:'slack_event_a',:'slack_nonce'));
select public.test_rejected(format('select public.enqueue_lunch_notification(%L,''received'',1,''offline'')',:'slack_menu_a'));
select public.test_rejected('insert into public.slack_profile_links(user_id,workspace_id,slack_user_id) values(''user_a'',''T0123456789'',''U0123456789'')');
select public.link_lunch_slack_account('T0123456789','U0123456789');
set request.jwt.claims='{"sub":"user_a","role":"authenticated"}';
select public.finish_lunch_notification(:'slack_event_a',:'slack_nonce','sent','{"payload":{"ts":"123.456"},"signature":"fake"}');
select public.test_assert((select status='sent' and claim_nonce is null from public.slack_notifications where id=:'slack_event_a'),'finish closes the active nonce');
select public.test_rejected(format('select public.finish_lunch_notification(%L,%L,''sent'',''{}'')',:'slack_event_a',:'slack_nonce'));
select public.test_assert((select id<>:'slack_event_a'::uuid from public.enqueue_lunch_notification(:'slack_menu_a','published',2,'offline')),'new revision has distinct event');
select public.test_assert((select id<>:'slack_event_a'::uuid from public.enqueue_lunch_notification(:'slack_menu_a','published',1,'preview')),'namespace isolates event');
select public.test_assert((select not (to_jsonb(e)::text ~ 'phone|payment_info|token') from public.slack_notifications e where id=:'slack_event_a'),'registry contains no private fields');
select public.test_rejected(format('select public.set_lunch_reminder(%L,clock_timestamp()-interval ''1 minute'')',:'slack_menu_a'));
select id as slack_unknown_event from public.enqueue_lunch_notification(:'slack_menu_a','shared',1,'offline') \gset
select claim_nonce from public.claim_lunch_notification(:'slack_unknown_event');
reset role;
update public.slack_notifications set lease_until=clock_timestamp()-interval '1 second' where id=:'slack_unknown_event';
set role authenticated;
set request.jwt.claims='{"sub":"user_a","role":"authenticated"}';
select public.test_assert((select status='unknown' and claim_nonce is null from public.claim_lunch_notification(:'slack_unknown_event')),'expired sending lease becomes unknown rather than retry');
select public.test_assert((select status='retryable' from public.resolve_lunch_notification(:'slack_unknown_event','not_sent')),'explicit operator confirmation enables retry');
set role anon;
select public.test_rejected('select * from public.slack_profile_links');
select public.test_rejected('select public.enqueue_lunch_notification(''00000000-0000-4000-8000-000000000001'',''published'',1,''offline'')');
reset role;
