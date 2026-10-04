import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const teacher='00000000-0000-4000-8000-000000000001'
const student='00000000-0000-4000-8000-000000000002'
const sql=await readFile(new URL('../vps/80_sitov_staff_mfa.sql',import.meta.url),'utf8')

test('mandatory staff MFA guards RLS, Storage, SECURITY DEFINER REST calls and profile flag changes',async()=>{
  const db=new PGlite()
  async function actor(user,aal='aal1',path='/people',method='GET') {
    await db.exec('RESET ROLE')
    await db.query("SELECT set_config('request.jwt.claims',$1,false),set_config('request.path',$2,false),set_config('request.method',$3,false)",[JSON.stringify({sub:user,role:'authenticated',aal}),path,method])
    await db.exec('SET ROLE authenticated')
  }
  try {
    await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE authenticator;
      CREATE SCHEMA auth;CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb,'{}') $$;
      CREATE TABLE auth.mfa_factors(user_id uuid,factor_type text,status text);
      CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text);ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
      CREATE TABLE public.people(id uuid PRIMARY KEY,name text);ALTER TABLE people ENABLE ROW LEVEL SECURITY;
      CREATE TABLE storage.objects(id uuid PRIMARY KEY);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      CREATE TABLE storage.buckets(id text PRIMARY KEY);ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
      CREATE POLICY sitov_existing ON profiles TO authenticated USING(true) WITH CHECK(true);
      CREATE POLICY sitov_existing ON people TO authenticated USING(true) WITH CHECK(true);
      CREATE POLICY sitov_existing ON storage.objects TO authenticated USING(true) WITH CHECK(true);
      CREATE POLICY sitov_existing ON storage.buckets TO authenticated USING(true) WITH CHECK(true);
      GRANT USAGE ON SCHEMA auth,storage TO authenticated;
      GRANT SELECT,UPDATE ON profiles TO authenticated;GRANT SELECT ON people,storage.objects,storage.buckets TO authenticated;
      INSERT INTO profiles VALUES('${teacher}','teacher'),('${student}','student');
      INSERT INTO people VALUES('${student}','Student');INSERT INTO storage.objects VALUES('${student}');INSERT INTO storage.buckets VALUES('pronunciation_audio');`)
    await db.exec(sql);await db.exec(sql)
    // Staged deployment does not alter access before verification/enforcement.
    await actor(teacher)
    assert.equal((await db.query('SELECT count(*)::int n FROM people')).rows[0].n,1)
    await assert.rejects(db.query('SELECT sitov_enable_staff_mfa()'),e=>e.code==='42501')
    await assert.rejects(db.query("UPDATE profiles SET sitov_mfa_required=true WHERE id=$1",[teacher]),e=>e.code==='42501')
    await db.exec('RESET ROLE')
    await db.query("INSERT INTO auth.mfa_factors VALUES($1,'totp','verified')",[teacher])
    await actor(teacher,'aal2','/rpc/sitov_enable_staff_mfa','POST')
    assert.equal((await db.query('SELECT sitov_enable_staff_mfa() enabled')).rows[0].enabled,true)
    assert.equal((await db.query('SELECT count(*)::int n FROM people')).rows[0].n,1)
    // A newly signed-in session cannot reach API data or privileged RPCs.
    await actor(teacher,'aal1','/rpc/legacy_admin_function','POST')
    await assert.rejects(db.query('SELECT sitov_security_private.sitov_pre_request()'),e=>e.code==='42501')
    assert.equal((await db.query('SELECT count(*)::int n FROM people')).rows[0].n,0)
    assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects')).rows[0].n,0)
    assert.equal((await db.query('SELECT count(*)::int n FROM storage.buckets')).rows[0].n,0)
    assert.deepEqual((await db.query('SELECT id FROM profiles')).rows,[{id:teacher}])
    await actor(teacher,'aal1','/profiles')
    await db.query('SELECT sitov_security_private.sitov_pre_request()')
    await actor(teacher,'aal1','/rpc/sitov_staff_mfa_status','POST')
    await db.query('SELECT sitov_security_private.sitov_pre_request()')
    assert.deepEqual((await db.query('SELECT sitov_staff_mfa_status() state')).rows[0].state,{required:true,satisfied:false})
    await actor(teacher,'aal2')
    await db.query('SELECT sitov_security_private.sitov_pre_request()')
    await assert.rejects(db.query('UPDATE profiles SET sitov_mfa_required=false WHERE id=$1',[teacher]),e=>e.code==='42501')
    // A removed factor invalidates even a still-unexpired aal2 JWT.
    await db.exec('RESET ROLE');await db.query('DELETE FROM auth.mfa_factors WHERE user_id=$1',[teacher])
    await actor(teacher,'aal2')
    await assert.rejects(db.query('SELECT sitov_security_private.sitov_pre_request()'),e=>e.code==='42501')
    // Learner access remains governed by the original policies.
    await actor(student)
    await db.query('SELECT sitov_security_private.sitov_pre_request()')
    assert.equal((await db.query('SELECT count(*)::int n FROM people')).rows[0].n,1)
    // Recovery is available to the database operator independently of Auth.
    await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claims','{}',false)")
    await db.query('UPDATE profiles SET sitov_mfa_required=false WHERE id=$1',[teacher])
    await actor(teacher)
    await db.query('SELECT sitov_security_private.sitov_pre_request()')
    await db.exec('RESET ROLE')
    await db.query("SELECT set_config('request.jwt.claims','{}',false)")
    await db.query("INSERT INTO profiles VALUES('00000000-0000-4000-8000-000000000003','admin',false)")
    assert.equal((await db.query("SELECT sitov_mfa_required flag FROM profiles WHERE id='00000000-0000-4000-8000-000000000003'")).rows[0].flag,true)
    await db.query("UPDATE profiles SET role='teacher' WHERE id=$1",[student])
    assert.equal((await db.query('SELECT sitov_mfa_required flag FROM profiles WHERE id=$1',[student])).rows[0].flag,true)
    const dbName=(await db.query('SELECT current_database() name')).rows[0].name.replaceAll('"','""')
    await db.exec(`ALTER ROLE authenticator IN DATABASE "${dbName}" SET pgrst.db_pre_request='other.pre_request'`)
    await assert.rejects(db.exec(sql),/Existing PostgREST pre-request hook/)
  } finally { await db.close() }
})
