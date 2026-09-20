import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPhase3Database, apply, actor, id, student, teacher, outsider, result } from './helpers/phase3-db.mjs'

await test('Phase 5 media publication is atomic, authorized and retry-safe', async t => {
  const db = await createPhase3Database()
  const folder = id(501), video = id(502), pdf = id(503)
  const payload = (asset, format = 'mp4') => ({ asset_id: asset, folder_id: folder, title: 'Unterricht',
    file_name: `Unterricht.${format}`, storage_path: `A1.1/${folder}/${format === 'mp4' ? 'videos' : 'presentations'}/${asset}.${format}`,
    mime_type: format === 'mp4' ? 'video/mp4' : 'application/pdf', file_size: 35 * 1024 * 1024 })
  const complete = value => result(db, 'SELECT public.complete_media_upload($1) result', [JSON.stringify(value)])
  const put = async value => db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('course-assets',$1,$2)", [value.storage_path, JSON.stringify({ size: value.file_size, mimetype: value.mime_type })])
  try {
    await apply(db, ['12_media_upload.sql'])
    await actor(db, teacher)
    await db.query("INSERT INTO lms_media_folder(folder_id,level,title) VALUES($1,'A1.1','Phase 5 Upload')", [folder])
    await t.test('missing/inconsistent Storage data cannot leave orphan learning units', async () => {
      const p = payload(video)
      assert.equal((await complete(p)).error, 'invalid_input')
      assert.equal((await db.query('SELECT id FROM learning_units WHERE id=$1', [video])).rows.length, 0)
      await put(p)
      assert.equal((await complete({ ...p, file_size: p.file_size + 1 })).error, 'invalid_input')
      assert.equal((await db.query('SELECT id FROM learning_units WHERE id=$1', [video])).rows.length, 0)
    })
    await t.test('35 MiB video finalizes exactly once and has matching level/unit/storage metadata', async () => {
      const p = payload(video)
      assert.deepEqual(await complete(p), { asset_id: video })
      assert.deepEqual(await complete(p), { asset_id: video })
      assert.equal((await db.query('SELECT count(*)::int n FROM learning_videos WHERE id=$1', [video])).rows[0].n, 1)
      const unit = (await db.query('SELECT level,trainer::text,is_active FROM learning_units WHERE id=$1', [video])).rows[0]
      assert.deepEqual(unit, { level: 'A1.1', trainer: 'videos', is_active: true })
      assert.equal((await complete({ ...p, file_size: 1 })).error, 'invalid_input')
    })
    await t.test('PDF finalization is also retry-safe and enforces uploaded MIME', async () => {
      const p = payload(pdf, 'pdf')
      await put(p)
      assert.deepEqual(await complete(p), { asset_id: pdf })
      assert.deepEqual(await complete(p), { asset_id: pdf })
      assert.equal((await db.query('SELECT count(*)::int n FROM lms_presentation_asset WHERE asset_id=$1', [pdf])).rows[0].n, 1)
      const bad = payload(id(504), 'pdf'); await put({ ...bad, mime_type: 'video/mp4' })
      assert.equal((await complete(bad)).error, 'invalid_input')
    })
    await t.test('students cannot publish; locked levels expose no folder names or assets', async () => {
      await actor(db, outsider)
      assert.equal((await complete(payload(video))).error, 'not_authorized')
      for (const table of ['lms_media_folder', 'lms_presentation_asset', 'learning_videos']) assert.equal((await db.query(`SELECT * FROM ${table}`)).rows.length, 0)
      await actor(db, student)
      assert.equal((await db.query('SELECT title FROM lms_media_folder')).rows[0].title, 'Phase 5 Upload')
      assert.equal((await db.query('SELECT id FROM learning_videos')).rows.length, 1)
      assert.equal((await complete(payload(video))).error, 'not_authorized')
      await actor(db, teacher)
    })
    await t.test('invalid values return structured errors and migration replays safely', async () => {
      for (const value of [{}, { ...payload(video), asset_id: 'bad' }, { ...payload(video), file_size: null }]) {
        const failure = await complete(value)
        assert.equal(failure.error, 'invalid_input'); assert.equal(typeof failure.message, 'string')
      }
      await db.exec('RESET ROLE')
      await apply(db, ['12_media_upload.sql'])
      assert.equal((await db.query("SELECT has_function_privilege('anon','public.complete_media_upload(jsonb)','EXECUTE') allowed")).rows[0].allowed, false)
      await actor(db, teacher)
      assert.deepEqual(await complete(payload(video)), { asset_id: video })
    })
  } finally { await db.close() }
})
