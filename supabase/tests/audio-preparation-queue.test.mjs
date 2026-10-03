import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('German audio preparation queue is service-only, idempotent and bound to prepared status', async () => {
  const db = new PGlite()
  const path = `sitov-qwen-v1/de/${'a'.repeat(64)}.mp3`
  const fingerprint = 'b'.repeat(64)
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public TO service_role;')
    const migration = await readFile(new URL('../migrations/20261003191609_sitov_audio_preparation_requests.sql', import.meta.url), 'utf8')
    await db.exec(migration)
    const table = (await db.query("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.sitov_audio_preparation_requests'::regclass")).rows[0]
    assert.equal(table.relrowsecurity, true)
    assert.equal((await db.query("SELECT count(*)::int n FROM pg_policies WHERE tablename = 'sitov_audio_preparation_requests'")).rows[0].n, 0)
    for (const role of ['anon', 'authenticated']) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) allowed', [role, 'public.sitov_audio_preparation_requests', privilege])).rows[0].allowed, false)
      }
      await db.exec(`SET ROLE ${role}`)
      await assert.rejects(db.query('SELECT * FROM public.sitov_audio_preparation_requests'), /permission denied/)
      await db.exec('RESET ROLE')
    }
    await db.exec('SET ROLE service_role')
    await db.query('INSERT INTO public.sitov_audio_preparation_requests(cache_path,text,profile_fingerprint) VALUES ($1,$2,$3)', [path, 'das Brot', fingerprint])
    await assert.rejects(db.query("UPDATE public.sitov_audio_preparation_requests SET status='prepared' WHERE cache_path=$1", [path]), /sitov_audio_preparation_state/)
    await db.query("UPDATE public.sitov_audio_preparation_requests SET status='prepared',prepared_at=now() WHERE cache_path=$1", [path])
    await db.query('INSERT INTO public.sitov_audio_preparation_requests(cache_path,text,profile_fingerprint) VALUES ($1,$2,$3) ON CONFLICT(cache_path) DO NOTHING', [path, 'das Brot', fingerprint])
    assert.deepEqual((await db.query('SELECT text,status FROM public.sitov_audio_preparation_requests')).rows, [{ text: 'das Brot', status: 'prepared' }])
    await assert.rejects(db.query('DELETE FROM public.sitov_audio_preparation_requests'), /permission denied/)
    await assert.rejects(db.query('INSERT INTO public.sitov_audio_preparation_requests(cache_path,text,profile_fingerprint) VALUES ($1,$2,$3)', ['legacy/de/invalid.mp3', 'Text', fingerprint]), /sitov_audio_preparation_path/)
    await db.exec('RESET ROLE')
    // Retrying a partially committed deployment must preserve prepared jobs,
    // the original relation and its closed application ACLs.
    const before = (await db.query("SELECT oid,relacl FROM pg_class WHERE oid='public.sitov_audio_preparation_requests'::regclass")).rows[0]
    await db.exec(migration)
    assert.deepEqual((await db.query("SELECT oid,relacl FROM pg_class WHERE oid='public.sitov_audio_preparation_requests'::regclass")).rows[0], before)
    assert.deepEqual((await db.query('SELECT text,status FROM public.sitov_audio_preparation_requests')).rows, [{ text: 'das Brot', status: 'prepared' }])
  } finally { await db.close() }
})
