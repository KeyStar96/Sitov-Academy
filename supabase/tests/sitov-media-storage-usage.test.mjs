import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const migration = await readFile(new URL('../vps/89_sitov_media_storage_usage_breakdown.sql', import.meta.url), 'utf8')
const bootstrap = `
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA storage; CREATE SCHEMA business_private; CREATE SCHEMA sitov_storage_private;
 CREATE TABLE storage.buckets(id text PRIMARY KEY);
 CREATE TABLE storage.objects(bucket_id text REFERENCES storage.buckets(id),name text,metadata jsonb);
 CREATE TABLE public.learning_levels(code text PRIMARY KEY,sort_order integer);
 CREATE TABLE sitov_storage_private.limits(bucket_id text PRIMARY KEY,bucket_bytes bigint);
 CREATE FUNCTION business_private.is_staff() RETURNS boolean LANGUAGE sql AS $$
  SELECT coalesce(current_setting('sitov.test_role',true),'') IN ('teacher','admin')
 $$;
 INSERT INTO storage.buckets VALUES('audio_cache'),('course-assets'),('pronunciation_audio'),('sitov-exam-submissions'),('avatars');
 INSERT INTO sitov_storage_private.limits VALUES('audio_cache',8589934592),('course-assets',32212254720),('pronunciation_audio',5368709120),('sitov-exam-submissions',10737418240);
 INSERT INTO public.learning_levels VALUES('B2',90),('A1.2',20),('A1.1',10),('C2',100);
 SELECT set_config('sitov.test_role','teacher',false);
`
async function database(seed = '') {
 const db = new PGlite()
 await db.exec(bootstrap + seed)
 await db.exec(migration)
 return db
}
const usage = async db => (await db.query('SELECT public.media_storage_usage() result')).rows[0].result

test('all media buckets are counted separately from per-level course material without changing stored objects', async () => {
 const db = await database(`
  INSERT INTO storage.objects VALUES
   ('course-assets','A1.1/lesson/video.mp4','{"size":41943040}'),
   ('course-assets','B2/legacy/lesson.pdf','{"size":2097152}'),
   ('course-assets','unassigned/material.pdf','{"size":1024}'),
   ('audio_cache','prepared.mp3','{"size":8192}'),
   ('pronunciation_audio','user/real.webm','{"size":2048}'),
   ('sitov-exam-submissions','user/run.webm','{"size":4096}'),
   ('avatars','user/photo.jpg','{"size":3}');
 `)
 try {
  const before = (await db.query('SELECT * FROM storage.objects ORDER BY name')).rows
  const result = await usage(db)
  assert.equal(result.total_bytes,41943040+2097152+1024)
  assert.equal(result.storage_total_bytes,result.total_bytes+8192+2048+4096+3)
  assert.equal(result.unknown_size_objects,0)
  assert.equal(result.buckets.reduce((sum,bucket)=>sum+bucket.bytes,0),result.storage_total_bytes)
  assert.deepEqual(result.buckets.find(row=>row.bucket_id==='audio_cache'),{bucket_id:'audio_cache',bytes:8192,object_count:1,unknown_size_objects:0,limit_bytes:8589934592})
  assert.equal(result.buckets.find(row=>row.bucket_id==='avatars').limit_bytes,null)
  assert.equal(result.levels.find(row=>row.level==='A1.1').bytes,41943040)
  assert.equal(result.levels.find(row=>row.level==='A1.1').limit_bytes,21474836480)
  assert.deepEqual(result.levels.map(row=>row.level),['A1.1','A1.2','B2','C2'])
  await db.exec(migration)
  assert.deepEqual(await usage(db),result)
  assert.deepEqual((await db.query('SELECT * FROM storage.objects ORDER BY name')).rows,before)
 } finally { await db.close() }
})

test('missing and legacy invalid sizes are reported as unknown rather than silently counted as empty files', async () => {
 const db = await database(`INSERT INTO storage.objects VALUES
  ('audio_cache','pending.mp3',NULL),('avatars','legacy.jpg','{"size":"unknown"}'),
  ('avatars','zero.jpg','{"size":0}'),('avatars','small.jpg','{"size":1}');`)
 try {
  const result = await usage(db)
  assert.equal(result.storage_total_bytes,1)
  assert.equal(result.unknown_size_objects,2)
  assert.equal(result.buckets.find(row=>row.bucket_id==='avatars').object_count,3)
  assert.equal(result.buckets.find(row=>row.bucket_id==='avatars').unknown_size_objects,1)
  assert.equal(result.buckets.find(row=>row.bucket_id==='course-assets').bytes,0)
 } finally { await db.close() }
})

test('only staff can retrieve aggregate usage and the RPC exposes no object names or ownership data', async () => {
 const db = await database("INSERT INTO storage.objects VALUES('pronunciation_audio','private-user/private-recording.webm','{\"size\":128}');")
 try {
  await db.exec("SET ROLE authenticated; SELECT set_config('sitov.test_role','student',false)")
  assert.equal((await usage(db)).error,'not_authorized')
  await db.exec("SELECT set_config('sitov.test_role','teacher',false)")
  const result = await usage(db)
  assert.equal(result.storage_total_bytes,128)
  assert.ok(!JSON.stringify(result).includes('private-user'))
  await assert.rejects(db.query('SELECT * FROM storage.objects'),error=>error.code==='42501')
  await assert.rejects(db.query('SELECT * FROM sitov_storage_private.limits'),error=>error.code==='42501')
  await db.exec('RESET ROLE; SET ROLE anon')
  await assert.rejects(usage(db),error=>error.code==='42501')
 } finally { await db.close() }
})

test('empty level and object collections retain arrays and measured zero totals', async () => {
 const db = await database('DELETE FROM public.learning_levels;')
 try {
  const result = await usage(db)
  assert.equal(result.storage_total_bytes,0)
  assert.equal(result.total_bytes,0)
  assert.deepEqual(result.levels,[])
  assert.equal(result.buckets.length,5)
  assert.ok(result.buckets.every(bucket=>bucket.object_count===0&&bucket.bytes===0))
 } finally { await db.close() }
})
