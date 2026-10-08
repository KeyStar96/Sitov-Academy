import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCurrentDatabase, currentFeatureMigrations, apply, actor, id, student, teacher, outsider, result } from './helpers/current-db.mjs'

const migration = '91_sitov_learning_progress_media_visibility.sql'
const sql = path => readFile(new URL(path, import.meta.url), 'utf8')
const latest = [...currentFeatureMigrations, '59_daily_quests.sql', '60_daily_quest_resume.sql', '61_account_learning_checkpoints.sql',
  '62_verb_trainer_enums.sql', '63_verb_trainer.sql', '64_daily_quest_male_characters.sql', '65_sitov_verb_learning_progress.sql',
  '66_sitov_pronunciation_readiness.sql', '67_sitov_daily_quest_catalog.sql', '68_sitov_confirmed_registration_monthly_access.sql',
  '69_sitov_audio_preparation_requests.sql', '70_sitov_prepared_own_vocabulary.sql', '71_sitov_prepared_learning_publication.sql',
  '72_sitov_prepared_path_publication.sql', '73_sitov_exam_preparation.sql', '74_sitov_vocabulary_chunks_import.sql',
  '75_sitov_exam_simulation.sql', '76_sitov_simulation_feature_access.sql', '77_sitov_simulation_staff_reset.sql',
  '78_sitov_simulation_teacher_management.sql', '85_sitov_upper_levels.sql', '86_sitov_release_upper_levels.sql',
  '88_sitov_independent_simulation_levels.sql', '90_sitov_pronunciation_recall_evidence.sql']
const folder = id(91501), upperFolder = id(91502), lockedFolder = id(91503)
const selected = id(91511), unselected = id(91512), uploaded = id(91513), draft = id(91514), empty = id(91515), upperLink = id(91516)
const presentation = id(91521), upperPresentation = id(91522), lockedPresentation = id(91523)
const unit = media => id(Number(media.slice(-12)) + 100)
const owner = db => db.exec('RESET ROLE')
const as = async (db, user) => { await owner(db); await actor(db, user) }
const read = async (db, caller = student, target = null, level = null) => {
  await as(db, caller)
  const value = await result(db, 'SELECT get_learning_progress($1,$2,7) result', [target, level])
  assert.equal(value.success, true, JSON.stringify(value))
  return value
}
const snapshot = async db => {
  await owner(db)
  return result(db, `SELECT jsonb_build_object(
   'views',(SELECT jsonb_agg(to_jsonb(v) ORDER BY auth_user_id,kind,object_id,day) FROM learning_media_views v),
   'videos',(SELECT jsonb_agg(to_jsonb(v) ORDER BY id) FROM learning_videos v),
   'units',(SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM learning_units u),
   'grants',(SELECT jsonb_agg(to_jsonb(g) ORDER BY auth_user_id,level,trainer) FROM learning_trainer_grants g),
   'progress',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM vocabulary_direction_progress p)) result`)
}
const acl = async db => {
  await owner(db)
  return (await db.query("SELECT proowner,proacl::text,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid='public.get_learning_progress(uuid,text,integer)'::regprocedure")).rows[0]
}

