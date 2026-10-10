import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const read = name => readFile(new URL(name, import.meta.url), 'utf8')
const [pretests, migration, canonical, rollback] = await Promise.all([
  read('../vps/94_sitov_pronunciation_pretests.sql'), read('../vps/121_sitov_pretest_publication_marks.sql'),
  read('../migrations/20261010193000_sitov_pretest_publication_marks.sql'), read('../vps/rollback/121_sitov_pretest_publication_marks.sql'),
])
const statement = start => {
  const from = pretests.indexOf(start)
  assert.ok(from >= 0, start)
  return pretests.slice(from, pretests.indexOf(';\n', from) + 1)
}
// current_pretest() and its hash helper exactly as migration 94 defines them.
const original = ['CREATE OR REPLACE FUNCTION sitov_pronunciation_private.pretest_hash(', 'CREATE OR REPLACE FUNCTION sitov_pronunciation_private.current_pretest('].map(statement)

const text = { first: uid(201), second: uid(202), third: uid(203) }
const definition = { first: uid(301), second: uid(302), third: uid(303), inactive: uid(304) }
const audio = name => `sitov-qwen-v1/de/${name.repeat(64).slice(0, 64)}.mp3`
const hash = "encode(sha256(convert_to($1,'UTF8')),'hex')"

// The complete proof is replaced by a switch per definition, so the test can tell
// a remembered publication from one that was proved again.
const fixture = `
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE storage_writer;
 CREATE SCHEMA storage; CREATE SCHEMA sitov_pronunciation_private;
 CREATE TABLE storage.objects(id serial PRIMARY KEY,bucket_id text NOT NULL,name text NOT NULL,user_metadata jsonb,UNIQUE(bucket_id,name));
 GRANT USAGE ON SCHEMA storage TO storage_writer; GRANT ALL ON storage.objects TO storage_writer;
 CREATE TABLE learning_reading_texts(id uuid PRIMARY KEY,sentence_de text NOT NULL,audio_url text,focus text);
 CREATE TABLE sitov_pronunciation_private.pretest_definitions(id uuid PRIMARY KEY,text_id uuid NOT NULL,text_version text NOT NULL,test_version text NOT NULL DEFAULT repeat('a',64),definition jsonb NOT NULL DEFAULT '{}',active boolean NOT NULL DEFAULT false);
 CREATE TABLE sitov_pronunciation_private.pretest_question_audio_proofs(definition_id uuid NOT NULL,path text NOT NULL);
 CREATE TABLE sitov_pronunciation_private.pretest_approvals(definition_id uuid NOT NULL,reference_bucket text NOT NULL,reference_path text NOT NULL);
 CREATE TABLE sitov_pronunciation_private.test_proof(definition_id uuid PRIMARY KEY,holds boolean NOT NULL);
 CREATE FUNCTION sitov_pronunciation_private.publication_ready(p_id uuid,p_text uuid,p_text_version text,p_test_version text,d jsonb) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER AS $$
  SELECT coalesce((SELECT holds FROM sitov_pronunciation_private.test_proof WHERE definition_id=p_id),false) $$;
 -- guard_definition() of migration 94: an active row needs the complete proof.
 CREATE FUNCTION sitov_pronunciation_private.guard_definition() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.active AND NOT sitov_pronunciation_private.publication_ready(NEW.id,NEW.text_id,NEW.text_version,NEW.test_version,NEW.definition) THEN RAISE EXCEPTION 'pretest_publication_proof_required';END IF;RETURN NEW;END $$;
 CREATE TRIGGER sitov_pretest_definition_guard BEFORE INSERT OR UPDATE ON sitov_pronunciation_private.pretest_definitions FOR EACH ROW EXECUTE FUNCTION sitov_pronunciation_private.guard_definition();
 INSERT INTO storage.objects(bucket_id,name,user_metadata) VALUES('audio_cache','${audio('a')}','{"v":1}'),('audio_cache','${audio('b')}','{"v":1}'),('audio_cache','${audio('c')}','{"v":1}'),
  ('audio_cache','${audio('d')}','{"v":1}'),('pronunciation_audio','teacher/reference.webm','{"v":1}'),('course_assets','${audio('a')}','{"v":1}');
 INSERT INTO learning_reading_texts VALUES('${text.first}','Guten Tag.',NULL,NULL),('${text.second}','Ich lerne Deutsch.',NULL,NULL),('${text.third}','Wir trinken Tee.',NULL,NULL);
 INSERT INTO sitov_pronunciation_private.test_proof VALUES('${definition.first}',true),('${definition.second}',true),('${definition.third}',true),('${definition.inactive}',true);
`

