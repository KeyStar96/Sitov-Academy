import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createLearningPathDatabase, actor, id, apply, student, teacher, outsider, exerciseUnit, vocabularyUnit, result } from './helpers/learning-path-db.mjs'

const rollback = readFileSync(new URL('../vps/rollback/42_learning_new.sql', import.meta.url), 'utf8')
const fresh = id(98001), locked = id(98002), german = id(98003)
const oldPath = id(98100), oldPathNode = id(98101), oldText = id(98102), oldFolder = id(98103), oldUrlVideo = id(98104)
const ids = { lesson: id(98200), path: id(98201), pathNode: id(98202), special: id(98203), text: id(98204), folder: id(98205), video: id(98206), url: id(98207), asset: id(98208), textUnit: id(98209), newTextUnit: id(98211), videoUnit: id(98210) }
const card = JSON.stringify({ rule: 'Wähle Ja.', examples: ['Ja.'] })
const videoPath = (level, folder, video) => `${level}/${folder}/videos/${video}.mp4`
const pdfPath = (level, folder, asset) => `${level}/${folder}/presentations/${asset}.pdf`

const admin = db => db.exec('RESET ROLE')
const as = async (db, user) => { await admin(db); await actor(db, user) }
const counts = async (db, user) => { await as(db, user); return result(db, 'SELECT get_learning_new_counts() result') }
const plain = ({ visited, ...rest }) => rest
const items = async (db, user, level = 'A1.1') => { await as(db, user); return (await result(db, 'SELECT get_learning_new_items($1) result', [level])).items }
const seen = async (db, user, kind, key) => { await as(db, user); return result(db, 'SELECT mark_learning_seen($1,$2) result', [kind, key]) }
const total = async (db, user, level = 'A1.1') => (await counts(db, user)).levels[level]?.total ?? 0

async function fixture() {
 const db = await createLearningPathDatabase()
 try {
  await db.exec("INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2)")
  for (const [uid, lang] of [[fresh, 'ru'], [locked, 'ru'], [german, 'de']]) {
   await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())', [uid, `${uid}@example.test`])
   await db.query("INSERT INTO profiles(id,role,native_language,ui_language) VALUES($1,'student','ru',$2)", [uid, lang])
  }
  // Existing stock before the migration: every kind once.
  await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,'A1.1','exercises','Altpfad',10,true,'old','old','Altpfad')", [oldPath])
  await db.query("INSERT INTO path_objectives(unit_id,id,area,description) VALUES($1,'goal','grammar','Ziel')", [oldPath])
  await db.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,goals,merkkarte) VALUES($1,$2,'p1','practice',1,'Alt','Alt',ARRAY['goal'],$3)", [oldPathNode, oldPath, card])
  await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.1','pronunciation','Alte Aussprache')", [ids.textUnit])
  await db.query("INSERT INTO learning_reading_texts(id,unit_id,sentence_de) VALUES($1,$2,'Ich lese einen alten Text.')", [oldText, ids.textUnit])
  await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.1','videos','Videos')", [ids.videoUnit])
  await db.query("INSERT INTO lms_media_folder(folder_id,level,title) VALUES($1,'A1.1','Alter Ordner')", [oldFolder])
  await db.query("INSERT INTO learning_videos(id,unit_id,source_url) VALUES($1,$2,'https://example.test/old-video')", [oldUrlVideo, ids.videoUnit])
  await db.query("INSERT INTO student_level_access(auth_user_id,level) VALUES($1,'A1.1'),($2,'A1.1'),($3,'A1.1')", [fresh, locked, german])
  await apply(db, ['42_learning_new.sql'])
  return db
 } catch (error) { await db.close(); delete error.query; throw error }
}
const scenario = (name, fn) => test(`learning new: ${name}`, async () => {
 const db = await fixture()
 try { await fn(db) } finally { await db.close() }
})

