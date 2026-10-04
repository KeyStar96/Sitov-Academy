import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {user,other,bootstrap} from './helpers/sitov-storage-security-fixture.mjs'

const migration = await readFile(new URL('../vps/79_sitov_storage_security_limits.sql', import.meta.url), 'utf8')
async function database(seed = '') {
 const db = new PGlite()
 await db.exec(bootstrap + seed)
 await db.exec('BEGIN;'+migration+'COMMIT;')
 return db
}
const upload = (db,bucket,name,size) => db.query('INSERT INTO storage.objects(bucket_id,name,metadata) VALUES($1,$2,$3)',[bucket,name,size === undefined ? null : {size}])
const used = async (db,scope='all') => (await db.query('SELECT bytes,objects FROM sitov_storage_private.usage WHERE scope=$1',[scope])).rows[0]

test('atomic storage ledger preserves and backfills existing recordings and prepared cache',async()=>{
 const db=await database(`INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('pronunciation_audio','${user}/old.webm','{"size":100}'),('audio_cache','sitov-qwen-v1/de/existing.mp3','{"size":200}');`)
 try {
  const before=(await db.query('SELECT * FROM storage.objects ORDER BY name')).rows
  assert.deepEqual(await used(db),{bytes:300,objects:2})
  await db.exec('BEGIN;'+migration+'COMMIT;')
  assert.deepEqual((await db.query('SELECT * FROM storage.objects ORDER BY name')).rows,before)
  assert.deepEqual(await used(db),{bytes:300,objects:2})
 } finally { await db.close() }
})
test('direct uploads, unknown-size reservations, final metadata and upserts all enforce quotas',async()=>{
 const db=await database()
 try {
  await db.exec("UPDATE sitov_storage_private.limits SET user_bytes=100,user_objects=2 WHERE bucket_id='pronunciation_audio'; SET ROLE authenticated")
  await upload(db,'pronunciation_audio',`${user}/one.webm`,60)
  await assert.rejects(upload(db,'pronunciation_audio',`${user}/two.webm`,60),error=>error.code==='PT413')
  await assert.rejects(upload(db,'pronunciation_audio',`${user}/missing-size.webm`),error=>error.code==='PT413')
  await db.exec('RESET ROLE')
  assert.deepEqual(await used(db),{bytes:60,objects:1})
  await db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('pronunciation_audio',$1,'{\"size\":80}') ON CONFLICT(bucket_id,name) DO UPDATE SET metadata=excluded.metadata",[`${user}/one.webm`])
  assert.deepEqual(await used(db),{bytes:80,objects:1})
  await assert.rejects(db.query('UPDATE storage.objects SET metadata=$1 WHERE name=$2',[{size:101},`${user}/one.webm`]),error=>error.code==='PT413')
  assert.deepEqual(await used(db),{bytes:80,objects:1})
  await db.exec("UPDATE sitov_storage_private.limits SET user_bytes=52428800 WHERE bucket_id='pronunciation_audio'")
  await upload(db,'pronunciation_audio',`${user}/placeholder.webm`)
  assert.deepEqual(await used(db),{bytes:26214480,objects:2})
  await db.query('UPDATE storage.objects SET metadata=$1 WHERE name=$2',[{size:20},`${user}/placeholder.webm`])
  assert.deepEqual(await used(db),{bytes:100,objects:2})
 } finally { await db.close() }
})
test('daily quota survives deletions; user, bucket and service-role cache limits roll back rejected writes',async()=>{
 const db=await database()
 try {
  await db.exec("UPDATE sitov_storage_private.limits SET daily_objects=1 WHERE bucket_id='pronunciation_audio'")
  await upload(db,'pronunciation_audio',`${user}/one.webm`,20)
  await db.query('DELETE FROM storage.objects WHERE name=$1',[`${user}/one.webm`])
  assert.deepEqual(await used(db),{bytes:0,objects:0})
  await assert.rejects(upload(db,'pronunciation_audio',`${user}/two.webm`,1),error=>error.code==='PT429')
  await db.exec("UPDATE sitov_storage_private.limits SET bucket_bytes=30 WHERE bucket_id='pronunciation_audio'")
  await upload(db,'pronunciation_audio',`${other}/one.webm`,25)
  await assert.rejects(upload(db,'pronunciation_audio',`${other}/two.webm`,10),error=>error.code==='PT413')
  await db.exec("UPDATE sitov_storage_private.limits SET bucket_bytes=10 WHERE bucket_id='audio_cache'; SET ROLE service_role")
  await upload(db,'audio_cache','sitov-qwen-v1/de/one.mp3',8)
  await assert.rejects(upload(db,'audio_cache','piper-local-v2/en/two.mp3',3),error=>error.code==='PT413')
  await db.exec('RESET ROLE')
  assert.deepEqual(await used(db),{bytes:33,objects:2})
  await assert.rejects(db.query("UPDATE storage.objects SET name='piper-local-v2/en/moved.mp3' WHERE bucket_id='audio_cache'"),error=>error.code==='23514')
 } finally { await db.close() }
})
test('untrusted sizes, oversized files and object counts cannot defeat the ledger',async()=>{
 const db=await database()
 try {
  for(const size of [-1,'unknown','1.5','1000000000000000000'])await assert.rejects(upload(db,'audio_cache',`bad-${size}.mp3`,size))
  await assert.rejects(upload(db,'audio_cache','oversized.mp3',2097153),error=>error.code==='PT413')
  await db.exec("UPDATE sitov_storage_private.limits SET bucket_objects=1 WHERE bucket_id='audio_cache'")
  await upload(db,'audio_cache','zero.mp3',0)
  await assert.rejects(upload(db,'audio_cache','zero-two.mp3',0),error=>error.code==='PT413')
  assert.deepEqual(await used(db),{bytes:0,objects:1})
 } finally { await db.close() }
})
test('course assets share the global ledger while audio, per-user and legacy per-level limits remain independent',async()=>{
 const db=await database()
 try {
  await upload(db,'course-assets','B1.1/material/lesson.pdf',100)
  assert.deepEqual(await used(db),{bytes:100,objects:1})
  assert.equal(await used(db,'protected-audio'),undefined)
  await upload(db,'audio_cache','sitov-qwen-v1/de/one.mp3',50)
  assert.deepEqual(await used(db,'protected-audio'),{bytes:50,objects:1})
  await db.exec("UPDATE sitov_storage_private.limits SET bucket_bytes=120 WHERE bucket_id='course-assets'")
  await assert.rejects(upload(db,'course-assets','A1.1/another/lesson.pdf',21),error=>error.code==='PT413')
  assert.deepEqual(await used(db),{bytes:150,objects:2})
  await db.exec("UPDATE sitov_storage_private.usage SET bytes=53687091200 WHERE scope='all'")
  await assert.rejects(upload(db,'audio_cache','global-over-limit.mp3',1),error=>error.code==='PT413')
  await db.exec("UPDATE sitov_storage_private.usage SET bytes=150 WHERE scope='all'; UPDATE sitov_storage_private.usage SET bytes=21474836480 WHERE scope='protected-audio'")
  await assert.rejects(upload(db,'audio_cache','audio-over-limit.mp3',1),error=>error.code==='PT413')
  await upload(db,'course-assets','A1.1/another/within.pdf',10)
  assert.deepEqual(await used(db,'bucket:course-assets'),{bytes:110,objects:2})
  await db.exec("UPDATE sitov_storage_private.usage SET bytes=50 WHERE scope='protected-audio'")
  await upload(db,'pronunciation_audio',`${user}/one.webm`,1)
  await db.query('UPDATE sitov_storage_private.usage SET bytes=786432000 WHERE scope=$1',[`user:${user}`])
  await db.query("INSERT INTO public.sitov_exam_upload_tickets(path,student_id,kind,expected_bytes) VALUES($1,$2,'speaking',1)",[`${user}/speaking/one.webm`,user])
  await assert.rejects(upload(db,'sitov-exam-submissions',`${user}/speaking/one.webm`,1),error=>error.code==='PT413')
 } finally { await db.close() }
})
test('exam tickets expire at Storage, bind actual size and cap unused URLs and daily issuance',async()=>{
 const db=await database()
 const ticket=async(name,bytes=100)=>db.query("INSERT INTO public.sitov_exam_upload_tickets(path,student_id,kind,expected_bytes) VALUES($1,$2,'speaking',$3)",[`${user}/speaking/${name}.webm`,user,bytes])
 try {
  await ticket('own')
  await assert.rejects(upload(db,'sitov-exam-submissions',`${user}/speaking/own.webm`,101),error=>error.code==='PT413')
  await upload(db,'sitov-exam-submissions',`${user}/speaking/own.webm`,100)
  await assert.rejects(upload(db,'sitov-exam-submissions',`${user}/speaking/unissued.webm`,1),error=>error.code==='55000')
  await ticket('expired')
  // Simulate passage of time while proving clients cannot extend tickets.
  await assert.rejects(db.query("UPDATE sitov_exam_upload_tickets SET expires_at=clock_timestamp()+interval '1 day' WHERE path=$1",[`${user}/speaking/expired.webm`]),error=>error.code==='23514')
  await db.exec('ALTER TABLE public.sitov_exam_upload_tickets DISABLE TRIGGER sitov_upload_ticket_limit')
  await db.query("UPDATE sitov_exam_upload_tickets SET expires_at=clock_timestamp()-interval '1 minute' WHERE path=$1",[`${user}/speaking/expired.webm`])
  await db.exec('ALTER TABLE public.sitov_exam_upload_tickets ENABLE TRIGGER sitov_upload_ticket_limit')
  await assert.rejects(upload(db,'sitov-exam-submissions',`${user}/speaking/expired.webm`,1),error=>error.code==='55000')
  for(let i=0;i<10;i++)await ticket(`unused-${i}`)
  await assert.rejects(ticket('eleventh'),error=>error.code==='PT429')
  await db.query('DELETE FROM sitov_exam_upload_tickets WHERE path<>$1',[`${user}/speaking/own.webm`])
  for(let i=0;i<28;i++){await ticket(`deleted-${i}`);await db.query('DELETE FROM sitov_exam_upload_tickets WHERE path=$1',[`${user}/speaking/deleted-${i}.webm`])}
  await assert.rejects(ticket('day-forty-one'),error=>error.code==='PT429')
 } finally { await db.close() }
})
test('browser roles cannot read counters or consume privileged generation quotas; daily synthesis bound is persistent',async()=>{
 const db=await database()
 const reserve=async(chars=1)=>(await db.query('SELECT public.sitov_reserve_audio_generation($1,$2) allowed',[user,chars])).rows[0].allowed
 try {
  for(const role of ['anon','authenticated']){
   await db.exec(`SET ROLE ${role}`)
   await assert.rejects(reserve(),/permission denied/)
   await assert.rejects(db.query('SELECT * FROM sitov_storage_private.daily'),/permission denied/)
   await db.exec('RESET ROLE')
  }
  await db.exec('SET ROLE service_role')
  assert.equal(await reserve(3001),false)
  for(let i=0;i<100;i++)assert.equal(await reserve(20),true)
  assert.equal(await reserve(20),false)
  await db.exec('RESET ROLE')
  assert.equal((await db.query("SELECT objects FROM sitov_storage_private.daily WHERE scope='synthesis:all'")).rows[0].objects,100)
 } finally { await db.close() }
})
