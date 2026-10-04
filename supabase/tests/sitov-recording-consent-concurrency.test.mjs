// Disposable local PostgreSQL cluster, Unix socket only; no production access.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'

const detected = spawnSync('pg_config', ['--bindir'], { encoding: 'utf8' }).stdout?.trim()
const bin = process.env.SITOV_RECORDING_POSTGRES_BIN || detected
const available = bin && ['postgres', 'initdb', 'pg_ctl', 'psql'].every(name => existsSync(join(bin, name))) && process.getuid?.() !== 0
const migration = await readFile(new URL('../vps/84_sitov_online_recording_requirement.sql', import.meta.url), 'utf8')
const proofSql = migration.slice(migration.indexOf('-- Normalize the frozen'), migration.indexOf('CREATE OR REPLACE FUNCTION public.submit_business_registration('))
const user = '00000000-0000-4000-8000-000000000001', person = '00000000-0000-4000-8000-000000000002'
const booking = '00000000-0000-4000-8000-000000000003', course = '00000000-0000-4000-8000-000000000004'
function run(name, args, input = '') {
 return new Promise((resolve, reject) => {
  const child = spawn(join(bin, name), args, { stdio: ['pipe', 'pipe', 'pipe'] })
  let stdout = '', stderr = ''
  child.stdout.on('data', data => { stdout += data }); child.stderr.on('data', data => { stderr += data })
  child.on('error', reject); child.on('close', code => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }))
  child.stdin.end(input)
 })
}

test('real PostgreSQL serializes the last rolling-window and daily recording approval slots', {
 skip: available ? false : 'Local PostgreSQL server tools unavailable; PGlite proof/guard tests still run', timeout: 30000,
}, async t => {
 const root = await mkdtemp('/tmp/sitov-recording-race-'), data = join(root, 'data'), socket = join(root, 'socket')
 let started = false
 try {
  await mkdir(socket)
  let result = await run('initdb', ['-D', data, '-U', 'sitov_test_owner', '-A', 'trust', '--no-locale'])
  assert.equal(result.code, 0, result.stderr)
  result = await run('pg_ctl', ['-D', data, '-l', join(root, 'server.log'), '-o', `-k ${socket} -h '' -p 65433`, '-w', 'start'])
  assert.equal(result.code, 0, result.stderr); started = true
  const sql = input => run('psql', ['-XAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-h', socket, '-p', '65433', '-U', 'sitov_test_owner', '-d', 'postgres'], input)
  const ok = async input => { const output = await sql(input); assert.equal(output.code, 0, output.stderr); return output.stdout }
  await ok(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
   CREATE SCHEMA auth;CREATE SCHEMA business_private;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   CREATE TABLE auth.users(id uuid PRIMARY KEY);
   CREATE TABLE people(id uuid PRIMARY KEY,auth_user_id uuid REFERENCES auth.users(id));
   CREATE TABLE bookings(id uuid PRIMARY KEY,person_id uuid REFERENCES people(id),kind text,recording_accepted boolean);
   CREATE TABLE courses(id uuid PRIMARY KEY,type text,category text);
   CREATE TABLE booking_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),booking_id uuid REFERENCES bookings(id),course_id uuid REFERENCES courses(id),title_snapshot text);
   GRANT USAGE ON SCHEMA auth,business_private TO authenticated,service_role;
   INSERT INTO auth.users VALUES('${user}');INSERT INTO people VALUES('${person}','${user}');
   INSERT INTO bookings VALUES('${booking}','${person}','monthly',true);
   INSERT INTO courses VALUES('${course}','online','online');
   INSERT INTO booking_items(booking_id,course_id,title_snapshot) VALUES('${booking}','${course}','Frozen course title');
   BEGIN;${proofSql}COMMIT;
   CREATE FUNCTION public.sitov_test_record_monthly() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
    BEGIN PERFORM business_private.sitov_record_recording_consent('${booking}','de','monthly'); END $$;
   REVOKE ALL ON FUNCTION public.sitov_test_record_monthly() FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.sitov_test_record_monthly() TO authenticated;`)
  const approval = `SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${user}',false);SELECT public.sitov_test_record_monthly();`
  const race = async () => {
   const first = sql(`SET application_name='sitov_recording_first';BEGIN;${approval}SELECT pg_sleep(0.5);COMMIT;`)
   let sleeping = false
   for (let attempt = 0; attempt < 30; attempt++) {
    if (await ok("SELECT count(*) FROM pg_stat_activity WHERE application_name='sitov_recording_first' AND wait_event='PgSleep'") === '1') { sleeping = true; break }
    await new Promise(resolve => setTimeout(resolve, 10))
   }
   assert.equal(sleeping, true, 'The first transaction holds the last quota slot until commit')
   const results = await Promise.all([first, sql(approval)])
   assert.equal(results[0].code, 0, results[0].stderr)
   assert.notEqual(results[1].code, 0, 'The second concurrent approval must be rejected')
   assert.match(results[1].stderr, /PT429.*sitov_recording_monthly_limit/)
  }
  await t.test('the second committed approval cannot take the eleventh rolling-window slot', async () => {
   await ok(`INSERT INTO business_private.sitov_recording_monthly_usage(actor_id,day,day_writes,recent_writes)
    VALUES('${user}',(clock_timestamp() AT TIME ZONE 'UTC')::date,9,array_fill(clock_timestamp(),ARRAY[9]));`)
   await race()
   assert.equal(await ok('SELECT day_writes||\':\'||cardinality(recent_writes) FROM business_private.sitov_recording_monthly_usage'), '10:10')
   assert.equal(await ok('SELECT count(*) FROM business_private.sitov_recording_consents'), '1')
  })
  await t.test('the second committed approval cannot take the forty-first UTC daily slot', async () => {
   await ok("UPDATE business_private.sitov_recording_monthly_usage SET day_writes=39,recent_writes='{}'")
   await race()
   assert.equal(await ok('SELECT day_writes||\':\'||cardinality(recent_writes) FROM business_private.sitov_recording_monthly_usage'), '40:1')
   assert.equal(await ok('SELECT count(*) FROM business_private.sitov_recording_consents'), '2')
  })
  await t.test('an explicit rollback leaves both proof and counter untouched', async () => {
   await ok("UPDATE business_private.sitov_recording_monthly_usage SET day_writes=0,recent_writes='{}'")
   await ok(`BEGIN;${approval}ROLLBACK;`)
   assert.equal(await ok('SELECT day_writes||\':\'||cardinality(recent_writes) FROM business_private.sitov_recording_monthly_usage'), '0:0')
   assert.equal(await ok('SELECT count(*) FROM business_private.sitov_recording_consents'), '2')
  })
 } finally {
  if (started) await run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop'])
  await rm(root, { recursive: true, force: true })
 }
})
