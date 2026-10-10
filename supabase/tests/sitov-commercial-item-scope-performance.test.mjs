import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const read = name => readFile(new URL(name, import.meta.url), 'utf8')
const [commercial, metadata, staffScope, migration, canonical, rollback] = await Promise.all([
  read('../vps/93_sitov_commercial_access.sql'), read('../vps/112_sitov_legacy_metadata_performance.sql'),
  read('../vps/113_sitov_staff_legacy_verb_scope.sql'), read('../vps/119_sitov_commercial_item_scope_performance.sql'),
  read('../migrations/20261010180000_sitov_commercial_item_scope_performance.sql'),
  read('../vps/rollback/119_sitov_commercial_item_scope_performance.sql'),
])

const [plain, selected, disabled, vip, buyer, trial, none, owner, teacher, other] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(uid)
const students = { plain, selected, disabled, vip, buyer, trial, none, owner, other }
const unit = { open: uid(101), inactive: uid(102), next: uid(103), exercises: uid(104), verbsC1: uid(105), reading: uid(106), own: uid(107), foreign: uid(108), outside: uid(109) }
const cards = Object.fromEntries(['open', 'inactive', 'next', 'own', 'foreign', 'outside'].map((name, index) => [name, [uid(200 + index * 2), uid(201 + index * 2)]]))
const exercise = { plain: uid(301), active: uid(302), paused: uid(303), unknown: uid(304), verbs: uid(305) }
const reading = { first: uid(401), second: uid(402), verbs: uid(403) }
const node = uid(500)

