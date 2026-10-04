// Uses a disposable local PostgreSQL cluster, no network listener or production
// database. Set SITOV_QUOTA_POSTGRES_BIN when server tools are outside PATH.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bootstrap,user } from './helpers/sitov-storage-security-fixture.mjs'

const detected=spawnSync('pg_config',['--bindir'],{encoding:'utf8'}).stdout?.trim()
const bin=process.env.SITOV_QUOTA_POSTGRES_BIN||detected
const available=bin&&['postgres','initdb','pg_ctl','psql'].every(name=>existsSync(join(bin,name)))&&process.getuid?.()!==0
const migration=await readFile(new URL('../vps/79_sitov_storage_security_limits.sql',import.meta.url),'utf8')
function run(name,args,input=''){
 return new Promise((resolve,reject)=>{
  const child=spawn(join(bin,name),args,{stdio:['pipe','pipe','pipe']})
  let stdout='',stderr=''
  child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data)
  child.on('error',reject);child.on('close',code=>resolve({code,stdout:stdout.trim(),stderr:stderr.trim()}))
  child.stdin.end(input)
 })
}
test('real PostgreSQL serializes concurrent direct uploads, pending tickets and daily synthesis',{
 skip:available?false:'Local PostgreSQL server tools unavailable; PGlite quota tests still run',timeout:30000,
},async t=>{
 const root=await mkdtemp('/tmp/sitov-storage-quota-'),data=join(root,'data'),socket=join(root,'socket')
 let started=false
 try {
  await mkdir(socket)
  let result=await run('initdb',['-D',data,'-U','sitov_test_owner','-A','trust','--no-locale'])
  assert.equal(result.code,0,result.stderr)
  result=await run('pg_ctl',['-D',data,'-l',join(root,'server.log'),'-o',`-k ${socket} -h '' -p 65432`,'-w','start'])
  assert.equal(result.code,0,result.stderr);started=true
  const sql=query=>run('psql',['-XAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-h',socket,'-p','65432','-U','sitov_test_owner','-d','postgres'],query)
  const ok=async query=>{const value=await sql(query);assert.equal(value.code,0,value.stderr);return value.stdout}
  await ok(bootstrap+'BEGIN;'+migration+'COMMIT;')
  async function race(firstQuery,secondQuery){
   const first=sql(`SET application_name='sitov_quota_first'; BEGIN; ${firstQuery}; SELECT pg_sleep(0.5); COMMIT;`)
   let locked=false
   for(let attempt=0;attempt<30;attempt++){
    if(await ok("SELECT count(*) FROM pg_stat_activity WHERE application_name='sitov_quota_first' AND wait_event='PgSleep'")==='1'){locked=true;break}
    await new Promise(resolve=>setTimeout(resolve,10))
   }
   assert.equal(locked,true,'first quota transaction must hold its locks while second starts')
   const second=sql(secondQuery)
   const results=await Promise.all([first,second])
   assert.equal(results[0].code,0,results[0].stderr)
   assert.notEqual(results[1].code,0,'second concurrent write must be rejected')
   return results[1].stderr
  }
  await t.test('second direct upload rechecks the committed current counter, including under user RLS',async()=>{
   await ok("UPDATE sitov_storage_private.limits SET user_bytes=50 WHERE bucket_id='pronunciation_audio'")
   const error=await race(`SET LOCAL ROLE authenticated; INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('pronunciation_audio','${user}/one.webm','{"size":40}')`,
    `SET ROLE authenticated; INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('pronunciation_audio','${user}/two.webm','{"size":40}');`)
   assert.match(error,/PT413.*sitov_storage_quota_exceeded/)
   assert.equal(await ok("SELECT bytes||':'||objects FROM sitov_storage_private.usage WHERE scope='all'"),'40:1')
   assert.equal(await ok('SELECT count(*) FROM storage.objects'),'1')
  })
  await t.test('parallel URLs cannot both take the last pending slot',async()=>{
   const ticket=name=>`INSERT INTO sitov_exam_upload_tickets(path,student_id,kind,expected_bytes) VALUES('${user}/speaking/${name}.webm','${user}','speaking',10)`
   for(let i=0;i<9;i++)await ok(ticket(`old-${i}`))
   assert.match(await race(ticket('last'),ticket('over-limit')),/PT429.*sitov_pending_upload_limit/)
   assert.equal(await ok('SELECT count(*) FROM sitov_exam_upload_tickets'),'10')
   assert.equal(await ok(`SELECT objects FROM sitov_storage_private.daily WHERE scope='tickets:${user}'`),'10')
  })
  await t.test('parallel generations cannot both take the last daily reservation',async()=>{
   await ok(`SET ROLE service_role; SELECT public.sitov_reserve_audio_generation('${user}',1) FROM generate_series(1,99)`)
   const first=sql(`SET application_name='sitov_quota_first'; BEGIN; SET LOCAL ROLE service_role; SELECT public.sitov_reserve_audio_generation('${user}',1); SELECT pg_sleep(0.5); COMMIT;`)
   let ready=false
   for(let attempt=0;attempt<30;attempt++){
    if(await ok("SELECT count(*) FROM pg_stat_activity WHERE application_name='sitov_quota_first' AND wait_event='PgSleep'")==='1'){ready=true;break}
    await new Promise(resolve=>setTimeout(resolve,10))
   }
   assert.equal(ready,true)
   const second=sql(`SET ROLE service_role; SELECT public.sitov_reserve_audio_generation('${user}',1);`)
   const results=await Promise.all([first,second])
   assert.equal(results[0].code,0,results[0].stderr);assert.equal(results[1].code,0,results[1].stderr)
   assert.match(results[0].stdout,/\bt\b/);assert.equal(results[1].stdout.split('\n').at(-1),'f')
   assert.equal(await ok("SELECT objects FROM sitov_storage_private.daily WHERE scope='synthesis:all'"),'100')
  })
 } finally {
  if(started)await run('pg_ctl',['-D',data,'-m','immediate','-w','stop'])
  await rm(root,{recursive:true,force:true})
 }
})
