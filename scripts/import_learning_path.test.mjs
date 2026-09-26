import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, writeFile, mkdir, rm, utimes, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { ImportFailure, runImportCommand, parseArguments, localEndpoint } = require('./import_learning_path.ts')
const { learningPathSeedSchema } = require('../lib/learning-path-schema.ts')
const locales = ['en', 'ru', 'uk', 'tr']
const translated = data => Object.fromEntries(locales.map(locale => [locale, data]))
const secret = 'sb_secret_fixture_do_not_log'
const environment = { PATH_SEED_SUPABASE_URL: 'http://127.0.0.1:54321', PATH_SEED_SERVICE_ROLE_KEY: secret }

function fixture(id = 'fixture-path', number = 1) {
  const exercise = () => ({
    id: randomUUID(), ref: randomUUID(), goal: 'fixture-goal', exercise_type: 'fill_in_blank',
    content: { instruction: 'Ergänze das Wort.', target_form: ['bin'], text_before: 'Ich ', text_after: ' hier.', correct_answer: 'bin', accepted_answers: ['bin'] },
    hint: 'Achte auf das Verb.', explanation: 'Das Verb passt zum Subjekt.', explanation_card: 'fixture-card',
    translations: translated({ instruction: 'Complete the word.', hint: 'Look at the verb.', explanation: 'The verb matches the subject.' }),
  })
  const path = {
    id, level: 'A1.1', path: number, slug: id, title: 'Prüfpfad', translations: translated({ title: 'Test path' }),
    unit: { level: 'A1.1', trainer: 'exercises', label: 'Prüfpfad', sort_order: number },
    objectives: [{ id: 'fixture-goal', area: 'grammar', description: 'Verben verstehen.' }],
    nodes: ['practice', 'review', 'test'].map((kind, index) => ({
      id: `fixture-${kind}`, kind, sort_order: index + 1, topic: 'Verben', title: 'Prüfknoten', translations: translated({ title: 'Test node' }),
      goals: ['fixture-goal'], exercises: Array.from({ length: kind === 'test' ? 4 : 1 }, exercise), ...(kind === 'test' ? { test_size: 2 } : {}),
      ...(kind === 'practice' ? { merkkarte: { card: 'fixture-card', rule: 'Das Verb passt zum Subjekt.', examples: ['Ich bin hier.'], highlight: null, translations: translated({ rule: 'The verb matches the subject.' }) } } : {}),
    })),
  }
  learningPathSeedSchema.parse([path])
  return path
}

function responseFor(paths) {
  const entries = paths.map(path => ({ source_id: path.id, unit_id: randomUUID(), node_count: path.nodes.length,
    exercise_count: path.nodes.reduce((sum, node) => sum + node.exercises.length, 0), objective_count: path.objectives.length }))
  return { path_count: paths.length, node_count: entries.reduce((sum, path) => sum + path.node_count, 0),
    exercise_count: entries.reduce((sum, path) => sum + path.exercise_count, 0), objective_count: entries.reduce((sum, path) => sum + path.objective_count, 0),
    paths: entries, migration: { archived_units: 2, notes_created: 1 } }
}

