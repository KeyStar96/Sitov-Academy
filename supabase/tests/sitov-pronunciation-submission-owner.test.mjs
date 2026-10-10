import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const bin = '/opt/homebrew/opt/postgresql@17/bin/'
const migration = readFileSync(new URL('../vps/118_sitov_pronunciation_submission_owner.sql', import.meta.url), 'utf8')
const source = readFileSync(new URL('../vps/94_sitov_pronunciation_pretests.sql', import.meta.url), 'utf8')
const definition = name => {
 const start = source.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`)
 assert.ok(start >= 0)
 return source.slice(start, source.indexOf('$$;', start) + 3)
}
const student = '00000000-0000-4000-8000-000000000001'
const foreign = '00000000-0000-4000-8000-000000000002'
const text = '00000000-0000-4000-8000-000000000003'
const definitionId = '00000000-0000-4000-8000-000000000004'
const ticket = '00000000-0000-4000-8000-000000000005'
const path = `${student}/${ticket}.webm`

test('118 preserves API grants and guards while repairing real non-superuser FOR UPDATE authority', async t => {
 assert.equal(migration, readFileSync(new URL('../migrations/20261010133000_sitov_pronunciation_submission_owner.sql', import.meta.url), 'utf8'))
 assert.equal(migration.replace(/--[^\n]*/g, '').trim(), 'ALTER FUNCTION pronunciation_private.create_submission(uuid,text) OWNER TO supabase_admin;')
 // An independent, socket-only ephemeral cluster avoids altering shared fixture,
 // QA or production role flags. Both application owners are NOSUPERUSER.
 const root = mkdtempSync(join(tmpdir(), 'sitov-pronunciation-owner-'))
 const data = join(root, 'data'), socket = join(root, 'socket')
 mkdirSync(socket)
 const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')))
 let running = false
 const run = (name, args, options = {}) => execFileSync(bin + name, args, { encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe'], ...options })
 const sql = value => run('psql', ['-X', '-w', '-qAt', '-h', socket, '-p', '55485', '-U', 'sitov_fixture_bootstrap', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: '\\set VERBOSITY verbose\n' + value })
 const json = value => JSON.parse(sql(value).trim().split('\n').at(-1))
 const call = (uid = student, target = text, audio = path) => sql(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${uid}',false); SELECT pronunciation_private.create_submission('${target}','storage://pronunciation_audio/${audio}');`)
 const denied = (fn, pattern) => assert.throws(fn, error => pattern.test(String(error.stderr)) && /42501/.test(String(error.stderr)))
 try {
  run('initdb', ['-D', data, '-U', 'sitov_fixture_bootstrap', '--auth=trust', '--no-locale', '--encoding=UTF8'])
  run('pg_ctl', ['-D', data, '-l', join(root, 'postgres.log'), '-o', `-c listen_addresses='' -k ${socket} -p 55485`, '-w', 'start']); running = true
  sql(`CREATE ROLE postgres NOLOGIN NOSUPERUSER BYPASSRLS;
   CREATE ROLE supabase_admin NOLOGIN NOSUPERUSER BYPASSRLS; GRANT postgres TO supabase_admin;
   CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
   CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO postgres,supabase_admin,authenticated;
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   CREATE SCHEMA pronunciation_private AUTHORIZATION postgres;
   CREATE SCHEMA sitov_pronunciation_private AUTHORIZATION supabase_admin;
   CREATE SCHEMA storage AUTHORIZATION supabase_admin;
   ALTER SCHEMA public OWNER TO supabase_admin;
   GRANT USAGE ON SCHEMA pronunciation_private TO authenticated;
   GRANT USAGE ON SCHEMA sitov_pronunciation_private,storage TO postgres;
   SET ROLE supabase_admin;
   CREATE TABLE sitov_pronunciation_private.pretest_definitions(id uuid PRIMARY KEY,text_id uuid);
   CREATE TABLE sitov_pronunciation_private.upload_tickets(id uuid PRIMARY KEY,student_id uuid,text_id uuid,definition_id uuid,path text,expires_at timestamptz,consumed_at timestamptz,purpose text,submission_id uuid);
   CREATE TABLE sitov_pronunciation_private.fixture_passes(student_id uuid,text_id uuid,allowed boolean);
   CREATE TABLE storage.objects(bucket_id text,name text);
   CREATE FUNCTION sitov_pronunciation_private.current_pretest(p_id uuid) RETURNS sitov_pronunciation_private.pretest_definitions LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT d FROM sitov_pronunciation_private.pretest_definitions d WHERE text_id=p_id $$;
   CREATE FUNCTION sitov_pronunciation_private.current_pass(p_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce((SELECT allowed FROM sitov_pronunciation_private.fixture_passes WHERE student_id=auth.uid() AND text_id=p_id),false) $$;
   CREATE TABLE public.learning_units(id uuid PRIMARY KEY,level text);
   CREATE TABLE public.learning_reading_texts(id uuid PRIMARY KEY,unit_id uuid,sentence_de text);
   CREATE TABLE public.submissions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_user_id uuid,type text,content_url text,status text,level text,prompt_id uuid,text_content text);
   GRANT SELECT ON sitov_pronunciation_private.upload_tickets TO postgres;
   GRANT SELECT ON public.learning_reading_texts,public.learning_units,public.submissions TO postgres;
   GRANT INSERT ON public.submissions TO postgres;
   ${definition('pronunciation_private.can_access_submission').replace('sitov_access_private.staff()', 'false')}
   ${definition('sitov_pronunciation_private.ticket_upload_allowed')}
   ${definition('sitov_pronunciation_private.guard_submission')}
   CREATE TRIGGER sitov_fixture_submission BEFORE INSERT ON public.submissions FOR EACH ROW EXECUTE FUNCTION sitov_pronunciation_private.guard_submission();
   ${definition('pronunciation_private.create_submission')}
   ALTER FUNCTION pronunciation_private.create_submission(uuid,text) OWNER TO postgres;
   REVOKE ALL ON FUNCTION pronunciation_private.create_submission(uuid,text) FROM PUBLIC,anon;
   GRANT EXECUTE ON FUNCTION pronunciation_private.create_submission(uuid,text) TO authenticated;
   INSERT INTO public.learning_units VALUES('${definitionId}','A1.1');
   INSERT INTO public.learning_reading_texts VALUES('${text}','${definitionId}','Paul lernt Deutsch.');
   INSERT INTO sitov_pronunciation_private.pretest_definitions VALUES('${definitionId}','${text}');
   INSERT INTO sitov_pronunciation_private.fixture_passes VALUES('${student}','${text}',true);
   INSERT INTO sitov_pronunciation_private.upload_tickets VALUES('${ticket}','${student}','${text}','${definitionId}','${path}',clock_timestamp()+interval '10 minutes',NULL,'target',NULL);
   INSERT INTO storage.objects VALUES('pronunciation_audio','${path}'); RESET ROLE;`)
  const functionState = () => json(`SELECT json_build_object('body',p.prosrc,'definer',p.prosecdef,'config',p.proconfig,'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'anon',has_function_privilege('anon',p.oid,'EXECUTE')) FROM pg_proc p WHERE p.oid='pronunciation_private.create_submission(uuid,text)'::regprocedure;`)
  const before = functionState()
  await t.test('legacy postgres owner is non-superuser with SELECT but no UPDATE on new tickets', () => {
   assert.deepEqual(json("SELECT json_build_object('super',r.rolsuper,'bypass',r.rolbypassrls,'select',has_table_privilege('postgres','sitov_pronunciation_private.upload_tickets','SELECT'),'update',has_table_privilege('postgres','sitov_pronunciation_private.upload_tickets','UPDATE')) FROM pg_roles r WHERE rolname='postgres';"), { super: false, bypass: true, select: true, update: false })
   denied(() => call(), /permission denied for table upload_tickets/)
   assert.equal(Number(sql('SELECT count(*) FROM public.submissions;').trim()), 0)
  })
  await t.test('canonical non-superuser migrator applies owner-only SQL without new API grants', () => {
   sql('SET ROLE supabase_admin; ' + migration + ' RESET ROLE;')
   assert.equal(sql("SELECT proowner::regrole FROM pg_proc WHERE oid='pronunciation_private.create_submission(uuid,text)'::regprocedure;").trim(), 'supabase_admin')
   assert.deepEqual(functionState(), before)
   assert.equal(before.authenticated, true); assert.equal(before.anon, false)
   for (const role of ['anon', 'authenticated']) for (const privilege of ['SELECT','INSERT','UPDATE','DELETE'])
    assert.equal(sql(`SELECT has_table_privilege('${role}','sitov_pronunciation_private.upload_tickets','${privilege}');`).trim(), 'f')
  })
  let id
  await t.test('same student ticket succeeds, consumes once and snapshots the real source', () => {
   id = call().trim().split('\n').at(-1)
   assert.match(id, /^[a-f0-9-]{36}$/)
   assert.deepEqual(json(`SELECT json_build_object('id',submission_id,'consumed',consumed_at IS NOT NULL) FROM sitov_pronunciation_private.upload_tickets WHERE id='${ticket}';`), { id, consumed: true })
   assert.equal(sql(`SELECT text_content FROM public.submissions WHERE id='${id}';`).trim(), 'Paul lernt Deutsch.')
   assert.equal(call().trim().split('\n').at(-1), id)
   assert.equal(Number(sql('SELECT count(*) FROM public.submissions;').trim()), 1)
  })
  await t.test('foreign learner, foreign path and wrong text stay denied', () => {
   denied(() => call(foreign), /invalid_upload_ticket/)
   denied(() => call(student, definitionId), /invalid_upload_ticket/)
   denied(() => call(student, text, `${foreign}/${ticket}.webm`), /invalid_upload_ticket/)
  })
  await t.test('loss of current PASS blocks a new ticket while exact historical receipt survives', () => {
   sql(`UPDATE sitov_pronunciation_private.fixture_passes SET allowed=false; INSERT INTO sitov_pronunciation_private.upload_tickets SELECT gen_random_uuid(),student_id,text_id,definition_id,path||'.new',expires_at,NULL,purpose,NULL FROM sitov_pronunciation_private.upload_tickets WHERE id='${ticket}';`)
   denied(() => call(student,text,path+'.new'), /test_required/)
   assert.equal(call().trim().split('\n').at(-1), id)
   assert.equal(Number(sql('SELECT count(*) FROM public.submissions;').trim()), 1)
  })
  await t.test('expired tickets and missing uploaded objects remain rejected by the unchanged trigger', () => {
   sql(`UPDATE sitov_pronunciation_private.fixture_passes SET allowed=true; UPDATE sitov_pronunciation_private.upload_tickets SET expires_at=clock_timestamp()-interval '1 minute' WHERE path='${path}.new';`)
   denied(() => call(student,text,path+'.new'), /invalid_upload_ticket/)
   sql(`UPDATE sitov_pronunciation_private.upload_tickets SET expires_at=clock_timestamp()+interval '1 minute' WHERE path='${path}.new';`)
   denied(() => call(student,text,path+'.new'), /invalid_upload_ticket/)
   assert.equal(Number(sql('SELECT count(*) FROM public.submissions;').trim()), 1)
  })
  await t.test('anonymous execution and direct learner table writes remain forbidden; migration replay is safe', () => {
   denied(() => sql(`SET ROLE anon; SELECT pronunciation_private.create_submission('${text}','storage://pronunciation_audio/${path}');`), /permission denied/)
   denied(() => sql('SET ROLE authenticated; UPDATE sitov_pronunciation_private.upload_tickets SET consumed_at=NULL;'), /permission denied/)
   sql('SET ROLE supabase_admin; ' + migration + ' RESET ROLE;')
   assert.deepEqual(functionState(), before)
  })
 } finally {
  if (running) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop'])
  rmSync(root, { recursive: true, force: true })
 }
})
