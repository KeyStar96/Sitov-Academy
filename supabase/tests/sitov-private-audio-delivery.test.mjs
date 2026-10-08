import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SitovNativeDatabase, createSitovCurrentNativeDatabase } from './helpers/sitov-night-current-native-db.mjs'
import { sitovHistorySnapshot, sitovUsers } from './helpers/sitov-night-current-db.mjs'

test('native96: private bucket and restrictive cache policy withstand broad existing SELECT grants', async () => {
  const admin = new SitovNativeDatabase(), database = `sitov_night_audio_${process.pid}`
  admin.raw(`CREATE DATABASE ${database}`)
  try {
    const db = await createSitovCurrentNativeDatabase({ database })
    const history = await sitovHistorySnapshot(db)
    await db.actor(null, 'postgres')
    // Synthetic metadata only. This does not prove Storage HTTP or real audio bytes.
    await db.exec(`UPDATE storage.buckets SET public=true WHERE id='audio_cache';
      INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('audio_cache','sitov-qa.mp3','{"size":10}');
      CREATE POLICY sitov_qa_broad_read ON storage.objects FOR SELECT TO anon,authenticated USING(true);
      GRANT SELECT ON storage.objects TO anon;`)
    const migration = await readFile(new URL('../vps/96_sitov_private_audio_delivery.sql', import.meta.url), 'utf8')
    assert.equal(migration, await readFile(new URL('../migrations/20261008213300_sitov_private_audio_delivery.sql', import.meta.url), 'utf8'))
    await db.exec(`BEGIN; ${migration} COMMIT;`)
    assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id='audio_cache'")).rows[0].public, false)
    assert.ok((await db.query("SELECT position('storage://audio_cache/' IN pg_get_functiondef('vocabulary_private.sitov_prepared_german_audio_url(text)'::regprocedure))>0 private_reference")).rows[0].private_reference)
    for (const [uid, role] of [[null, 'anon'], [sitovUsers.all, 'authenticated'], [sitovUsers.teacher, 'authenticated']]) {
      await db.actor(uid, role)
      assert.deepEqual((await db.query("SELECT name FROM storage.objects WHERE bucket_id='audio_cache'")).rows, [])
    }
    await db.actor(null, 'service_role')
    assert.equal((await db.query("SELECT name FROM storage.objects WHERE bucket_id='audio_cache'")).rows.length, 1)
    await db.actor(null, 'postgres'); await db.exec(migration)
    assert.deepEqual(await sitovHistorySnapshot(db), history)
  } finally { admin.raw(`DROP DATABASE ${database}`) }
})
