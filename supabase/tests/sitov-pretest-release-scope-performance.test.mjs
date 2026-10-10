import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const read = name => readFile(new URL(name, import.meta.url), 'utf8')
const [pretests, migration, canonical, rollback] = await Promise.all([
  read('../vps/94_sitov_pronunciation_pretests.sql'), read('../vps/120_sitov_pretest_release_scope_performance.sql'),
  read('../migrations/20261010190000_sitov_pretest_release_scope_performance.sql'), read('../vps/rollback/120_sitov_pretest_release_scope_performance.sql'),
])
// The three functions and policies of migration 94 that decide what a pass releases, verbatim.
const statement = start => {
  const from = pretests.indexOf(start)
  assert.ok(from >= 0, start)
  return pretests.slice(from, pretests.indexOf(';\n', from) + 1)
}
const original = ['CREATE OR REPLACE FUNCTION sitov_pronunciation_private.current_pass(', 'CREATE OR REPLACE FUNCTION sitov_pronunciation_private.staff_preview()',
  'CREATE POLICY sitov_pronunciation_readiness_bounds ON public.learning_reading_texts', 'CREATE OR REPLACE FUNCTION sitov_pronunciation_private.unit_has_current_pass(',
  'CREATE POLICY sitov_pretest_released_read ON public.learning_reading_texts', 'CREATE POLICY sitov_pretest_released_unit ON public.learning_units'].map(statement).join('\n')

const [passed, stale, blocked, fresh, teacher] = [1, 2, 3, 4, 5].map(uid)
const unit = { first: uid(101), second: uid(102), third: uid(103), vocabulary: uid(104) }
const text = { first: uid(201), second: uid(202), third: uid(203), cyrillic: uid(204) }
const definition = { first: uid(301), secondOld: uid(302), secondCurrent: uid(303), third: uid(304), cyrillic: uid(305) }

// Dependencies of the release rule are reduced to tables the test controls.
const fixture = `
 CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE SCHEMA auth; CREATE SCHEMA sitov_pronunciation_private; CREATE SCHEMA sitov_access_private; CREATE SCHEMA learning_private;
 GRANT USAGE ON SCHEMA auth,sitov_pronunciation_private,sitov_access_private,learning_private TO authenticated;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE TABLE profiles(id uuid PRIMARY KEY,role text NOT NULL);
 CREATE TABLE learning_units(id uuid PRIMARY KEY,trainer text NOT NULL);
 CREATE TABLE learning_reading_texts(id uuid PRIMARY KEY,unit_id uuid NOT NULL,sentence_de text NOT NULL,focus text);
 CREATE TABLE sitov_pronunciation_private.pretest_definitions(id uuid PRIMARY KEY,text_id uuid NOT NULL,active boolean NOT NULL);
 CREATE TABLE sitov_pronunciation_private.pretest_passes(student_id uuid NOT NULL,definition_id uuid NOT NULL,UNIQUE(student_id,definition_id));
 CREATE TABLE sitov_access_private.test_denied(student_id uuid,item text);
 CREATE FUNCTION sitov_access_private.staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='teacher') $$;
 CREATE FUNCTION sitov_access_private.item_allowed(p_student uuid,p_kind text,p_item_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p_kind='reading_text' AND NOT EXISTS(SELECT 1 FROM sitov_access_private.test_denied d WHERE d.student_id=p_student AND d.item=p_item_id) $$;
 CREATE FUNCTION sitov_pronunciation_private.current_pretest(p_text uuid) RETURNS sitov_pronunciation_private.pretest_definitions LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT d FROM sitov_pronunciation_private.pretest_definitions d JOIN public.learning_reading_texts r ON r.id=d.text_id WHERE d.text_id=p_text AND d.active $$;
 CREATE FUNCTION learning_private.german_text_allowed(p_text text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce(p_text,'') !~ '[а-я]' $$;
 INSERT INTO profiles VALUES('${passed}','student'),('${stale}','student'),('${blocked}','student'),('${fresh}','student'),('${teacher}','teacher');
 INSERT INTO learning_units VALUES('${unit.first}','pronunciation'),('${unit.second}','pronunciation'),('${unit.third}','pronunciation'),('${unit.vocabulary}','vocabulary');
 INSERT INTO learning_reading_texts VALUES('${text.first}','${unit.first}','Guten Tag.',NULL),('${text.second}','${unit.second}','Ich lerne Deutsch.','lernen'),
  ('${text.third}','${unit.third}','Wir trinken Tee.',NULL),('${text.cyrillic}','${unit.third}','Привет.',NULL);
 INSERT INTO sitov_pronunciation_private.pretest_definitions VALUES('${definition.first}','${text.first}',true),('${definition.secondOld}','${text.second}',false),
  ('${definition.secondCurrent}','${text.second}',true),('${definition.third}','${text.third}',true),('${definition.cyrillic}','${text.cyrillic}',true);
 INSERT INTO sitov_pronunciation_private.pretest_passes VALUES('${passed}','${definition.first}'),('${passed}','${definition.secondCurrent}'),('${passed}','${definition.cyrillic}'),
  ('${stale}','${definition.secondOld}'),('${stale}','${definition.third}'),('${blocked}','${definition.first}'),('${blocked}','${definition.third}');
 INSERT INTO sitov_access_private.test_denied VALUES('${blocked}','${text.first}');
 GRANT SELECT ON learning_units,learning_reading_texts TO authenticated;
 ALTER TABLE learning_units ENABLE ROW LEVEL SECURITY; ALTER TABLE learning_reading_texts ENABLE ROW LEVEL SECURITY;
`

