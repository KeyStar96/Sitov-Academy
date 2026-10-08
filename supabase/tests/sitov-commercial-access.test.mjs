import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const student = uid(1), teacher = uid(2), outsider = uid(3), unit = uid(10), first = uid(20), second = uid(21)
const migration = await readFile(new URL('../vps/93_sitov_commercial_access.sql', import.meta.url), 'utf8')
// Deliberately scoped normalized catalog fixture. This is NOT the full 01–92 release proof.
const fixture = `
 CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE SCHEMA media_private;CREATE SCHEMA sitov_verb_private;CREATE SCHEMA trainer_access_private;CREATE SCHEMA learning_private;CREATE SCHEMA auth; CREATE SCHEMA identity_private; CREATE SCHEMA sitov_security_private;
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
 INSERT INTO profiles VALUES('${student}','student','de'),('${teacher}','teacher','de'),('${outsider}','student','ru');
 INSERT INTO learning_units(id,level,trainer) VALUES('${unit}','A1.1','pronunciation');
 INSERT INTO learning_reading_texts VALUES('${first}','${unit}'),('${second}','${unit}');
 `
test('93 additive commercial core on isolated normalized catalog slice', async t => {
  const db = new PGlite()
  const actor = async id => { await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec('SET ROLE authenticated') }
  const value = async (sql, args = []) => (await db.query(sql, args)).rows[0].result
  const allows = async id => value('SELECT sitov_access_private.item_allowed($1,\'reading_text\',$2) result', [student, id])
  const vip = async (enabled, rev) => value('SELECT set_sitov_student_vip($1,$2,$3) result', [student, enabled, rev])
  const trial = refs => ({ version: 1, rules: [{ level: 'A1.1', trainer: 'pronunciation', unit_ids: [unit], items: [{ unit_id: unit, refs }] }] })
  try {
    await db.exec(fixture)
    await db.exec(migration)
    await t.test('disabled checkout never creates an order or entitlement; enable truthfully fails', async () => {
      await actor(student)
      assert.equal((await value('SELECT start_sitov_checkout($1,$2) result', ['A1.1', uid(80)])).error, 'payment_disabled')
      assert.equal((await value('SELECT set_sitov_billing_enabled(true,0) result')).error, 'forbidden')
      await actor(teacher)
      assert.equal((await value('SELECT set_sitov_billing_enabled(true,0) result')).error, 'provider_not_configured')
      await db.exec('RESET ROLE'); assert.equal((await db.query('SELECT count(*)::int n FROM sitov_access_private.orders')).rows[0].n, 0)
    })
    await t.test('selfgrant/direct private REST-equivalent DML denied and staff MFA honored', async () => {
      await actor(student); assert.equal((await vip(true, 0)).error, 'forbidden')
      await assert.rejects(db.query('UPDATE sitov_access_private.students SET vip_enabled=true'), e => e.code === '42501')
      await actor(teacher); await db.query("SELECT set_config('sitov.test_mfa','no',false)")
      assert.equal((await vip(true, 0)).error, 'forbidden'); await db.query("SELECT set_config('sitov.test_mfa','yes',false)")
    })
    await t.test('VIP is student-only, language neutral, revision-safe, immediately revocable', async () => {
      await actor(teacher); assert.equal((await vip(true, 0)).revision, 1)
      assert.equal((await vip(false, 0)).error, 'revision_conflict')
      await actor(student); assert.equal(await allows(first), true)
      assert.equal(await allows(uid(999)), false)
      await actor(outsider); assert.equal(await allows(first), false)
      await actor(teacher); assert.equal((await vip(false, 1)).revision, 2)
      await actor(student); assert.equal(await allows(first), false)
      await db.exec('RESET ROLE'); assert.equal((await db.query('SELECT role FROM profiles WHERE id=$1', [student])).rows[0].role, 'student')
    })
    await t.test('trial exact item/all/none semantics and canonical ID validation', async () => {
      await actor(teacher)
      let revision = 2
      for (const [refs, expected] of [[[{ kind: 'reading_text', id: first }], true], [[], false], [null, true]]) {
        assert.equal((await value('SELECT set_sitov_student_trial($1,$2,$3) result', [student, trial(refs), revision++])).success, true)
        await actor(student); assert.equal(await allows(first), expected)
        if (Array.isArray(refs) && refs.length) assert.equal(await allows(second), false)
        await actor(teacher)
      }
      assert.equal((await value('SELECT set_sitov_student_trial($1,$2,$3) result', [student, trial([{ kind: 'reading_text', id: uid(999) }]), revision])).error, 'invalid_input')
      assert.equal((await value('SELECT set_sitov_student_trial($1,$2,$3) result', [student, { version: 1, rules: [{ level: null, trainer: null, unit_ids: null, items: null }] }, revision])).error, 'invalid_input')
      await db.exec('RESET ROLE'); assert.equal((await db.query('SELECT count(*)::int n FROM student_level_access')).rows[0].n, 0)
    })
    await t.test('manual scope preserved and migration reapplication never resets settings or selections', async () => {
      await db.exec('RESET ROLE')
      await db.query("INSERT INTO student_level_access VALUES($1,'A1.1')", [student])
      await db.query("INSERT INTO learning_trainer_grants VALUES($1,'A1.1','pronunciation',true,'selected')", [student])
      await db.query("INSERT INTO learning_unit_grants VALUES($1,'A1.1','pronunciation',$2)", [student, unit])
      const snapshot = (await db.query('SELECT * FROM learning_trainer_grants')).rows
      await actor(teacher); await value('SELECT set_sitov_student_trial($1,$2,5) result', [student, { version: 1, rules: [] }])
      await value('SELECT set_sitov_billing_enabled(false,0) result')
      await db.exec('RESET ROLE'); await db.exec(migration)
      assert.deepEqual((await db.query('SELECT * FROM learning_trainer_grants')).rows, snapshot)
      assert.equal((await db.query('SELECT revision FROM sitov_access_private.billing_settings')).rows[0].revision, 1)
      await actor(student); assert.equal(await allows(first), true)
    })
    await t.test('pending or provider-none mock orders cannot grant; independent verified purchase survives revocation/off', async () => {
      await db.exec('RESET ROLE')
      await db.query("UPDATE learning_trainer_grants SET enabled=false WHERE auth_user_id=$1", [student])
      const order = uid(90)
      await db.query("INSERT INTO sitov_access_private.orders(id,student_id,level,request_id,status,provider,amount_minor,currency) VALUES($1,$2,'A1.1',$3,'pending','stripe',100,'EUR')", [order, student, uid(91)])
      await db.query('INSERT INTO sitov_access_private.purchases(order_id) VALUES($1)', [order])
      await actor(student); assert.equal(await allows(first), false)
      await assert.rejects(db.query("UPDATE sitov_access_private.orders SET status='paid',provider_confirmation_verified=true"), e => e.code === '42501')
      await db.exec('RESET ROLE')
      await assert.rejects(db.query("UPDATE sitov_access_private.orders SET provider='none',provider_confirmation_verified=true WHERE id=$1", [order]), e => e.code === '23514')
      // Trusted owner fixture stands in for a future verified provider event, never a runtime adapter.
      await db.query("UPDATE sitov_access_private.orders SET status='paid',provider_confirmation_verified=true WHERE id=$1", [order])
      await actor(student); assert.equal(await allows(first), true)
      assert.equal((await value('SELECT start_sitov_checkout($1,$2) result', ['A1.1', uid(92)])).error, 'payment_disabled')
      assert.deepEqual((await value('SELECT get_sitov_access_context() result')).purchased_levels, ['A1.1'])
    })
    await t.test('guarded rollback refuses changed rights; pristine rollback is reversible', async () => {
      const rollback = await readFile(new URL('../vps/rollback/93_sitov_commercial_access.sql', import.meta.url), 'utf8')
      await db.exec('RESET ROLE')
      await assert.rejects(db.exec(rollback), /sitov_commercial_rollback_requires_preserved_grants/)
      const pristine = new PGlite()
      try {
        await pristine.exec(fixture); await pristine.exec(migration); await pristine.exec(rollback)
        assert.equal((await pristine.query("SELECT to_regnamespace('sitov_access_private')::text ns")).rows[0].ns, null)
        await pristine.exec(migration)
      } finally { await pristine.close() }
    })
  } finally { await db.close() }
})