// Deliberately scoped catalog slice (as in sitov-commercial-access.test.mjs) plus the
// tables a learner reads directly through the commercial policies.
const fixture = `
 CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE SCHEMA media_private;CREATE SCHEMA sitov_verb_private;CREATE SCHEMA trainer_access_private;CREATE SCHEMA learning_private;CREATE SCHEMA auth;CREATE SCHEMA identity_private;CREATE SCHEMA sitov_security_private;CREATE SCHEMA vocabulary_private;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
 CREATE TABLE profiles(id uuid PRIMARY KEY,role text NOT NULL,ui_language text);
 CREATE FUNCTION identity_private.current_profile_role() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$ SELECT role FROM public.profiles WHERE id=auth.uid() $$;
 CREATE FUNCTION sitov_security_private.sitov_staff_mfa_satisfied() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('sitov.test_mfa',true),'yes')<>'no' $$;
 CREATE TABLE learning_levels(code text PRIMARY KEY);
 CREATE TABLE learning_units(id uuid PRIMARY KEY,level text,trainer text,owner_auth_user_id uuid,label text,is_active boolean NOT NULL DEFAULT true);
 CREATE TABLE student_level_access(auth_user_id uuid,level text,PRIMARY KEY(auth_user_id,level));
 CREATE TABLE learning_trainer_grants(auth_user_id uuid,level text,trainer text,enabled boolean,unit_mode text);
 CREATE TABLE learning_unit_grants(auth_user_id uuid,level text,trainer text,unit_id uuid);
 CREATE TABLE learning_vocabulary_cards(id uuid PRIMARY KEY,unit_id uuid);
 CREATE TABLE learning_reading_texts(id uuid PRIMARY KEY,unit_id uuid);
 CREATE TABLE learning_exercises(id uuid PRIMARY KEY,unit_id uuid,node_id uuid,path_is_active boolean,content_status text);
 CREATE TABLE learning_videos(id uuid PRIMARY KEY,unit_id uuid,storage_path text,folder_id uuid);
 CREATE TABLE sitov_verb_catalog(id text PRIMARY KEY,unit_id uuid,level text);
 CREATE TABLE path_nodes(id uuid PRIMARY KEY,unit_id uuid,is_active boolean,anchor_node_id uuid,kind text);
 CREATE TABLE lms_media_folder(folder_id uuid PRIMARY KEY,level text);
 CREATE TABLE lms_presentation_asset(asset_id uuid PRIMARY KEY,folder_id uuid,storage_path text);
 CREATE TABLE vocabulary_direction_progress(id serial PRIMARY KEY,auth_user_id uuid,card_id uuid);
 CREATE TABLE vocabulary_translations(card_id uuid,locale text,PRIMARY KEY(card_id,locale));
 CREATE FUNCTION sitov_verb_private.media_allowed(p_level text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 CREATE FUNCTION sitov_verb_private.level_allowed(p_user uuid,p_level text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 CREATE FUNCTION sitov_verb_private.verb_allowed(p_user uuid,p_verb text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 CREATE FUNCTION media_private.folder_allowed(p_folder_id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 CREATE FUNCTION media_private.published_video_unit_ids() RETURNS uuid[] LANGUAGE sql AS $$ SELECT '{}'::uuid[] $$;
 CREATE FUNCTION media_private.path_allowed(p_name text,p_write boolean DEFAULT false) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 CREATE FUNCTION trainer_access_private.allowed(p_level text,p_trainer text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 CREATE FUNCTION trainer_access_private.unit_allowed(p_level text,p_trainer text,p_unit text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 CREATE FUNCTION learning_private.unit_allowed(p_unit_id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 CREATE FUNCTION learning_private.allowed_unit_ids() RETURNS uuid[] LANGUAGE sql AS $$ SELECT '{}'::uuid[] $$;
 INSERT INTO learning_levels SELECT unnest(ARRAY['A1.1','A1.2','A2.1','A2.2','B1.1','B1.2','B2.1','B2.2','C1.1','C1.2']);
 INSERT INTO profiles SELECT id::uuid,'student','ru' FROM unnest(ARRAY['${Object.values(students).join("','")}']) id;
 INSERT INTO profiles VALUES('${teacher}','teacher','de');
 INSERT INTO learning_units(id,level,trainer,owner_auth_user_id,is_active) VALUES
  ('${unit.open}','A1.1','vocabulary',NULL,true),('${unit.inactive}','A1.1','vocabulary',NULL,false),('${unit.next}','A1.2','vocabulary',NULL,true),
  ('${unit.exercises}','A1.1','exercises',NULL,true),('${unit.verbsC1}','C1.1','verbs',NULL,true),('${unit.reading}','A1.1','pronunciation',NULL,true),
  ('${unit.own}','A1.1','vocabulary','${owner}',false),('${unit.foreign}','A1.1','vocabulary','${other}',true),('${unit.outside}','C2','vocabulary',NULL,true);
 INSERT INTO learning_vocabulary_cards VALUES ${Object.entries(cards).flatMap(([name, ids]) => ids.map(id => `('${id}','${unit[name]}')`)).join(',')};
 INSERT INTO vocabulary_translations SELECT id,locale FROM learning_vocabulary_cards,unnest(ARRAY['de','ru']) locale;
 INSERT INTO vocabulary_direction_progress(auth_user_id,card_id) SELECT p.id,c.id FROM profiles p,learning_vocabulary_cards c ORDER BY p.id,c.id;
 INSERT INTO path_nodes VALUES('${node}','${unit.exercises}',true,NULL,'practice');
 INSERT INTO learning_exercises VALUES('${exercise.plain}','${unit.exercises}',NULL,NULL,'ready'),('${exercise.active}','${unit.exercises}','${node}',true,'ready'),
  ('${exercise.paused}','${unit.exercises}','${node}',false,'ready'),('${exercise.unknown}','${unit.exercises}','${node}',NULL,'ready'),('${exercise.verbs}','${unit.verbsC1}',NULL,NULL,'ready');
 INSERT INTO learning_reading_texts VALUES('${reading.first}','${unit.reading}'),('${reading.second}','${unit.reading}'),('${reading.verbs}','${unit.verbsC1}');
 INSERT INTO student_level_access VALUES('${plain}','A1.1'),('${selected}','A1.1'),('${disabled}','A1.1'),('${owner}','A1.1');
 INSERT INTO learning_trainer_grants VALUES('${selected}','A1.1','vocabulary',true,'selected'),('${disabled}','A1.1','vocabulary',false,'all');
 INSERT INTO learning_unit_grants VALUES('${selected}','A1.1','vocabulary','${unit.open}');
`
const tables = {
  cards: ['learning_vocabulary_cards', 'id::text'], exercises: ['learning_exercises', 'id::text'], reading: ['learning_reading_texts', 'id::text'],
  translations: ['vocabulary_translations', "card_id::text||'/'||locale"], progress: ['vocabulary_direction_progress', 'card_id::text'],
  units: ['learning_units', 'id::text'],
}

