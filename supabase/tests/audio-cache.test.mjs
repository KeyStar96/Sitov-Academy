import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const migration = await readFile(new URL('./fixtures/history/migrations/20260910151457_neural_audio_cache.sql', import.meta.url), 'utf8')
await test('audio cache migration preserves existing buckets and rejects incompatible state', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      INSERT INTO storage.buckets VALUES('recordings','recordings',false,NULL,NULL);`)
    const before = (await db.query("SELECT * FROM storage.buckets WHERE id='recordings'")).rows
    await db.exec(migration)
    await db.exec(migration)
    assert.deepEqual((await db.query("SELECT * FROM storage.buckets WHERE id='recordings'")).rows,before)
    assert.deepEqual((await db.query("SELECT public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='audio_cache'")).rows,
      [{public:true,file_size_limit:1048576,allowed_mime_types:['audio/mpeg']}])
    await db.exec("UPDATE storage.buckets SET public=false WHERE id='audio_cache'")
    await assert.rejects(db.exec(migration),/incompatible settings/)
    await db.exec('ROLLBACK')
    assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id='audio_cache'")).rows[0].public,false)
  } finally { await db.close() }
})
