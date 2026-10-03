import { test } from 'node:test'
import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { PGlite } from '@electric-sql/pglite'
import { createCurrentDatabase, currentFeatureMigrations, student } from './helpers/current-db.mjs'

const execute = promisify(execFile)
const cwd = fileURLToPath(new URL('../../', import.meta.url))
const bin = process.env.SITOV_TEST_POSTGRES_BIN || '/opt/homebrew/opt/postgresql@17/bin'
const literal = value => value === null ? 'NULL' : typeof value === 'boolean' ? String(value) : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`

/** Replay the existing synthetic test fixture into a disposable native server.
 * No production DSN, credentials, curriculum dump or network listener is used.
 * Real independent sessions prove FOR UPDATE and unique-day race protection;
 * PGlite queues a single session and cannot itself prove a transaction race.
 */
test('daily quests: native PostgreSQL concurrent login/resume/completion and migration-role ACLs', async t => {
  try { await access(join(bin, 'initdb')); await access(join(bin, 'pg_ctl')); await access(join(bin, 'psql')) }
  catch { t.skip('Set SITOV_TEST_POSTGRES_BIN to an existing PostgreSQL binary directory for native concurrency checks.'); return }
  const statements = [], originalExec = PGlite.prototype.exec, originalQuery = PGlite.prototype.query
  let fixture
  PGlite.prototype.exec = async function (sql, ...args) { statements.push(sql); return originalExec.call(this, sql, ...args) }
  PGlite.prototype.query = async function (sql, params = [], ...args) {
    statements.push(sql.replace(/\$(\d+)\b/g, (token, n) => Number(n) <= params.length ? literal(params[Number(n)-1]) : token))
    return originalQuery.call(this, sql, params, ...args)
  }
  try { fixture = await createCurrentDatabase({ latest: currentFeatureMigrations }) }
  finally { PGlite.prototype.exec = originalExec; PGlite.prototype.query = originalQuery; await fixture?.close() }
  const directory = await mkdtemp(join(tmpdir(), 'sitov-daily-quests-pg-')), port = 55479
  let started = false
  const sql = async input => {
    const child = execFile(join(bin, 'psql'), ['-XqAt', '-h', directory, '-p', String(port), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { cwd, maxBuffer: 8*1024*1024 })
    const output = new Promise((resolve, reject) => child.on('error', reject).on('close', code => code === 0 ? resolve() : reject(new Error(`psql exited ${code}`))))
    let stdout = '', stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk }); child.stderr.on('data', chunk => { stderr += chunk }); child.stdin.on('error',()=>{}); child.stdin.end(input)
    try { await output } catch { throw new Error(stderr.slice(-4000)) }
    return stdout.trim().split('\n').filter(Boolean)
  }
  const userSql = query => `BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${student}',true); SELECT set_config('request.jwt.claim.role','authenticated',true); ${query}; COMMIT;`
  const decode = lines => JSON.parse(lines.findLast(line => line.startsWith('{')))
  try {
    await execute(join(bin, 'initdb'), ['-D', join(directory,'data'), '-A', 'trust', '-U', 'postgres', '--no-locale', '--encoding=UTF8'], { cwd })
    await execute(join(bin, 'pg_ctl'), ['-D', join(directory,'data'), '-l', join(directory,'server.log'), '-o', `-k ${directory} -p ${port} -c listen_addresses=''`, '-w', 'start'], { cwd })
    started = true
    await sql(statements.join('\n;\n'))
    // A different migration superuser reproduces the self-hosted runner's
    // ownership boundary: every new private helper must work from that owner.
    const migrations = await Promise.all(['59_daily_quests.sql', '60_daily_quest_resume.sql'].map(name => readFile(new URL(`../vps/${name}`, import.meta.url), 'utf8')))
    await sql('CREATE ROLE sitov_test_migrator SUPERUSER; SET ROLE sitov_test_migrator; ' + migrations[0])
    const metadataSql = "SELECT pg_get_userbyid(proowner),proacl::text,prosecdef,proconfig::text FROM pg_proc WHERE oid='daily_quest_private.handle(text,uuid,text,jsonb,boolean)'::regprocedure"
    const previousMetadata = await sql(metadataSql)
    await sql('SET ROLE sitov_test_migrator; ' + migrations[1])
    assert.deepEqual(await sql(metadataSql), previousMetadata,'resume replacement preserves ownership, ACLs and the definer search path')
    assert.deepEqual(await sql("SELECT has_function_privilege('authenticated','daily_quest_private.handle(text,uuid,text,jsonb,boolean)','EXECUTE'),has_function_privilege('anon','daily_quest_private.handle(text,uuid,text,jsonb,boolean)','EXECUTE')"), ['t|f'])
    const claims = await Promise.all(Array.from({length:8}, async () => decode(await sql(userSql('SELECT public.claim_daily_quest_login()')))))
    assert.equal(claims.filter(claim=>claim.shouldRedirect).length,1)
    assert.equal(new Set(claims.map(claim=>claim.assignmentId)).size,1)
    const assignment = claims[0].assignmentId
    assert.ok(assignment)
    assert.deepEqual(await sql(`SELECT count(*) FROM public.daily_quest_assignments WHERE auth_user_id='${student}'`), ['1'])
    const discovery = JSON.stringify({wordIds:['food','coffee','bag']})
    const leaving = await Promise.all(Array.from({length:8}, async () => decode(await sql(userSql(`SELECT public.skip_daily_quest('${assignment}')`)))).concat([
      sql(userSql(`SELECT public.submit_daily_quest_step('${assignment}','discover','${discovery}'::jsonb)`)).then(decode),
      sql(userSql('SELECT public.get_daily_quest()')).then(decode),
    ]))
    assert.ok(leaving.every(response => response.success && response.quest.status==='active'))
    const resumed = decode(await sql(userSql('SELECT public.get_daily_quest()')))
    assert.deepEqual(resumed.quest.completedStepIds,['discover'],'navigation races preserve server-verified progress')
    assert.deepEqual(await sql(`SELECT skipped_at IS NULL FROM public.daily_quest_assignments WHERE id='${assignment}'`), ['t'])
    assert.deepEqual(await sql(`SELECT daily_quest_streak FROM public.profiles WHERE id='${student}'`), ['0'])
    assert.equal(decode(await sql(userSql('SELECT public.claim_daily_quest_login()'))).shouldRedirect,false,'leaving does not reopen the login redirect')
    for (const [step,answer] of [['build',{pieceIds:['ich','moechte','food','bitte']}],['dialogue',{optionId:'a'}]]) {
      const response = decode(await sql(userSql(`SELECT public.submit_daily_quest_step('${assignment}','${step}','${JSON.stringify(answer)}'::jsonb)`)))
      assert.equal(response.correct,true, JSON.stringify(response))
    }
    const completions = await Promise.all(Array.from({length:8}, async () => decode(await sql(userSql(`SELECT public.complete_daily_quest('${assignment}')`)))).concat(
      Array.from({length:8}, async () => decode(await sql(userSql(`SELECT public.skip_daily_quest('${assignment}')`))))
    ))
    assert.ok(completions.every(response=>response.success))
    assert.ok(completions.slice(0,8).every(response=>response.quest.status==='completed' && response.streak.current===1))
    assert.deepEqual(await sql(`SELECT daily_quest_streak FROM public.profiles WHERE id='${student}'`), ['1'])
    const completed = decode(await sql(userSql('SELECT public.get_daily_quest()')))
    assert.equal(completed.quest.status,'completed','a concurrent old-client skip never overwrites completion')
    assert.deepEqual(completed.quest.completedStepIds,['discover','build','dialogue'])
    assert.deepEqual(await sql(`SELECT skipped_at IS NULL FROM public.daily_quest_assignments WHERE id='${assignment}'`), ['t'])
    const locks = await sql("SELECT position('FOR UPDATE' IN prosrc)>0 FROM pg_proc WHERE oid='daily_quest_private.handle(text,uuid,text,jsonb,boolean)'::regprocedure")
    assert.deepEqual(locks,['t'])
  } finally {
    if (started) await execute(join(bin,'pg_ctl'), ['-D',join(directory,'data'),'-m','immediate','-w','stop'], { cwd })
    await rm(directory, {recursive:true,force:true})
  }
})