/** New content inserted as staff after the learners' first visit. */
async function publish(db, what = ['lesson', 'path', 'text', 'folder', 'url', 'asset']) {
 await admin(db)
 if (what.includes('lesson')) await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order) VALUES($1,'A1.1','vocabulary','Lektion 2',2)", [ids.lesson])
 if (what.includes('path')) {
  await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,'A1.1','exercises','Neuer Pfad',1,true,'new','new','Neuer Pfad')", [ids.path])
  await db.query("INSERT INTO path_objectives(unit_id,id,area,description) VALUES($1,'goal','grammar','Ziel')", [ids.path])
  await db.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,goals,merkkarte) VALUES($1,$2,'n1','practice',1,'Neu','Neu',ARRAY['goal'],$3)", [ids.pathNode, ids.path, card])
 }
 if (what.includes('text')) {
  await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.1','pronunciation','Neue Aussprache')", [ids.newTextUnit])
  await db.query("INSERT INTO learning_reading_texts(id,unit_id,sentence_de) VALUES($1,$2,'Ich lese einen neuen Text.')", [ids.text, ids.newTextUnit])
 }
 if (what.includes('folder')) await db.query("INSERT INTO lms_media_folder(folder_id,level,title) VALUES($1,'A1.1','Neuer Ordner')", [ids.folder])
 if (what.includes('url')) await db.query("INSERT INTO learning_videos(id,unit_id,source_url) VALUES($1,$2,'https://example.test/new-video')", [ids.url, ids.videoUnit])
 await as(db, teacher)
 if (what.includes('video')) {
  await db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('course-assets',$1,'{\"size\":100,\"mimetype\":\"video/mp4\"}')", [videoPath('A1.1', ids.folder, ids.video)])
  await db.query('INSERT INTO learning_videos(id,unit_id,folder_id,title,storage_path,file_size) VALUES($1,$2,$3,$4,$5,100)', [ids.video, ids.videoUnit, ids.folder, 'Neues Video', videoPath('A1.1', ids.folder, ids.video)])
 }
 if (what.includes('asset')) {
  await db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('course-assets',$1,'{\"size\":200,\"mimetype\":\"application/pdf\"}')", [pdfPath('A1.1', ids.folder, ids.asset)])
  await db.query("INSERT INTO lms_presentation_asset(asset_id,folder_id,file_name,storage_path,mime_type,file_size) VALUES($1,$2,'Neu.pdf',$3,'application/pdf',200)", [ids.asset, ids.folder, pdfPath('A1.1', ids.folder, ids.asset)])
 }
 await admin(db)
}

scenario('existing stock is not new after the migration, for every existing person', async db => {
 for (const user of [student, outsider, fresh, locked]) {
  const c = await counts(db, user); assert.deepEqual([c.success, c.any, c.levels], [true, false, {}])
  assert.deepEqual(c.visited, user === student || user === fresh || user === locked ? ['A1.1'] : [], 'levels of existing persons count as visited')
 }
 assert.deepEqual(await items(db, student), {})
 const baselines = (await db.query("SELECT count(*)::int n FROM learning_first_visits WHERE scope='room'")).rows[0].n
 assert.equal(baselines, (await db.query('SELECT count(*)::int n FROM profiles')).rows[0].n, 'all persons existing at migration time have a baseline')
})

scenario('a new object published after the first visit is new; opening it removes it, listing does not', async db => {
 assert.equal(await total(db, student), 0)
 await publish(db, ['lesson', 'text', 'url'])
 const level = (await counts(db, student)).levels['A1.1']
 assert.deepEqual([level.total, level.modes], [3, { vocabulary: 1, path: 0, pronunciation: 1, media: 1 }])
 assert.equal(level.level, false)
 assert.deepEqual(await items(db, student), { vocabulary_lesson: [ids.lesson], pronunciation_text: [ids.text], video: [ids.url] })
 // Looking at the list again changes nothing; only opening does.
 assert.equal(await total(db, student), 3)
 assert.deepEqual(await seen(db, student, 'vocabulary_lesson', ids.lesson), { success: true, marked: true })
 assert.deepEqual(await seen(db, student, 'vocabulary_lesson', ids.lesson), { success: true, marked: false }, 'idempotent')
 assert.equal(await total(db, student), 2)
 assert.deepEqual((await counts(db, student)).levels['A1.1'].modes, { vocabulary: 0, path: 0, pronunciation: 1, media: 1 })
 // Independent per person: the other learner still sees all three.
 assert.equal(await total(db, fresh), 3)
})

scenario('paths and special branches: locked ones are never new, unlocked ones are', async db => {
 await publish(db, ['path'])
 assert.deepEqual((await items(db, student)).path, [ids.path], 'a new first path is open and new')
 await admin(db)
 // A branch behind an uncompleted anchor is locked.
 await db.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,goals,anchor_node_id) VALUES($1,$2,'s1','special',2,'Zweig','Zweig',ARRAY['goal'],$3)", [ids.special, ids.path, ids.pathNode])
 assert.equal((await items(db, student)).special_branch, undefined)
 await admin(db)
 await db.query("INSERT INTO path_node_progress(auth_user_id,node_id,status,completed_at) VALUES($1,$2,'completed',now())", [student, ids.pathNode])
 assert.deepEqual((await items(db, student)).special_branch, [ids.special])
 assert.equal((await counts(db, student)).levels['A1.1'].modes.path, 1, 'the branch inside an unopened new path is covered by the path')
 await seen(db, student, 'path', ids.path)
 assert.equal((await counts(db, student)).levels['A1.1'].modes.path, 1, 'now the branch itself counts')
 await seen(db, student, 'special_branch', ids.special)
 assert.equal(await total(db, student), 0)
 // The older path stays locked for the second learner (previous path not completed): the new path with sort_order 0 is first, so it is open there too.
 assert.deepEqual((await items(db, fresh)).path, [ids.path])
})