test('121 remembers a proved publication until one of its inputs changes', async t => {
  const db = new PGlite()
  const current = async id => (await db.query('SELECT (sitov_pronunciation_private.current_pretest($1)).id::text id', [id])).rows[0].id
  const marks = async () => (await db.query('SELECT definition_id::text id FROM sitov_pronunciation_private.sitov_publication_marks ORDER BY 1')).rows.map(row => row.id)
  const proof = (id, holds) => db.query('UPDATE sitov_pronunciation_private.test_proof SET holds=$2 WHERE definition_id=$1', [id, holds])
  const all = async () => Object.fromEntries(await Promise.all(Object.entries(text).map(async ([name, id]) => [name, await current(id)])))
  try {
    await db.exec(fixture); await db.exec(original.join('\n'))
    for (const [name, id] of Object.entries({ first: text.first, second: text.second, third: text.third, inactive: text.third })) {
      await db.query(`INSERT INTO sitov_pronunciation_private.pretest_definitions(id,text_id,text_version,active) VALUES($1,$2,(SELECT ${hash.replace('$1', 'sentence_de')} FROM learning_reading_texts WHERE id=$2),$3)`, [definition[name], id, name !== 'inactive'])
    }
    await db.query('INSERT INTO sitov_pronunciation_private.pretest_question_audio_proofs VALUES($1,$2),($1,$3),($4,$3),($5,$6)', [definition.first, audio('a'), audio('b'), definition.second, definition.third, audio('c')])
    await db.query("INSERT INTO sitov_pronunciation_private.pretest_approvals VALUES($1,'audio_cache',$2),($3,'pronunciation_audio','teacher/reference.webm'),($4,'audio_cache',$5)", [definition.first, audio('d'), definition.second, definition.third, audio('c')])
    const before = await all()
    assert.deepEqual(before, { first: definition.first, second: definition.second, third: definition.third })

    assert.equal(migration, canonical)
    await db.exec(migration)
    await t.test('every active proved definition is marked and the answer is unchanged', async () => {
      assert.deepEqual(await marks(), [definition.first, definition.second, definition.third])
      assert.deepEqual(await all(), before)
    })
    await t.test('a mark is trusted without proving again; without a mark the complete proof decides', async () => {
      await proof(definition.first, false)
      assert.equal(await current(text.first), definition.first)
      await db.query('DELETE FROM sitov_pronunciation_private.sitov_publication_marks WHERE definition_id=$1', [definition.first])
      assert.equal(await current(text.first), null)
      await proof(definition.first, true)
      assert.equal(await current(text.first), definition.first)
      assert.equal((await db.query('SELECT sitov_pronunciation_private.sitov_mark_publications() n')).rows[0].n, 1)
      assert.deepEqual(await marks(), [definition.first, definition.second, definition.third])
    })
    await t.test('changing or removing a referenced audio object ends exactly the affected marks', async () => {
      await db.exec('SET ROLE storage_writer')
      await db.query("UPDATE storage.objects SET user_metadata='{\"v\":2}' WHERE bucket_id='course_assets'")
      await db.exec('RESET ROLE')
      assert.deepEqual(await marks(), [definition.first, definition.second, definition.third])
      await db.exec('SET ROLE storage_writer')
      await db.query("UPDATE storage.objects SET user_metadata='{\"v\":2}' WHERE bucket_id='audio_cache' AND name=$1", [audio('b')])
      await db.exec('RESET ROLE')
      assert.deepEqual(await marks(), [definition.third])
      // The complete proof now decides again and may still hold.
      assert.equal(await current(text.first), definition.first)
      await proof(definition.second, false)
      assert.equal(await current(text.second), null)
      await proof(definition.second, true)
      assert.equal((await db.query('SELECT sitov_pronunciation_private.sitov_mark_publications() n')).rows[0].n, 2)
      await db.exec('SET ROLE storage_writer')
      await db.query("DELETE FROM storage.objects WHERE bucket_id='pronunciation_audio' AND name='teacher/reference.webm'")
      await db.exec('RESET ROLE')
      assert.deepEqual(await marks(), [definition.first, definition.third])
      await db.exec('SET ROLE storage_writer')
      await db.query("UPDATE storage.objects SET name='moved.mp3' WHERE bucket_id='audio_cache' AND name=$1", [audio('d')])
      await db.exec('RESET ROLE')
      assert.deepEqual(await marks(), [definition.third])
      assert.equal((await db.query('SELECT sitov_pronunciation_private.sitov_mark_publications() n')).rows[0].n, 2)
    })
    await t.test('a changed reading text, a deactivation and a new activation keep the marks truthful', async () => {
      await db.query("UPDATE learning_reading_texts SET focus='Tee' WHERE id=$1", [text.third])
      assert.deepEqual(await marks(), [definition.first, definition.second])
      assert.equal(await current(text.third), definition.third)
      await db.query("UPDATE learning_reading_texts SET sentence_de='Wir trinken Kaffee.' WHERE id=$1", [text.third])
      assert.equal(await current(text.third), null)
      await db.query("UPDATE learning_reading_texts SET sentence_de='Wir trinken Tee.' WHERE id=$1", [text.third])
      assert.equal((await db.query('SELECT sitov_pronunciation_private.sitov_mark_publications() n')).rows[0].n, 1)
      await db.query('UPDATE sitov_pronunciation_private.pretest_definitions SET active=false WHERE id=$1', [definition.third])
      assert.deepEqual(await marks(), [definition.first, definition.second])
      assert.equal(await current(text.third), null)
      await proof(definition.inactive, false)
      await assert.rejects(db.query('UPDATE sitov_pronunciation_private.pretest_definitions SET active=true WHERE id=$1', [definition.inactive]), /pretest_publication_proof_required/)
      assert.deepEqual(await marks(), [definition.first, definition.second])
      await proof(definition.inactive, true)
      await db.query('UPDATE sitov_pronunciation_private.pretest_definitions SET active=true WHERE id=$1', [definition.inactive])
      assert.deepEqual(await marks(), [definition.first, definition.second, definition.inactive])
      assert.equal(await current(text.third), definition.inactive)
    })
    await t.test('marks and helpers are closed to API roles', async () => {
      const closed = (await db.query(`SELECT bool_or(has_table_privilege(r,'sitov_pronunciation_private.sitov_publication_marks','SELECT')) t,
        bool_or(has_function_privilege(r,'sitov_pronunciation_private.sitov_mark_publications()','EXECUTE')) f FROM unnest(ARRAY['anon','authenticated','service_role']) r`)).rows[0]
      assert.deepEqual(closed, { t: false, f: false })
    })
    await t.test('replay proves everything again and the rollback restores the complete proof on every read', async () => {
      await proof(definition.first, false)
      await db.exec(migration)
      assert.deepEqual(await marks(), [definition.second, definition.inactive])
      assert.equal(await current(text.first), null)
      await proof(definition.first, true)
      await db.exec(rollback)
      assert.equal((await db.query("SELECT to_regclass('sitov_pronunciation_private.sitov_publication_marks') r")).rows[0].r, null)
      assert.equal((await db.query("SELECT count(*)::int n FROM pg_trigger WHERE tgname LIKE 'sitov_publication_%'")).rows[0].n, 0)
      assert.deepEqual(await all(), { first: definition.first, second: definition.second, third: definition.inactive })
      await proof(definition.second, false)
      assert.equal(await current(text.second), null)
      await proof(definition.second, true)
      await db.exec(migration)
      assert.deepEqual(await marks(), [definition.first, definition.second, definition.inactive])
    })
  } finally { await db.close() }
})