await test('Sitov media analytics follow the learner library, preserve history and keep RPC permissions (91)', async t => {
  const db = await createCurrentDatabase({ latest, beforeLatest: db => db.exec("INSERT INTO cefr_levels VALUES('A2'),('B1'),('B2'),('C1') ON CONFLICT DO NOTHING; INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2),('A2.1','A2',3),('A2.2','A2',4),('B1.1','B1',5),('B1.2','B1',6) ON CONFLICT DO NOTHING") })
  try {
    await db.query("INSERT INTO student_level_access(auth_user_id,level) VALUES($1,'B2.1')", [student])
    await db.query("INSERT INTO lms_media_folder(folder_id,level,title) VALUES($1,'A1.1','Material'),($2,'B2.1','Oberstufe'),($3,'A1.2','Gesperrt')", [folder, upperFolder, lockedFolder])
    // Existing stored media, not new authored German content or audio. Storage
    // upload validation is outside this read-only analytics fixture.
    await db.exec('SET session_replication_role=replica')
    for (const [media, title, active, url, uploadedPath, level, folderId] of [
      [selected, 'Freigegebener Link', true, 'https://example.test/selected', null, 'A1.1', folder],
      [unselected, 'Nicht freigegebener Link', true, 'https://example.test/hidden', null, 'A1.1', folder],
      [uploaded, 'Unterrichtsvideo', true, null, `A1.1/${folder}/videos/${uploaded}.mp4`, 'A1.1', folder],
      [draft, 'Entwurf', false, 'https://example.test/draft', null, 'A1.1', folder],
      [empty, 'Leerer Altbestand', true, null, null, 'A1.1', null],
      [upperLink, 'Oberstufenlink', true, 'https://example.test/upper', null, 'B2.1', upperFolder],
    ]) {
      await db.query("INSERT INTO learning_units(id,level,trainer,label,is_active) VALUES($1,$2,'videos',$3,$4)", [unit(media), level, title, active])
      await db.query('INSERT INTO learning_videos(id,unit_id,folder_id,title,source_url,storage_path,file_size) VALUES($1,$2,$3,$4,$5,$6,$7)', [media, unit(media), folderId, title, url, uploadedPath, uploadedPath ? 100 : null])
    }
    for (const [asset, folderId, level] of [[presentation, folder, 'A1.1'], [upperPresentation, upperFolder, 'B2.1'], [lockedPresentation, lockedFolder, 'A1.2']])
      await db.query("INSERT INTO lms_presentation_asset(asset_id,folder_id,file_name,storage_path,mime_type,file_size) VALUES($1,$2,$3,$4,'application/pdf',100)", [asset, folderId, `${level}.pdf`, `${level}/${folderId}/presentations/${asset}.pdf`])
    await db.exec('SET session_replication_role=origin')
    await db.query("INSERT INTO learning_trainer_grants(auth_user_id,level,trainer,enabled,unit_mode) VALUES($1,'A1.1','videos',true,'selected')", [student])
    await db.query("INSERT INTO learning_unit_grants(auth_user_id,level,trainer,unit_id) VALUES($1,'A1.1','videos',$2)", [student, unit(selected)])
    for (const [kind, object] of [['link', selected], ['link', unselected], ['video', uploaded], ['link', draft], ['presentation', presentation]])
      await db.query("INSERT INTO learning_media_views(auth_user_id,day,kind,object_id,level) VALUES($1,(now() AT TIME ZONE 'Europe/Berlin')::date,$2,$3,'A1.1')", [student, kind, object])
    const before = await snapshot(db), beforeAcl = await acl(db), beforeProgress = await read(db)

    await t.test('only the media estimate changes and the two migration copies are identical', async () => {
      assert.equal(await sql(`../vps/${migration}`), await sql('../migrations/20261008143225_sitov_learning_progress_media_visibility.sql'))
      await owner(db); await apply(db, [migration])
      assert.deepEqual(await snapshot(db), before)
      assert.deepEqual(await acl(db), beforeAcl)
      const after = await read(db)
      assert.deepEqual({ ...after, media: undefined }, { ...beforeProgress, media: undefined })
      assert.equal(after.media.totalMedia, 5)
      assert.equal(after.media.viewedMedia, 3)
      assert.deepEqual(after.media.recent.map(row => row.title).sort(), ['A1.1.pdf', 'Freigegebener Link', 'Unterrichtsvideo'])
      assert.equal(after.daily.at(-1).media.views, 5, 'revoked/draft historical views remain counted')
    })
    await t.test('selected link grants match actual RLS; uploads and documents keep their separate access', async () => {
      await as(db, student)
      const visibleVideos = (await db.query('SELECT v.id,v.source_url,v.storage_path,u.is_active FROM learning_videos v JOIN learning_units u ON u.id=v.unit_id')).rows
        .filter(row => row.is_active && (row.storage_path || row.source_url))
      assert.deepEqual(visibleVideos.map(row => row.id).sort(), [selected, uploaded, upperLink].sort())
      assert.equal((await db.query('SELECT asset_id FROM lms_presentation_asset')).rows.length, 2)
      assert.equal((await read(db)).media.totalMedia, visibleVideos.length + 2)
      assert.equal((await read(db, student, null, 'A1.1')).media.totalMedia, 3)
      assert.equal((await read(db, student, null, 'B2.1')).media.totalMedia, 2)
      assert.equal((await read(db, student, null, 'A1.2')).media.totalMedia, 0, 'explicit filter cannot bypass locked levels')
      assert.equal((await read(db, outsider, null, 'A1.1')).media.totalMedia, 0)
    })
    await t.test('staff see the target learner permissions rather than their own wider library', async () => {
      assert.deepEqual((await read(db, teacher, student)).media, (await read(db)).media)
      await as(db, outsider)
      assert.equal((await result(db, 'SELECT get_learning_progress($1,NULL,7) result', [student])).error, 'not_authorized')
      await as(db, null)
      assert.equal((await result(db, 'SELECT get_learning_progress(NULL,NULL,7) result')).error, 'not_authenticated')
      await owner(db)
      assert.equal((await db.query("SELECT has_function_privilege('anon','get_learning_progress(uuid,text,integer)','EXECUTE') allowed")).rows[0].allowed, false)
    })
    await t.test('all-unit mode admits other published links but never empty legacy rows', async () => {
      await owner(db)
      await db.query("UPDATE learning_trainer_grants SET unit_mode='all' WHERE auth_user_id=$1 AND level='A1.1' AND trainer='videos'", [student])
      const own = await read(db)
      assert.equal(own.media.totalMedia, 6)
      assert.equal(own.media.viewedMedia, 4)
      assert.ok(own.media.recent.some(row => row.title === 'Nicht freigegebener Link'))
      assert.ok(!own.media.recent.some(row => row.title === 'Entwurf'))
      await owner(db)
      await db.query("UPDATE learning_trainer_grants SET unit_mode='selected' WHERE auth_user_id=$1 AND level='A1.1' AND trainer='videos'", [student])
    })
    await t.test('unpublishing a viewed video removes it from the current aggregate without erasing views', async () => {
      await owner(db); await db.query('UPDATE learning_units SET is_active=false WHERE id=$1', [unit(uploaded)])
      const own = await read(db)
      assert.equal(own.media.totalMedia, 4)
      assert.equal(own.media.viewedMedia, 2)
      assert.ok(!own.media.recent.some(row => row.title === 'Unterrichtsvideo'))
      assert.equal(own.daily.at(-1).media.views, 5)
      await owner(db); await db.query('UPDATE learning_units SET is_active=true WHERE id=$1', [unit(uploaded)])
    })
    await t.test('trainer disable/re-enable immediately affects current counts and recent, preserving history', async () => {
      await owner(db)
      await db.query("UPDATE learning_trainer_grants SET enabled=false WHERE auth_user_id=$1 AND level='A1.1' AND trainer='videos'", [student])
      const own = await read(db, student, null, 'A1.1')
      assert.deepEqual(own.media, { totalMedia: 0, viewedMedia: 0, recent: [] })
      assert.equal(own.daily.at(-1).media.views, 5)
      assert.deepEqual((await read(db, teacher, student, 'A1.1')).media, own.media)
      await owner(db)
      await db.query("UPDATE learning_trainer_grants SET enabled=true WHERE auth_user_id=$1 AND level='A1.1' AND trainer='videos'", [student])
      assert.equal((await read(db)).media.totalMedia, 5)
    })
    await t.test('German profile language keeps uploaded videos/documents but no inaccessible external links', async () => {
      await owner(db); await db.query("UPDATE profiles SET ui_language='de' WHERE id=$1", [student])
      const own = await read(db)
      assert.equal(own.media.totalMedia, 3)
      assert.deepEqual((await read(db, teacher, student)).media, own.media)
      await as(db, student)
      assert.deepEqual((await db.query('SELECT id FROM learning_videos')).rows.map(row => row.id), [uploaded])
      await owner(db); await db.query("UPDATE profiles SET ui_language='ru' WHERE id=$1", [student])
    })
    await t.test('removing level access hides media and titles while retaining historical daily activity', async () => {
      await owner(db); await db.query("DELETE FROM student_level_access WHERE auth_user_id=$1 AND level='A1.1'", [student])
      const own = await read(db, student, null, 'A1.1')
      assert.deepEqual(own.media, { totalMedia: 0, viewedMedia: 0, recent: [] })
      assert.equal(own.daily.at(-1).media.views, 5)
      await owner(db); await db.query("INSERT INTO student_level_access(auth_user_id,level) VALUES($1,'A1.1')", [student])
    })
    await t.test('reapplying migration is idempotent and refuses unexpected aggregate drift', async () => {
      const state = await snapshot(db), progress = await read(db)
      await owner(db); await apply(db, [migration])
      assert.deepEqual(await snapshot(db), state)
      assert.deepEqual((await read(db)).media, progress.media)
      await owner(db)
      await db.exec("BEGIN; DO $$ DECLARE body text; BEGIN body:=pg_get_functiondef('get_learning_progress(uuid,text,integer)'::regprocedure); EXECUTE replace(body,'sitov-media-visibility-v1','unexpected-change'); END $$;")
      await assert.rejects(apply(db, [migration]), /sitov_media_progress_contract_changed/)
      await db.exec('ROLLBACK')
      assert.deepEqual((await read(db)).media, progress.media)
    })
    await t.test('guarded rollback restores only the media section and can be reapplied safely', async () => {
      const state = await snapshot(db), access = await acl(db), progress = await read(db)
      await owner(db); await db.exec(await sql(`../vps/rollback/${migration}`))
      assert.deepEqual(await snapshot(db), state)
      assert.deepEqual(await acl(db), access)
      const rolledBack = await read(db)
      assert.deepEqual({ ...rolledBack, media: undefined }, { ...progress, media: undefined })
      assert.equal(rolledBack.media.totalMedia, beforeProgress.media.totalMedia)
      await owner(db); await db.exec(await sql(`../vps/rollback/${migration}`)); await apply(db, [migration])
      assert.deepEqual((await read(db)).media, progress.media)
      assert.deepEqual(await snapshot(db), state)
    })
    await t.test('native smoke uses the real media/read RPCs and rolls back every synthetic row', async () => {
      await owner(db)
      await db.exec("ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS aud text; ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS role text; ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS created_at timestamptz; ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS updated_at timestamptz; ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_app_meta_data jsonb DEFAULT '{}';")
      const state = await snapshot(db)
      await db.exec((await sql('../../deploy/vps/tests/sitov-learning-progress-media-visibility.sql')).replace(/^\\set[^\n]*\n/gm, ''))
      assert.deepEqual(await snapshot(db), state)
    })
  } finally { await db.close() }
})
