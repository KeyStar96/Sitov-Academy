import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const cleanup=await readFile(new URL('../standardization/cleanup.sql',import.meta.url),'utf8')
const fragment=cleanup.split('-- BEGIN canonical reset storage')[1].split('-- END canonical reset storage')[0]
const user='00000000-0000-4000-8000-000000000001',object='00000000-0000-4000-8000-000000000002'
async function setup(){
 const db=new PGlite()
 await db.exec(`CREATE SCHEMA auth; CREATE SCHEMA learning_reset_private;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${user}'::uuid$$;
 CREATE TABLE learning_reset_private.jobs(user_id uuid PRIMARY KEY,active boolean NOT NULL);
 CREATE TABLE learning_reset_private.audio_objects(user_id uuid REFERENCES learning_reset_private.jobs(user_id),object_id uuid,bucket_id text NOT NULL,CONSTRAINT audio_objects_bucket_id_check CHECK(bucket_id IN('audio_submissions','pronunciation_audio')));
 CREATE FUNCTION learning_reset_private.assert_writable(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$BEGIN IF EXISTS(SELECT 1 FROM learning_reset_private.jobs WHERE user_id=p_user AND active) THEN RAISE EXCEPTION 'learning_reset_in_progress' USING ERRCODE='55000'; END IF; END$$;
 INSERT INTO learning_reset_private.jobs VALUES('${user}',true);`)
 return db
}
await test('canonical reset manifest accepts pronunciation recordings only',async()=>{
 const db=await setup()
 try{
  await db.exec(fragment)
  await db.query('INSERT INTO learning_reset_private.audio_objects VALUES($1,$2,$3)',[user,object,'pronunciation_audio'])
  for(const bucket of ['audio_submissions','audio_cache','assets'])await assert.rejects(db.query('INSERT INTO learning_reset_private.audio_objects VALUES($1,$2,$3)',[user,object,bucket]),e=>e.code==='23514')
  await assert.rejects(db.query("SELECT learning_reset_private.storage_writable('pronunciation_audio',$1)",[object]),e=>e.code==='55000')
  for(const bucket of ['audio_cache','assets'])assert.equal((await db.query('SELECT learning_reset_private.storage_writable($1,$2) allowed',[bucket,object])).rows[0].allowed,true)
 }finally{await db.close()}
})
await test('migration refuses an unresolved retired-bucket reset manifest',async()=>{
 const db=await setup()
 try{
  await db.query('INSERT INTO learning_reset_private.audio_objects VALUES($1,$2,$3)',[user,object,'audio_submissions'])
  await assert.rejects(db.exec(fragment),/Non-canonical reset manifest/)
  assert.equal((await db.query('SELECT bucket_id FROM learning_reset_private.audio_objects')).rows[0].bucket_id,'audio_submissions')
 }finally{await db.close()}
})