test('119 keeps the exact commercial item scope while evaluating it once per statement', async t => {
  const db = new PGlite()
  const actor = async (id, mfa = 'yes') => {
    await db.exec('RESET ROLE')
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('sitov.test_mfa',$2,false)", [id, mfa])
    await db.exec('SET ROLE authenticated')
  }
  const visible = async () => Object.fromEntries(await Promise.all(Object.entries(tables).map(async ([name, [table, key]]) =>
    [name, (await db.query(`SELECT ${key} k FROM public.${table} ORDER BY 1`)).rows.map(row => row.k)])))
  const actors = [...Object.entries(students), ['teacher', teacher], ['teacherWithoutMfa', teacher, 'no']]
  const snapshot = async () => {
    const result = {}
    for (const [name, id, mfa] of actors) { await actor(id, mfa); result[name] = await visible() }
    await db.exec('RESET ROLE')
    return result
  }
  // The per-item rule itself, outside row security, for every catalogued item.
  const ruled = async () => {
    const result = {}
    for (const [name, id, mfa] of actors) {
      await actor(id, mfa); await db.exec('RESET ROLE')
      result[name] = (await db.query(`SELECT kind||':'||item k FROM (
        SELECT 'vocabulary_card' kind,id::text item FROM learning_vocabulary_cards
        UNION ALL SELECT CASE WHEN node_id IS NULL THEN 'exercise' ELSE 'path_task' END,id::text FROM learning_exercises
        UNION ALL SELECT 'reading_text',id::text FROM learning_reading_texts) x
        WHERE sitov_access_private.item_allowed($1,kind,item) ORDER BY 1`, [id])).rows.map(row => row.k)
    }
    return result
  }
  const policies = async () => Object.fromEntries((await db.query("SELECT tablename||'.'||policyname k,qual FROM pg_policies WHERE policyname LIKE 'sitov_%' ORDER BY 1")).rows.map(row => [row.k, row.qual]))
  try {
    await db.exec(fixture)
    await db.exec(commercial); await db.exec(metadata); await db.exec(staffScope)
    await db.exec(`GRANT SELECT ON ${Object.values(tables).map(([table]) => table).join(',')} TO authenticated;
      ${Object.values(tables).map(([table]) => `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`).join('')}
      CREATE POLICY test_published ON learning_exercises FOR SELECT TO authenticated USING(true);
      CREATE POLICY test_published ON learning_reading_texts FOR SELECT TO authenticated USING(true);
      CREATE POLICY test_published ON vocabulary_translations FOR SELECT TO authenticated USING(true);`)
    await actor(teacher)
    assert.equal((await db.query('SELECT set_sitov_student_vip($1,true,0) r', [vip])).rows[0].r.revision, 1)
    const rules = { version: 1, rules: [
      { level: 'A1.2', trainer: 'vocabulary', unit_ids: [unit.next], items: [{ unit_id: unit.next, refs: [{ kind: 'vocabulary_card', id: cards.next[0] }] }] },
      { level: 'A1.1', trainer: 'pronunciation', unit_ids: null, items: null }] }
    assert.equal((await db.query('SELECT set_sitov_student_trial($1,$2,0) r', [trial, rules])).rows[0].r.success, true)
    await db.exec('RESET ROLE')
    await db.query("INSERT INTO sitov_access_private.orders(id,student_id,level,request_id,status,provider,amount_minor,currency) VALUES($1,$2,'A1.2',$3,'pending','stripe',100,'EUR')", [uid(900), buyer, uid(901)])
    await db.query('INSERT INTO sitov_access_private.purchases(order_id) VALUES($1)', [uid(900)])
    await db.query("UPDATE sitov_access_private.orders SET status='paid',provider_confirmation_verified=true WHERE id=$1", [uid(900)])

    const before = await snapshot(), ruleBefore = await ruled(), policiesBefore = await policies()
    await t.test('the fixture exercises every branch of the rule before the change', () => {
      const translations = ids => ids.flatMap(id => [`${id}/de`, `${id}/ru`])
      assert.deepEqual(before.plain.cards, cards.open)
      assert.deepEqual(before.plain.exercises, [exercise.plain, exercise.active])
      assert.deepEqual(before.plain.reading, [reading.first, reading.second])
      assert.deepEqual(before.plain.translations, translations(cards.open))
      assert.deepEqual(before.plain.progress, cards.open)
      assert.deepEqual(before.plain.units, [unit.open])
      assert.deepEqual(before.trial.units, [unit.next])
      assert.deepEqual(before.owner.units, [unit.open, unit.own])
      assert.deepEqual(before.teacher.units, [unit.open, unit.inactive, unit.next, unit.outside])
      assert.deepEqual(before.selected.cards, cards.open)
      assert.deepEqual(before.disabled.cards, [])
      assert.deepEqual(before.disabled.reading, [reading.first, reading.second])
      assert.deepEqual(before.vip.cards, [...cards.open, ...cards.next])
      assert.deepEqual(before.buyer.cards, cards.next)
      assert.deepEqual(before.trial.cards, [cards.next[0]])
      assert.deepEqual(before.trial.translations, translations([cards.next[0]]))
      assert.deepEqual(before.trial.reading, [reading.first, reading.second])
      assert.deepEqual(before.none, { cards: [], exercises: [], reading: [], translations: [], progress: [], units: [] })
      assert.deepEqual(before.owner.cards, [...cards.open, ...cards.own])
      assert.deepEqual(before.other.cards, [])
      assert.deepEqual(before.teacher.cards, [...cards.open, ...cards.inactive, ...cards.next, ...cards.outside])
      assert.deepEqual(before.teacher.exercises, [exercise.plain, exercise.active, exercise.verbs])
      assert.deepEqual(before.teacherWithoutMfa, before.none)
    })

    assert.equal(migration, canonical)
    await db.exec(migration)
    await t.test('row security shows exactly the same rows to every actor', async () => {
      assert.deepEqual(await snapshot(), before)
      assert.deepEqual(await ruled(), ruleBefore)
    })
    await t.test('the policies use the statement-level set and keep the exact rule for trial references', async () => {
      const after = await policies()
      for (const name of ['learning_vocabulary_cards.sitov_commercial_item_scope', 'learning_vocabulary_cards.sitov_vocabulary_exact_read',
        'learning_exercises.sitov_commercial_item_scope', 'learning_reading_texts.sitov_commercial_item_scope']) {
        assert.match(after[name], /sitov_item_scope_unit_ids\(\)/)
        assert.match(after[name], /sitov_item_scope_exact\(\).*item_allowed\(/s)
      }
      for (const name of ['vocabulary_direction_progress.sitov_vocabulary_progress_scope', 'vocabulary_translations.sitov_vocabulary_translation_scope']) {
        assert.match(after[name], /sitov_item_scope_card_ids\(\)/)
        assert.match(after[name], /sitov_item_scope_exact\(\).*item_allowed\(/s)
      }
      assert.match(after['vocabulary_direction_progress.sitov_vocabulary_progress_scope'], /auth_user_id = auth\.uid\(\)/)
      assert.match(after['learning_units.sitov_vocabulary_unit_metadata'], /trainer = 'vocabulary'.*sitov_vocabulary_visible_unit_ids\(\)/s)
      assert.doesNotMatch(after['learning_units.sitov_vocabulary_unit_metadata'], /vocabulary_unit_visible\(/)
      // Videos and presentations keep their item-specific legacy media rule unchanged.
      assert.equal(after['learning_videos.sitov_commercial_item_scope'], policiesBefore['learning_videos.sitov_commercial_item_scope'])
      assert.equal(after['lms_presentation_asset.sitov_commercial_item_scope'], policiesBefore['lms_presentation_asset.sitov_commercial_item_scope'])
      for (const [name, id] of Object.entries(students)) {
        await actor(id)
        assert.equal((await db.query('SELECT sitov_access_private.sitov_item_scope_exact() r')).rows[0].r, name === 'trial')
      }
      await db.exec('RESET ROLE')
    })
    await t.test('only the canonical text of an existing id resolves, without cast errors', async () => {
      await actor(plain); await db.exec('RESET ROLE')
      const allowed = async (kind, item) => (await db.query('SELECT sitov_access_private.item_allowed($1,$2,$3) r', [plain, kind, item])).rows[0].r
      const lettered = 'abcdef12-0000-4000-8000-00000000abcd'
      await db.query('INSERT INTO learning_vocabulary_cards VALUES($1,$2)', [lettered, unit.open])
      assert.equal(await allowed('vocabulary_card', lettered), true)
      for (const item of [lettered.toUpperCase(), `{${lettered}}`, lettered.replaceAll('-', ''), ` ${lettered}`, '', 'not-a-uuid', uid(999)]) {
        assert.equal(await allowed('vocabulary_card', item), false)
        assert.equal(await allowed('path_task', item), false)
      }
      assert.equal(await allowed('exercise', lettered), false)
      await db.query('DELETE FROM learning_vocabulary_cards WHERE id=$1', [lettered])
    })
    await t.test('private helpers stay closed to anonymous callers and changed grants take effect at once', async () => {
      const grants = (await db.query(`SELECT p.proname,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sitov_access_private' AND (p.proname LIKE 'sitov_item_scope_%' OR p.proname='sitov_vocabulary_visible_unit_ids') ORDER BY 1`)).rows
      assert.deepEqual(grants.map(row => [row.proname, row.anon, row.authenticated]),
        [['sitov_item_scope_card_ids', false, true], ['sitov_item_scope_exact', false, true], ['sitov_item_scope_unit_ids', false, true], ['sitov_vocabulary_visible_unit_ids', false, true]])
      await db.query('DELETE FROM student_level_access WHERE auth_user_id=$1', [plain])
      await actor(plain); assert.deepEqual(await visible(), before.none)
      await db.exec('RESET ROLE'); await db.query("INSERT INTO student_level_access VALUES($1,'A1.1')", [plain])
      await actor(plain); assert.deepEqual(await visible(), before.plain)
      await db.exec('RESET ROLE')
    })
    await t.test('replay is idempotent and the rollback restores the per-row policies with the same result', async () => {
      await db.exec(migration)
      assert.deepEqual(await snapshot(), before)
      await db.exec(rollback)
      assert.deepEqual(await policies(), policiesBefore)
      assert.deepEqual(await snapshot(), before)
      assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sitov_access_private' AND (p.proname LIKE 'sitov_item_scope_%' OR p.proname='sitov_vocabulary_visible_unit_ids')")).rows[0].n, 0)
      await db.exec(migration)
      assert.deepEqual(await snapshot(), before)
    })
  } finally { await db.close() }
})
