import {pathToFileURL,fileURLToPath} from 'node:url'
const runtime=process.env.LUNCH_PG_RUNTIME
if(!runtime)throw new Error('Set LUNCH_PG_RUNTIME to the absolute embedded-postgres package directory; see tests/database/README.md')
const {default:EmbeddedPostgres}=await import(pathToFileURL(join(runtime,'dist/index.js')).href)
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import assert from 'node:assert/strict'
const root=fileURLToPath(new URL('../../',import.meta.url))
const temporary=await mkdtemp(join(tmpdir(),'lunch-native-')),socket=join(temporary,'socket')
await mkdir(socket,{mode:0o700})
const logs=[]
const server=new EmbeddedPostgres({databaseDir:join(temporary,'data'),port:55448,user:'postgres',password:'local-test-only',persistent:false,initdbFlags:['--no-locale','-E','UTF8'],postgresFlags:['-h','','-k',socket,'-c','deadlock_timeout=100ms'],onLog:message=>logs.push(String(message)),onError:message=>logs.push(String(message))})
let admin
const clients=[]
try{
  await server.initialise();await server.start()
  admin=server.getPgClient('postgres',socket);await admin.connect()
  const runner=await readFile(join(root,'tests/database/run-embedded.mjs'),'utf8')
  const source=runner.slice(runner.indexOf('function commands('),runner.indexOf('\nconst db = new PGlite()'))
  const commands=Function(source+'; return commands')()
  const variables={};let assertions=0,rejected=0
  async function run(relative){
    const content=await readFile(join(root,relative),'utf8')
    for(const command of commands(content)){
      const sql=command.sql.replace(/:'([a-zA-Z_0-9]+)'/g,(_,name)=>{
        if(!(name in variables))throw new Error('Unknown fixture variable '+name)
        return "'"+String(variables[name]).replaceAll("'","''")+"'"
      })
      try{
        const result=await admin.query(sql)
        if(command.gset){if(result.rows?.length!==1)throw new Error('Fixture needs one row');Object.assign(variables,result.rows[0])}
        if(/^select public\.test_assert\(/.test(sql))assertions++
        if(/^select public\.test_rejected\(/.test(sql))rejected++
      }catch(error){throw new Error(relative+': '+sql.slice(0,140)+' => '+error.message)}
    }
  }
  await run('tests/database/bootstrap.sql')
  for(const migration of ['0001_schema_rls.sql','0002_storage.sql','0003_prod_safe.sql','0004_close_ordering.sql'])await run('supabase/migrations/'+migration)
  await run('tests/database/legacy.sql')
  await run('supabase/migrations/20261003070000_close_ordering_compat.sql')
  await run('supabase/migrations/20261003080019_lunch_catalog_reviews.sql')
  await run('tests/database/legacy-domain-before.sql')
  for(const migration of ['20261029144827_lunch_personal_avatars.sql','20261029145057_lunch_pickup_contacts.sql','20261029145105_lunch_sponsorship_and_finance.sql','20261029145108_lunch_close_and_pickup.sql','20261029145252_lunch_slack_events.sql'])await run('supabase/migrations/'+migration)
  for(const fixture of ['checks.sql','pickup.sql','finance.sql','close-pickup.sql','avatar.sql','slack-events.sql','review-fixes.sql'])await run('tests/database/'+fixture)
  console.log('Native PostgreSQL fixtures:',assertions,'assertions,',rejected,'rejected writes passed')
  async function connect(subject){
    const client=server.getPgClient('postgres',socket);clients.push(client);await client.connect()
    await client.query("SET statement_timeout='8s'")
    await client.query('SET ROLE authenticated')
    await client.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:subject,role:'authenticated'})])
    return client
  }
  const a=await connect('user_a'),b=await connect('user_b'),a2=await connect('user_a')
  const today=(await admin.query("select to_char(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD') as day")).rows[0].day
  async function preferences(client,date,phone){await client.query('select public.save_pickup_preferences($1,true,$2)',[date,phone])}
  await preferences(a,today,'+84901234567');await preferences(b,today,'+84987654321')
  async function seed(client,date=today){
    const menu=(await client.query("select (public.save_lunch_menu(p_title=>'Concurrency fixture',p_menu_date=>$1,p_note=>'Món nhập tay')).id as id",[date])).rows[0].id
    await client.query("insert into public.orders(menu_id,user_id,item_text) values($1,auth.jwt()->>'sub','Cơm')",[menu])
    return menu
  }
  async function waitForEvent(pid,event){
    for(let attempt=0;attempt<100;attempt++){
      const row=(await admin.query('select wait_event,wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]
      if(event(row))return
      await new Promise(resolve=>setTimeout(resolve,10))
    }
    throw new Error('Concurrent operation did not reach expected wait state')
  }
  const first=await seed(a)
  await b.query('BEGIN')
  await b.query("insert into public.orders(menu_id,user_id,item_text) values($1,'user_b','Bún')",[first])
  const closing=a.query('select public.close_lunch_menu($1,0,$2,null,false) as result',[first,'user_b'])
  await waitForEvent(a.processID,row=>row?.wait_event_type==='Lock')
  await b.query('COMMIT')
  const closed=(await closing).rows[0].result
  assert.equal(Number((await admin.query('select count(*) from public.closure_items where closure_id=$1',[closed.closure_id])).rows[0].count),2)
  console.log('Concurrency PASS: committed order is included when close waits')
  const second=await seed(a)
  const duplicate=await Promise.allSettled([a.query('select public.close_lunch_menu($1,0,$2,null,false)',[second,'user_a']),a2.query('select public.close_lunch_menu($1,0,$2,null,false)',[second,'user_a'])])
  assert.equal(duplicate.filter(result=>result.status==='fulfilled').length,1)
  assert.equal(Number((await admin.query('select count(*) from public.menu_closures where menu_id=$1',[second])).rows[0].count),1)
  console.log('Concurrency PASS: duplicate close creates one revision')
  const future=(await admin.query("select to_char((clock_timestamp()+interval '10 minutes') at time zone 'Asia/Ho_Chi_Minh','YYYY-MM-DD') as day,(clock_timestamp()+interval '10 minutes')::text as at")).rows[0]
  await preferences(a,future.day,'+84901234567')
  const third=await seed(a,future.day)
  await admin.query("create function public.test_pause_menu_write() returns trigger language plpgsql as $$ begin if current_setting('lunch.pause_menu_write',true)='on' then perform pg_sleep(0.2); end if; return null; end $$")
  await admin.query('create trigger a_test_pause_menu_write before update on public.menus for each statement execute function public.test_pause_menu_write()')
  await a2.query("set lunch.pause_menu_write='on'")
  const reminding=a2.query('select public.set_lunch_reminder($1,$2)',[third,future.at])
  await waitForEvent(a2.processID,row=>row?.wait_event==='PgSleep')
  const closingReminder=a.query('select public.close_lunch_menu($1,0,$2,null,false)',[third,'user_a'])
  await Promise.all([reminding,closingReminder])
  await a2.query("set lunch.pause_menu_write='off'")
  await admin.query('drop trigger a_test_pause_menu_write on public.menus;drop function public.test_pause_menu_write()')
  console.log('Concurrency PASS: reminder and close use consistent lock order')
  const fourth=await seed(a)
  const event=(await a.query("select (public.enqueue_lunch_notification($1,'published',1,'concurrency')).id as id",[fourth])).rows[0].id
  const claims=await Promise.all([a.query('select * from public.claim_lunch_notification($1)',[event]),a2.query('select * from public.claim_lunch_notification($1)',[event])])
  assert.equal(claims.filter(result=>result.rows[0]?.claim_nonce).length,1)
  console.log('Concurrency PASS: duplicate Slack claim has one lease')
  await seed(b)
  const threads=await Promise.all([a.query("select * from public.claim_lunch_daily_thread('concurrency','T0123456789',$1,'C0123456789')",[today]),b.query("select * from public.claim_lunch_daily_thread('concurrency','T0123456789',$1,'C0123456789')",[today])])
  assert.equal(threads[0].rows[0].id,threads[1].rows[0].id)
  assert.equal(threads.filter(result=>result.rows[0]?.claim_nonce).length,1)
  console.log('Concurrency PASS: two posters share one daily thread lease')
}catch(error){console.error(error);if(!admin)console.error(logs.join('').slice(-4000));process.exitCode=1}
finally{
  for(const client of clients)await client.end().catch(()=>{})
  await admin?.end().catch(()=>{})
  await server.stop().catch(()=>{})
  await rm(temporary,{recursive:true,force:true})
}