scenario('a path that comes after an uncompleted path is locked and never new', async db => {
 await as(db, teacher)
 await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,'A1.1','exercises','Pfad 2',20,true,'second','second','Pfad 2')", [ids.path])
 await admin(db)
 assert.equal(await total(db, student), 0)
})

scenario('media: a new folder covers its files until it is opened; then files and presentations count on their own', async db => {
 await publish(db, ['folder', 'video', 'asset'])
 assert.deepEqual((await counts(db, student)).levels['A1.1'].modes.media, 1, 'only the folder counts')
 assert.deepEqual(await items(db, student), { media_folder: [ids.folder], video: [ids.video], presentation: [ids.asset] })
 await seen(db, student, 'media_folder', ids.folder)
 assert.equal((await counts(db, student)).levels['A1.1'].modes.media, 2)
 await seen(db, student, 'video', ids.video)
 await seen(db, student, 'presentation', ids.asset)
 assert.equal(await total(db, student), 0)
})

scenario('locked content is never new: no level access, German interface, disabled trainer, unselected lesson, other level', async db => {
 await publish(db, ['lesson', 'text', 'url', 'folder'])
 assert.equal(await total(db, outsider), 0, 'no access to the level')
 assert.deepEqual(plain(await counts(db, outsider)), { success: true, any: false, levels: {} })
 const g = (await counts(db, german)).levels['A1.1']
 assert.deepEqual(g.modes, { vocabulary: 0, path: 0, pronunciation: 0, media: 1 }, 'the folder follows the level; trainers and link videos need a non-German interface')
 await admin(db)
 await db.query("INSERT INTO learning_trainer_grants(auth_user_id,level,trainer,enabled,unit_mode) VALUES($1,'A1.1','vocabulary',false,'all'),($1,'A1.1','pronunciation',true,'selected')", [locked])
 const l = (await counts(db, locked)).levels['A1.1']
 assert.deepEqual(l.modes, { vocabulary: 0, path: 0, pronunciation: 0, media: 2 }, 'disabled trainer and lesson selection hide their news; folder and link video stay')
 await as(db, teacher)
 await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.2','vocabulary','Andere Stufe')", [id(98300)])
 assert.equal(await total(db, student, 'A1.2'), 0)
})

scenario('a new level is new for a learner who already visited; opening it clears it and starts its own baseline', async db => {
 assert.equal(await total(db, outsider, 'A1.2'), 0)
 await as(db, teacher)
 await db.query("SELECT set_student_level_access($1,ARRAY['A1.2'])", [outsider])
 let c = await counts(db, outsider)
 assert.deepEqual([c.levels['A1.2'].level, c.levels['A1.2'].total, c.any], [true, 1, true])
 await as(db, teacher)
 await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.2','vocabulary','Vor dem Besuch')", [id(98301)])
 assert.equal((await counts(db, outsider)).levels['A1.2'].total, 1, 'content of an unvisited level is covered by the level itself')
 assert.deepEqual(await seen(db, outsider, 'level', 'A1.2'), { success: true, marked: true })
 assert.equal(await total(db, outsider, 'A1.2'), 0, 'stock at the first visit of the level is not new')
 await as(db, teacher)
 await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.2','vocabulary','Nach dem Besuch')", [id(98302)])
 assert.equal(await total(db, outsider, 'A1.2'), 1)
})

scenario('a fresh account sees no old stock as new, also with levels booked in advance', async db => {
 const brand = id(98400)
 await admin(db)
 await db.query("INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'brand@example.test',now())", [brand])
 await db.query("INSERT INTO profiles(id,role,native_language,ui_language) VALUES($1,'student','ru','ru')", [brand])
 await as(db, teacher)
 await db.query("SELECT set_student_level_access($1,ARRAY['A1.1','A1.2'])", [brand])
 assert.deepEqual(plain(await counts(db, brand)), { success: true, any: false, levels: {} })
 assert.deepEqual(await items(db, brand, 'A1.1'), {})
 await seen(db, brand, 'level', 'A1.1')
 await publish(db, ['lesson'])
 assert.equal(await total(db, brand), 1)
 assert.equal(await total(db, brand, 'A1.2'), 0)
})