async function setup(t, paths = [fixture()]) {
  const root = await mkdtemp(join(tmpdir(), 'sitov-path-import-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const filename = join(root, 'seed.json')
  await writeFile(filename, JSON.stringify(paths))
  const backup = join(root, 'backup')
  await mkdir(backup, { mode: 0o700 })
  const dump = Buffer.from('synthetic backup test fixture')
  await writeFile(join(backup, 'postgres.dump'), dump)
  await writeFile(join(backup, 'sha256.json'), JSON.stringify({ 'postgres.dump': createHash('sha256').update(dump).digest('hex') }))
  await writeFile(join(backup, 'COMPLETE'), 'isolated synthetic test database\n')
  const messages = []
  const requests = []
  const deps = { env: environment, log: message => messages.push(message), fetch: async (url, options) => {
    requests.push({ url, options }); return Response.json(responseFor(paths))
  } }
  return { root, filename, backup, paths, messages, requests, deps, args: [filename, '--import', '--backup-dir', backup] }
}

await test('learning path importer validates the full seed before touching the local database', async t => {
  const ctx = await setup(t, [fixture(), fixture('second-path', 2)])
  assert.equal(learningPathSeedSchema.safeParse(ctx.paths).success, true)
  const result = await runImportCommand([ctx.filename], { ...ctx.deps, env: {} })
  assert.equal(result.path_count, 2)
  assert.equal(ctx.requests.length, 0)
  delete ctx.paths[1].nodes[2].exercises[3].translations.uk
  await writeFile(ctx.filename, JSON.stringify(ctx.paths))
  await assert.rejects(runImportCommand(ctx.args, ctx.deps), /Seed validation failed.*No database request was made/)
  assert.equal(ctx.requests.length, 0)
  await assert.rejects(readFile(join(ctx.backup, 'learning-path-import.json')), { code: 'ENOENT' })
})

await test('duplicate exercise IDs across otherwise valid paths fail before any request', async t => {
  const paths = [fixture(), fixture('second-path', 2)]
  paths[1].nodes[0].exercises[0].id = paths[0].nodes[0].exercises[0].id
  const ctx = await setup(t, paths)
  await assert.rejects(runImportCommand(ctx.args, ctx.deps), /Seed validation failed/)
  assert.equal(ctx.requests.length, 0)
})

await test('malformed JSON and malformed UTF-8 never expose file contents', async t => {
  const ctx = await setup(t)
  for (const bytes of [Buffer.from(`invalid ${secret}`), Buffer.from([0x5b, 0x22, 0xff, 0x22, 0x5d])]) {
    await writeFile(ctx.filename, bytes)
    await assert.rejects(runImportCommand(ctx.args, ctx.deps), error => error instanceof ImportFailure && !error.message.includes(secret) && /not valid UTF-8 JSON/.test(error.message))
  }
  assert.equal(ctx.requests.length, 0)
})

await test('CLI arguments are explicit, unambiguous and validation is the default', () => {
  assert.equal(parseArguments([]).import, false)
  assert.equal(parseArguments(['--help']).help, true)
  for (const args of [ ['--unknown'], ['--import'], ['--import', '--import'], ['a', 'b'], ['--backup-dir', '/tmp'],
    ['--timeout-ms'], ['--timeout-ms', '0'], ['--timeout-ms', '600001'], ['--timeout-ms', 'NaN'],
    ['--timeout-ms', '1', '--timeout-ms', '2'], ['--help', '--import'] ]) assert.throws(() => parseArguments(args), ImportFailure)
})

await test('local endpoint guard rejects remote hosts, URL credentials, paths and query strings', () => {
  for (const url of ['http://localhost:54321', 'https://127.0.0.1', 'http://[::1]:54321']) assert.ok(localEndpoint(url))
  for (const url of [undefined, 'https://example.supabase.co', 'http://127.0.0.1.evil.test', 'file:///tmp',
    'http://user:secret@127.0.0.1', 'http://127.0.0.1/rest/v1', 'http://localhost?key=secret', 'http://localhost#fragment', 'invalid']) assert.throws(() => localEndpoint(url), ImportFailure)
})

await test('remote or missing connection configuration fails without using the backup or sending the key', async t => {
  const ctx = await setup(t)
  for (const env of [{}, { ...environment, PATH_SEED_SUPABASE_URL: 'https://example.supabase.co' },
    { ...environment, PATH_SEED_SERVICE_ROLE_KEY: undefined }, { ...environment, PATH_SEED_SERVICE_ROLE_KEY: secret + '\n' }]) {
    await assert.rejects(runImportCommand(ctx.args, { ...ctx.deps, env }), ImportFailure)
  }
  assert.equal(ctx.requests.length, 0)
  await assert.rejects(readFile(join(ctx.backup, 'learning-path-import.json')), { code: 'ENOENT' })
})

await test('anon and expired legacy JWTs cannot authorize an import', async t => {
  const ctx = await setup(t)
  for (const claims of [{ role: 'anon' }, { role: 'authenticated' }, { role: 'service_role', exp: 1 }]) {
    const key = `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`
    await assert.rejects(runImportCommand(ctx.args, { ...ctx.deps, env: { ...environment, PATH_SEED_SERVICE_ROLE_KEY: key } }), /unexpired service_role JWT/)
  }
  assert.equal(ctx.requests.length, 0)
})

await test('one atomic RPC carries the complete seed and verifies aggregate and per-path results', async t => {
  const ctx = await setup(t, [fixture(), fixture('second-path', 2)])
  const result = await runImportCommand(ctx.args, ctx.deps)
  assert.equal(result.imported, true)
  assert.equal(result.exercise_count, 12)
  assert.equal(ctx.requests.length, 1)
  const { url, options } = ctx.requests[0]
  assert.equal(url.href, 'http://127.0.0.1:54321/rest/v1/rpc/import_learning_path_seed')
  assert.deepEqual(JSON.parse(options.body), { p_paths: ctx.paths })
  assert.equal(options.headers.apikey, secret)
  assert.equal(options.headers.Authorization, `Bearer ${secret}`)
  assert.equal(options.redirect, 'error')
  assert.equal(JSON.parse(await readFile(join(ctx.backup, 'learning-path-import.json'), 'utf8')).status, 'complete')
  assert.ok(!ctx.messages.join('\n').includes(secret))
  await assert.rejects(runImportCommand(ctx.args, ctx.deps), /already used/)
  assert.equal(ctx.requests.length, 1)
})

await test('tampered, incomplete and stale backups prevent all writes', async t => {
  for (const damage of [
    async ctx => writeFile(join(ctx.backup, 'postgres.dump'), 'changed'),
    async ctx => rm(join(ctx.backup, 'COMPLETE')),
    async ctx => writeFile(join(ctx.backup, 'sha256.json'), '{}'),
    async ctx => utimes(join(ctx.backup, 'COMPLETE'), 1, 1),
  ]) {
    const ctx = await setup(t)
    await damage(ctx)
    await assert.rejects(runImportCommand(ctx.args, ctx.deps), ImportFailure)
    assert.equal(ctx.requests.length, 0)
  }
})

await test('backup manifests cannot read outside the protected backup directory', async t => {
  for (const name of ['../outside', '/tmp/outside', 'linked']) {
    const ctx = await setup(t)
    const outside = join(ctx.root, 'outside')
    await writeFile(outside, 'protected')
    if (name === 'linked') await symlink(outside, join(ctx.backup, 'linked'))
    const manifest = JSON.parse(await readFile(join(ctx.backup, 'sha256.json'), 'utf8'))
    manifest[name] = createHash('sha256').update('protected').digest('hex')
    await writeFile(join(ctx.backup, 'sha256.json'), JSON.stringify(manifest))
    await assert.rejects(runImportCommand(ctx.args, ctx.deps), ImportFailure)
    assert.equal(ctx.requests.length, 0)
  }
})

await test('HTTP and RPC errors redact server messages and secret credentials', async t => {
  for (const response of [Response.json({ message: secret }, { status: 403 }), Response.json({ error: secret }), new Response(secret)]) {
    const ctx = await setup(t)
    await assert.rejects(runImportCommand(ctx.args, { ...ctx.deps, fetch: async () => response }), error => {
      assert.ok(error instanceof ImportFailure)
      assert.ok(!error.message.includes(secret))
      return true
    })
    assert.ok(!ctx.messages.join('\n').includes(secret))
  }
})

await test('count mismatches, missing rows, wrong identities and malformed success payloads fail verification', async t => {
  for (const change of [
    result => { result.exercise_count++ }, result => { result.paths.pop() },
    result => { result.paths[0].source_id = 'wrong' }, result => { result.paths[0].node_count++ },
    result => { result.paths[0].unit_id = 'not-a-uuid' }, result => { delete result.migration },
  ]) {
    const ctx = await setup(t)
    const result = responseFor(ctx.paths)
    change(result)
    await assert.rejects(runImportCommand(ctx.args, { ...ctx.deps, fetch: async () => Response.json(result) }), /unverified/)
    assert.equal(JSON.parse(await readFile(join(ctx.backup, 'learning-path-import.json'), 'utf8')).status, 'started')
  }
})

await test('network failures never leak the internal error and never retry an uncertain commit automatically', async t => {
  const ctx = await setup(t)
  let requests = 0
  await assert.rejects(runImportCommand(ctx.args, { ...ctx.deps, fetch: async () => { requests++; throw new Error(secret) } }), error => !error.message.includes(secret) && /unverified/.test(error.message))
  assert.equal(requests, 1)
})

await test('timeout aborts the request and requires a fresh backup for a safe idempotent retry', async t => {
  const ctx = await setup(t)
  let signal
  await assert.rejects(runImportCommand([...ctx.args, '--timeout-ms', '5'], { ...ctx.deps, fetch: async (_url, options) => {
    signal = options.signal
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error(secret)), { once: true }))
  } }), /Import timed out.*unverified/)
  assert.equal(signal.aborted, true)
  await assert.rejects(runImportCommand(ctx.args, ctx.deps), /already used/)
})

await test('all curriculum CLI error boundaries print static diagnostics without raw file contents or arguments', async t => {
  const ctx = await setup(t)
  const commands = [
    [fileURLToPath(new URL('../node_modules/ts-node/dist/bin.js', import.meta.url)), '--transpile-only', '--compiler-options', '{"module":"CommonJS","moduleResolution":"node"}', fileURLToPath(new URL('./import_learning_path.ts', import.meta.url))],
    [fileURLToPath(new URL('./path-seed.mjs', import.meta.url))],
    [fileURLToPath(new URL('./path-listening-audio.mjs', import.meta.url))],
  ]
  await writeFile(ctx.filename, `invalid JSON with ${secret}`)
  for (const command of commands) for (const arguments_ of [[ctx.filename], [`--${secret}`]]) {
    const result = spawnSync(process.execPath, [...command, ...arguments_], { encoding: 'utf8', timeout: 10_000 })
    assert.equal(result.status, 1)
    assert.ok(result.stderr.trim())
    assert.ok(!`${result.stdout}${result.stderr}`.includes(secret))
    assert.ok(!result.stderr.includes('SyntaxError'))
    assert.ok(!result.stderr.includes(ctx.filename))
  }
})