test('120 keeps exactly what a current pass releases while evaluating it once per statement', async t => {
  const db = new PGlite()
  const actor = async id => { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']); await db.exec('SET ROLE authenticated') }
  const actors = { passed, stale, blocked, fresh, teacher, anonymousClaim: null }
  const snapshot = async () => {
    const result = {}
    for (const [name, id] of Object.entries(actors)) {
      await actor(id)
      result[name] = {
        texts: (await db.query('SELECT id::text k FROM public.learning_reading_texts ORDER BY 1')).rows.map(row => row.k),
        units: (await db.query('SELECT id::text k FROM public.learning_units ORDER BY 1')).rows.map(row => row.k),
      }
    }
    await db.exec('RESET ROLE')
    return result
  }
  // The per-row functions of migration 94 for every text and unit.
  const ruled = async () => {
    const result = {}
    for (const [name, id] of Object.entries(actors)) {
      await actor(id); await db.exec('RESET ROLE')
      result[name] = {
        texts: (await db.query('SELECT id::text k FROM public.learning_reading_texts WHERE sitov_pronunciation_private.current_pass(id) ORDER BY 1')).rows.map(row => row.k),
        units: (await db.query('SELECT id::text k FROM public.learning_units WHERE sitov_pronunciation_private.unit_has_current_pass(id) ORDER BY 1')).rows.map(row => row.k),
      }
    }
    return result
  }
  const sets = async () => {
    const result = {}
    for (const [name, id] of Object.entries(actors)) {
      await actor(id)
      result[name] = {
        texts: (await db.query('SELECT k::text FROM sitov_pronunciation_private.sitov_current_pass_text_ids() k ORDER BY 1')).rows.map(row => row.k),
        units: (await db.query('SELECT DISTINCT k::text FROM sitov_pronunciation_private.sitov_current_pass_unit_ids() k ORDER BY 1')).rows.map(row => row.k),
      }
    }
    await db.exec('RESET ROLE')
    return result
  }
  const policies = async () => Object.fromEntries((await db.query("SELECT tablename||'.'||policyname k,qual FROM pg_policies ORDER BY 1")).rows.map(row => [row.k, row.qual]))
  try {
    await db.exec(fixture); await db.exec(original)
    // A released unit also needs the catalogue policy of the real schema; the staff preview one stands in for staff_manage.
    await db.exec("CREATE POLICY test_staff ON learning_reading_texts FOR SELECT TO authenticated USING((SELECT sitov_access_private.staff())); CREATE POLICY test_staff ON learning_units FOR SELECT TO authenticated USING((SELECT sitov_access_private.staff()));")
    const before = await snapshot(), ruleBefore = await ruled(), policiesBefore = await policies()
    await t.test('the fixture covers current, replaced, refused and missing passes before the change', () => {
      assert.deepEqual(before.passed, { texts: [text.first, text.second], units: [unit.first, unit.second, unit.third] })
      assert.deepEqual(ruleBefore.passed.texts, [text.first, text.second, text.cyrillic])
      assert.deepEqual(before.stale, { texts: [text.third], units: [unit.third] })
      assert.deepEqual(before.blocked, { texts: [text.third], units: [unit.third] })
      assert.deepEqual(before.fresh, { texts: [], units: [] })
      assert.deepEqual(before.anonymousClaim, { texts: [], units: [] })
      assert.deepEqual(before.teacher, { texts: [text.first, text.second, text.third, text.cyrillic], units: Object.values(unit) })
    })
    assert.equal(migration, canonical)
    await db.exec(migration)
    await t.test('row security and the release sets equal the per-row rule for every actor', async () => {
      assert.deepEqual(await snapshot(), before)
      assert.deepEqual(await ruled(), ruleBefore)
      assert.deepEqual(await sets(), ruleBefore)
    })
    await t.test('the three policies use the statement-level sets and nothing else changed', async () => {
      const after = await policies()
      assert.match(after['learning_reading_texts.sitov_pronunciation_readiness_bounds'], /SELECT sitov_pronunciation_private\.staff_preview\(\).*sitov_current_pass_text_ids\(\)/s)
      assert.match(after['learning_reading_texts.sitov_pretest_released_read'], /sitov_current_pass_text_ids\(\).*german_text_allowed\(sentence_de\).*german_text_allowed\(focus\)/s)
      assert.match(after['learning_units.sitov_pretest_released_unit'], /trainer = 'pronunciation'.*sitov_current_pass_unit_ids\(\)/s)
      for (const name of Object.keys(after)) if (!name.includes('sitov_')) assert.equal(after[name], policiesBefore[name])
      for (const name of ['learning_reading_texts.sitov_pronunciation_readiness_bounds', 'learning_reading_texts.sitov_pretest_released_read', 'learning_units.sitov_pretest_released_unit']) {
        assert.doesNotMatch(after[name], /current_pass\(id\)|unit_has_current_pass\(/)
      }
      const grants = (await db.query(`SELECT p.proname,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sitov_pronunciation_private' AND p.proname LIKE 'sitov_current_pass_%' ORDER BY 1`)).rows
      assert.deepEqual(grants.map(row => [row.proname, row.anon, row.authenticated]), [['sitov_current_pass_text_ids', false, true], ['sitov_current_pass_unit_ids', false, true]])
    })
    await t.test('a new pass, a replaced test and a withdrawn right take effect at once', async () => {
      await db.query('INSERT INTO sitov_pronunciation_private.pretest_passes VALUES($1,$2)', [fresh, definition.third])
      await actor(fresh)
      assert.deepEqual((await db.query('SELECT id::text k FROM public.learning_reading_texts')).rows.map(row => row.k), [text.third])
      await db.exec('RESET ROLE')
      await db.query('UPDATE sitov_pronunciation_private.pretest_definitions SET active=false WHERE id=$1', [definition.third])
      await actor(fresh)
      assert.deepEqual((await db.query('SELECT id FROM public.learning_reading_texts')).rows, [])
      assert.deepEqual((await db.query('SELECT id FROM public.learning_units')).rows, [])
      await db.exec('RESET ROLE')
      await db.query('UPDATE sitov_pronunciation_private.pretest_definitions SET active=true WHERE id=$1', [definition.third])
      await db.query('INSERT INTO sitov_access_private.test_denied VALUES($1,$2)', [fresh, text.third])
      await actor(fresh)
      assert.deepEqual((await db.query('SELECT id FROM public.learning_reading_texts')).rows, [])
      await db.exec('RESET ROLE')
      await db.query('DELETE FROM sitov_access_private.test_denied WHERE student_id=$1', [fresh])
      await db.query('DELETE FROM sitov_pronunciation_private.pretest_passes WHERE student_id=$1', [fresh])
    })
    await t.test('replay is idempotent and the rollback restores the per-row policies with the same result', async () => {
      await db.exec(migration)
      assert.deepEqual(await snapshot(), before)
      await db.exec(rollback)
      assert.deepEqual(await policies(), policiesBefore)
      assert.deepEqual(await snapshot(), before)
      await db.exec(migration)
      assert.deepEqual(await snapshot(), before)
    })
  } finally { await db.close() }
})