scenario('a trainer switched on again after the first visit is a new mode until opened', async db => {
 await admin(db)
 await db.query("INSERT INTO learning_trainer_grants(auth_user_id,level,trainer,enabled,unit_mode) VALUES($1,'A1.1','pronunciation',false,'all')", [student])
 assert.equal(await total(db, student), 0)
 await as(db, teacher)
 await db.query("SELECT set_student_trainer_access($1,'A1.1','pronunciation',true,NULL,false)", [student])
 const level = (await counts(db, student)).levels['A1.1']
 assert.deepEqual([level.total, level.modeNew.pronunciation, level.modes.pronunciation], [1, true, 0])
 assert.deepEqual((await items(db, student)).trainer, ['A1.1:pronunciation'])
 await seen(db, student, 'trainer', 'A1.1:pronunciation')
 assert.equal(await total(db, student), 0)
})

scenario('input is validated, only own receipts exist, unknown objects leave no trace, anonymous and staff get nothing', async db => {
 assert.deepEqual(await seen(db, student, 'nonsense', 'x'), { error: 'invalid_input', message: 'The request contains invalid data.' })
 assert.deepEqual(await seen(db, student, 'video', ''), { error: 'invalid_input', message: 'The request contains invalid data.' })
 assert.deepEqual(await seen(db, student, 'video', id(1)), { success: true, marked: false })
 await admin(db)
 assert.equal((await db.query('SELECT count(*)::int n FROM learning_seen_receipts')).rows[0].n, 0)
 await as(db, null)
 assert.deepEqual(await result(db, 'SELECT get_learning_new_counts() result'), { error: 'not_authenticated', message: 'Authentication is required.' })
 await assert.rejects(db.query('INSERT INTO learning_seen_receipts(auth_user_id,kind,object_key) VALUES($1,$2,$3)', [student, 'video', 'x']), e => e.code === '42501')
 await publish(db, ['lesson'])
 assert.deepEqual(plain(await counts(db, teacher)), { success: true, any: false, levels: {} })
 await seen(db, student, 'vocabulary_lesson', ids.lesson)
 await as(db, fresh)
 assert.equal((await db.query('SELECT count(*)::int n FROM learning_seen_receipts')).rows[0].n, 0, 'row security: nobody reads receipts of others')
})

scenario('migration is idempotent and the rollback removes the functions but keeps the recorded data', async db => {
 await publish(db, ['lesson'])
 await seen(db, student, 'vocabulary_lesson', ids.lesson)
 await admin(db)
 await apply(db, ['42_learning_new.sql'])
 assert.equal((await db.query('SELECT count(*)::int n FROM learning_seen_receipts')).rows[0].n, 1)
 await db.exec(rollback); await db.exec(rollback)
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc WHERE proname IN('get_learning_new_counts','get_learning_new_items','mark_learning_seen')")).rows[0].n, 0)
 assert.equal((await db.query('SELECT count(*)::int n FROM learning_seen_receipts')).rows[0].n, 1, 'archived, not deleted')
 await apply(db, ['42_learning_new.sql'])
 assert.equal(await total(db, student), 0)
})

test('learning new: the single call stays fast with a large catalogue', async () => {
 const db = await fixture()
 try {
  await admin(db)
  await db.exec(`
   INSERT INTO learning_units(id,level,trainer,label,sort_order) SELECT ('99000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'A1.1','vocabulary','L'||g,g FROM generate_series(1,60) g;
   INSERT INTO learning_units(id,level,trainer,label) SELECT ('99100000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'A1.1','pronunciation','P'||g FROM generate_series(1,400) g;
   INSERT INTO learning_reading_texts(unit_id,sentence_de) SELECT ('99100000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'Ich lese Text '||g FROM generate_series(1,400) g;
   INSERT INTO learning_videos(unit_id,source_url) SELECT '${ids.videoUnit}','https://example.test/v'||g FROM generate_series(1,300) g;
   INSERT INTO lms_media_folder(level,title) SELECT 'A1.1','Ordner '||g FROM generate_series(1,40) g;`)
  await counts(db, student)
  const started = performance.now()
  const runs = 10
  for (let i = 0; i < runs; i++) assert.equal((await counts(db, student)).levels['A1.1'].total, 60 + 400 + 300 + 40)
  const average = (performance.now() - started) / runs
  console.log(`get_learning_new_counts, 800 new objects, PGlite: ${average.toFixed(1)} ms average`)
  assert.ok(average < 1500, `${average} ms`)
 } finally { await db.close() }
})
