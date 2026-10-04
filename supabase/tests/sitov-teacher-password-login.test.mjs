import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const teacher='00000000-0000-4000-8000-000000000001'
const admin='00000000-0000-4000-8000-000000000002'
const student='00000000-0000-4000-8000-000000000003'
const old=await readFile(new URL('../vps/80_sitov_staff_mfa.sql',import.meta.url),'utf8')
const revised=await readFile(new URL('../vps/83_sitov_teacher_password_login.sql',import.meta.url),'utf8')

test('teacher password access restores existing data rights while admin MFA and promotion protection remain',async()=>{
 const db=new PGlite()
 async function actor(user,aal='aal1',path='/rpc/private_staff_work',method='POST') {
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('request.jwt.claims',$1,false),set_config('request.path',$2,false),set_config('request.method',$3,false)",[JSON.stringify({sub:user,role:'authenticated',aal}),path,method])
  await db.exec('SET ROLE authenticated')
 }
 async function operator() {
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('request.jwt.claims','{}',false)")
 }
 try {
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE authenticator;
   CREATE SCHEMA auth;CREATE SCHEMA storage;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
   CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb,'{}') $$;
   CREATE TABLE auth.mfa_factors(user_id uuid,factor_type text,status text);
   CREATE TABLE profiles(id uuid PRIMARY KEY,role text);ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   CREATE TABLE people(id uuid PRIMARY KEY);ALTER TABLE people ENABLE ROW LEVEL SECURITY;
   CREATE TABLE storage.objects(id uuid PRIMARY KEY);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
   CREATE TABLE storage.buckets(id text PRIMARY KEY);ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
   CREATE POLICY existing ON profiles TO authenticated USING(true) WITH CHECK(true);
   CREATE POLICY existing ON people TO authenticated USING(true) WITH CHECK(true);
   CREATE POLICY existing ON storage.objects TO authenticated USING(true) WITH CHECK(true);
   CREATE POLICY existing ON storage.buckets TO authenticated USING(true) WITH CHECK(true);
   GRANT USAGE ON SCHEMA auth,storage TO authenticated;
   GRANT SELECT ON people,storage.objects,storage.buckets TO authenticated;`)
  await db.exec(`GRANT SELECT ON profiles TO authenticated;
   INSERT INTO profiles VALUES('${teacher}','teacher'),('${admin}','admin'),('${student}','student');
   INSERT INTO people VALUES('${student}');INSERT INTO storage.objects VALUES('${student}');INSERT INTO storage.buckets VALUES('pronunciation_audio');`)
  await db.exec(old)
  await operator()
  await db.exec(`UPDATE profiles SET sitov_mfa_required=true WHERE role IN('teacher','admin');
   INSERT INTO auth.mfa_factors VALUES('${teacher}','totp','verified'),('${admin}','totp','verified');`)
  await actor(teacher)
  await assert.rejects(db.query('SELECT sitov_security_private.sitov_pre_request()'),e=>e.code==='42501')
  await operator();await db.exec(revised);await db.exec(revised)
  await db.exec('GRANT UPDATE(sitov_mfa_required) ON profiles TO authenticated')
  await actor(teacher)
  await db.query('SELECT sitov_security_private.sitov_pre_request()')
  assert.deepEqual((await db.query('SELECT sitov_staff_mfa_status() state')).rows[0].state,{required:false,satisfied:true})
  for(const table of ['people','storage.objects','storage.buckets'])assert.equal((await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,1)
  await db.query('UPDATE profiles SET sitov_mfa_required=true WHERE id=$1',[teacher])
  assert.equal((await db.query('SELECT sitov_mfa_required flag FROM profiles WHERE id=$1',[teacher])).rows[0].flag,false)
  await assert.rejects(db.query("UPDATE profiles SET role='admin' WHERE id=$1",[teacher]),e=>e.code==='42501')
  await actor(teacher,'aal2')
  await assert.rejects(db.query('SELECT sitov_enable_staff_mfa()'),e=>e.code==='42501')
  await actor(admin)
  await assert.rejects(db.query('SELECT sitov_security_private.sitov_pre_request()'),e=>e.code==='42501')
  for(const table of ['people','storage.objects','storage.buckets'])assert.equal((await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,0)
  await actor(admin,'aal2')
  await db.query('SELECT sitov_security_private.sitov_pre_request()')
  await assert.rejects(db.query('UPDATE profiles SET sitov_mfa_required=false WHERE id=$1',[admin]),e=>e.code==='42501')
  assert.equal((await db.query('SELECT sitov_enable_staff_mfa() enabled')).rows[0].enabled,true)
  await operator()
  // An explicit false cannot weaken a promotion from teacher to administrator.
  await db.query("UPDATE profiles SET role='admin',sitov_mfa_required=false WHERE id=$1",[teacher])
  assert.equal((await db.query('SELECT sitov_mfa_required flag FROM profiles WHERE id=$1',[teacher])).rows[0].flag,true)
  await db.query("UPDATE profiles SET role='teacher' WHERE id=$1",[teacher])
  assert.equal((await db.query('SELECT sitov_mfa_required flag FROM profiles WHERE id=$1',[teacher])).rows[0].flag,false)
  await db.query("UPDATE profiles SET role='teacher',sitov_mfa_required=true WHERE id=$1",[student])
  assert.equal((await db.query('SELECT sitov_mfa_required flag FROM profiles WHERE id=$1',[student])).rows[0].flag,false)
  await db.exec("INSERT INTO profiles VALUES('00000000-0000-4000-8000-000000000004','teacher',true),('00000000-0000-4000-8000-000000000005','admin',false)")
  assert.deepEqual((await db.query("SELECT role,sitov_mfa_required FROM profiles WHERE id IN('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000005') ORDER BY role")).rows,[{role:'admin',sitov_mfa_required:true},{role:'teacher',sitov_mfa_required:false}])
  assert.equal((await db.query('SELECT count(*)::int n FROM auth.mfa_factors')).rows[0].n,2)
 } finally {await db.close()}
})
