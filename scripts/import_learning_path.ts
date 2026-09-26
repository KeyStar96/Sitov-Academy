#!/usr/bin/env node
/** Local, server-only curriculum importer. See docs/master-4/phase-4-import.md. */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { z } from 'zod'
import { learningPathSeedSchema, type LearningPathSeed } from '../lib/learning-path-schema'
import type { Database, Json } from '../supabase/database.types'

const ROOT = resolve(__dirname, '..')
const DEFAULT_SEED = 'supabase/seeds/path-a1.1.json'
const MAX_SEED_BYTES = 64 * 1024 * 1024
const BACKUP_MAX_AGE_MS = 60 * 60 * 1000
const DEFAULT_TIMEOUT_MS = 180_000
const HELP = `Usage: npm run seed:learning-path -- [seed.json] [--import --backup-dir DIR] [--timeout-ms N]
Default: validate the complete local seed without contacting the database.
--import requires an unused, complete backup from deploy/vps/migrate-local.py (at most one hour old).
Set PATH_SEED_SUPABASE_URL to a loopback Supabase origin and PATH_SEED_SERVICE_ROLE_KEY to its server-only key.
No .env files are loaded. The full batch is atomic; after any uncertain result, take a fresh backup and repeat.
`

type FailureCategory = 'arguments' | 'seed' | 'configuration' | 'backup' | 'database' | 'unverified'
export class ImportFailure extends Error {
  constructor(message: string, readonly category: FailureCategory = 'arguments') { super(message) }
}
const fail = (message: string, category: FailureCategory = 'arguments'): never => { throw new ImportFailure(message, category) }

type Options = { filename: string; import: boolean; backupDir?: string; timeoutMs: number; help: boolean }
type Dependencies = { env?: NodeJS.ProcessEnv; fetch?: typeof fetch; log?: (message: string) => void }

export function parseArguments(args: string[]): Options {
  const options: Options = { filename: resolve(ROOT, DEFAULT_SEED), import: false, timeoutMs: DEFAULT_TIMEOUT_MS, help: false }
  if (args.length === 1 && args[0] === '--help') return { ...options, help: true }
  const seen = new Set<string>()
  let filename: string | undefined
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]
    if (argument === '--import') {
      if (seen.has(argument)) fail('Duplicate --import argument. Use --help.')
      options.import = true
    } else if (argument === '--backup-dir' || argument === '--timeout-ms') {
      if (seen.has(argument) || !args[index + 1] || args[index + 1].startsWith('--')) fail('Missing or duplicate option value. Use --help.')
      const value = args[++index]
      if (argument === '--backup-dir') options.backupDir = resolve(value)
      else {
        if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 600_000) fail('--timeout-ms must be between 1 and 600000.')
        options.timeoutMs = Number(value)
      }
    } else if (argument.startsWith('-') || filename !== undefined) fail('Invalid arguments. Use --help.')
    else filename = argument
    seen.add(argument)
  }
  if (filename !== undefined) options.filename = resolve(ROOT, filename)
  if (options.import && !options.backupDir) fail('--import requires --backup-dir from a fresh migrate-local.py backup.')
  if (!options.import && options.backupDir) fail('--backup-dir requires --import.')
  return options
}

export function localEndpoint(value: string | undefined): URL {
  if (!value) fail('Set PATH_SEED_SUPABASE_URL explicitly to the local Supabase origin.', 'configuration')
  let url: URL
  try { url = new URL(value) } catch { fail('PATH_SEED_SUPABASE_URL is not a valid local origin.', 'configuration') }
  if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    fail('Only a loopback Supabase origin is allowed (localhost, 127.0.0.1 or [::1], without credentials, path or query).', 'configuration')
  }
  return url
}

function serviceRoleKey(value: string | undefined): string {
  if (!value || value !== value.trim() || /\s/.test(value)) fail('Set PATH_SEED_SERVICE_ROLE_KEY to the local server-only Service Role key.', 'configuration')
  // New server secret keys are opaque. For legacy JWT keys, reject accidental
  // anon/user credentials locally; the server still verifies the signature.
  if (/^sb_secret_[A-Za-z0-9_-]+$/.test(value)) return value
  try {
    const parts = value.split('.')
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error()
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (claims.role !== 'service_role' || (claims.exp !== undefined && (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()))) throw new Error()
    return value
  } catch { fail('PATH_SEED_SERVICE_ROLE_KEY must be a server secret or an unexpired service_role JWT.', 'configuration') }
}

function summarize(paths: LearningPathSeed) {
  return {
    path_count: paths.length,
    node_count: paths.reduce((total, path) => total + path.nodes.length, 0),
    exercise_count: paths.reduce((total, path) => total + path.nodes.reduce((count, node) => count + node.exercises.length, 0), 0),
    objective_count: paths.reduce((total, path) => total + path.objectives.length, 0),
  }
}

async function readSeed(filename: string): Promise<{ paths: LearningPathSeed; sha256: string }> {
  let source: Buffer
  try {
    const info = await stat(filename)
    if (!info.isFile() || info.size > MAX_SEED_BYTES) fail('Seed must be a regular file no larger than 64 MiB.', 'seed')
    source = await readFile(filename)
    if (source.length > MAX_SEED_BYTES) fail('Seed must be no larger than 64 MiB.', 'seed')
  } catch (error) {
    if (error instanceof ImportFailure) throw error
    fail('Cannot read the local seed file. Check its path and file permissions.', 'seed')
  }
  let parsed: unknown
  try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(source)) } catch { fail('The seed file is not valid UTF-8 JSON.', 'seed') }
  const validation = learningPathSeedSchema.safeParse(parsed)
  if (!validation.success) {
    // Zod messages can contain source values. Report locations and codes only;
    // neither curriculum answers nor arbitrary file contents enter the log.
    const locations = validation.error.issues.slice(0, 8).map(issue => `${issue.path.map(part => String(part).replace(/[^A-Za-z0-9_-]/g, '?').slice(0, 60)).join('.') || 'seed'} (${issue.code})`)
    fail(`Seed validation failed (${validation.error.issues.length} issues): ${locations.join('; ')}. No database request was made.`, 'seed')
  }
  return { paths: validation.data, sha256: createHash('sha256').update(source).digest('hex') }
}

async function fileDigest(filename: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filename)) hash.update(chunk)
  return hash.digest('hex')
}

async function reserveBackup(directory: string, seedHash: string, origin: string): Promise<string> {
  try {
    const root = await realpath(directory)
    const info = await stat(root)
    if (!info.isDirectory() || (info.mode & 0o077) !== 0) fail('The backup directory must be private (mode 0700).', 'backup')
    const complete = await stat(resolve(root, 'COMPLETE'))
    const age = Date.now() - complete.mtimeMs
    if (!complete.isFile() || age < -60_000 || age > BACKUP_MAX_AGE_MS || !(await readFile(resolve(root, 'COMPLETE'), 'utf8')).trim()) {
      fail('Backup COMPLETE marker is missing, invalid or older than one hour. Create a fresh migrate-local.py backup.', 'backup')
    }
    const manifest = z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)).safeParse(JSON.parse(await readFile(resolve(root, 'sha256.json'), 'utf8')))
    if (!manifest.success || !Object.hasOwn(manifest.data, 'postgres.dump')) fail('Backup checksum manifest must include postgres.dump.', 'backup')
    for (const [name, expected] of Object.entries(manifest.data)) {
      if (!name || isAbsolute(name) || name.split(/[\\/]/).some(part => part === '..' || part === '')) fail('Backup checksum manifest contains an unsafe file path.', 'backup')
      const file = await realpath(resolve(root, name))
      const child = relative(root, file)
      if (!child || child.startsWith(`..${sep}`) || child === '..' || isAbsolute(child)) fail('Backup file resolves outside the backup directory.', 'backup')
      const fileInfo = await stat(file)
      if (!fileInfo.isFile() || (name === 'postgres.dump' && fileInfo.size === 0) || await fileDigest(file) !== expected) fail('Backup integrity check failed. Create a fresh migrate-local.py backup.', 'backup')
    }
    const receipt = resolve(root, 'learning-path-import.json')
    await writeFile(receipt, JSON.stringify({ status: 'started', started_at: new Date().toISOString(), seed_sha256: seedHash, supabase_origin: origin }) + '\n', { flag: 'wx', mode: 0o600 })
    return receipt
  } catch (error) {
    if (error instanceof ImportFailure) throw error
    fail('Backup verification failed or this backup was already used for an import. Create a fresh migrate-local.py backup.', 'backup')
  }
}

const count = z.number().int().nonnegative()
const importResultSchema = z.object({
  path_count: count, node_count: count, exercise_count: count, objective_count: count,
  paths: z.array(z.object({ source_id: z.string(), unit_id: z.uuid(), node_count: count, exercise_count: count, objective_count: count })),
  migration: z.object({ archived_units: count, notes_created: count }),
})

function verifyResult(payload: unknown, paths: LearningPathSeed) {
  const parsed = importResultSchema.safeParse(payload)
  if (!parsed.success) fail('Import response is invalid; commit status is unverified. Take a fresh backup before repeating the idempotent import.', 'unverified')
  const result = parsed.data
  const expected = summarize(paths)
  if (Object.entries(expected).some(([key, total]) => result[key] !== total) || result.paths.length !== paths.length
    || new Set(result.paths.map(path => path.unit_id)).size !== paths.length
    || paths.some((path, index) => {
      const actual = result.paths[index]
      return actual.source_id !== path.id || actual.node_count !== path.nodes.length || actual.objective_count !== path.objectives.length
        || actual.exercise_count !== path.nodes.reduce((total, node) => total + node.exercises.length, 0)
    })) fail('Import row counts or identities do not match the validated seed. Commit status is unverified; inspect the local database before retrying.', 'unverified')
  return result
}

export async function runImportCommand(args: string[], dependencies: Dependencies = {}) {
  const options = parseArguments(args)
  const log = dependencies.log ?? console.log
  if (options.help) { log(HELP); return }
  const { paths, sha256 } = await readSeed(options.filename)
  const totals = summarize(paths)
  log(`Valid: ${totals.path_count} paths, ${totals.node_count} nodes, ${totals.exercise_count} exercises, ${totals.objective_count} objectives. SHA256 ${sha256}`)
  if (!options.import) return { validated: true, ...totals, sha256 }

  const env = dependencies.env ?? process.env
  const endpoint = localEndpoint(env.PATH_SEED_SUPABASE_URL)
  const key = serviceRoleKey(env.PATH_SEED_SERVICE_ROLE_KEY)
  const receipt = await reserveBackup(options.backupDir, sha256, endpoint.origin)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs)
  const request = dependencies.fetch ?? fetch
  try {
    // The authoring schema refines content from unknown; readSeed has already
    // parsed JSON and validated each exercise's concrete content schema.
    const body: Database['public']['Functions']['import_learning_path_seed']['Args'] = { p_paths: paths as unknown as Json }
    const response = await request(new URL('/rest/v1/rpc/import_learning_path_seed', endpoint), {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    })
    if (!response.ok) fail(`Import request failed (HTTP ${response.status}). Commit status is unverified; take a fresh backup before repeating the import.`, 'unverified')
    let payload: unknown
    try { payload = await response.json() } catch { fail('Import returned invalid JSON. Commit status is unverified; take a fresh backup before repeating the import.', 'unverified') }
    // Never echo PostgREST or SQL errors: their detail may contain secrets or answers.
    if (typeof payload === 'object' && payload !== null && 'error' in payload) fail('The database rejected the import and rolled back the batch. Inspect its protected local log, then take a fresh backup before retrying.', 'database')
    const result = verifyResult(payload, paths)
    await writeFile(receipt, JSON.stringify({ status: 'complete', completed_at: new Date().toISOString(), seed_sha256: sha256, supabase_origin: endpoint.origin, result }, null, 2) + '\n', { mode: 0o600 })
    log(`Imported and verified: ${result.path_count} paths, ${result.node_count} nodes, ${result.exercise_count} exercises, ${result.objective_count} objectives; ${result.migration.archived_units} legacy units archived, ${result.migration.notes_created} teacher notes created.`)
    return { validated: true, imported: true, ...result, sha256 }
  } catch (error) {
    if (error instanceof ImportFailure) throw error
    fail(controller.signal.aborted
      ? 'Import timed out. Commit status is unverified; take a fresh backup before repeating the idempotent import.'
      : 'Import connection or local receipt update failed. Commit status is unverified; take a fresh backup before repeating the idempotent import.', 'unverified')
  } finally { clearTimeout(timer) }
}

if (require.main === module) {
  runImportCommand(process.argv.slice(2)).catch(error => {
    // Fixed category messages are safe even if a lower-level error contains
    // file content, credentials or PostgreSQL details. Do not print error.message.
    switch (error instanceof ImportFailure ? error.category : undefined) {
      case 'arguments': console.error('Invalid import arguments. Use --help; writing requires --import and --backup-dir.'); break
      case 'seed': console.error('Seed file could not be read or failed UTF-8 JSON/schema validation. No database request was made.'); break
      case 'configuration': console.error('Invalid local connection configuration. Check PATH_SEED_SUPABASE_URL and PATH_SEED_SERVICE_ROLE_KEY; no database request was made.'); break
      case 'backup': console.error('Backup verification failed. Use an unused, private migrate-local.py backup with valid checksums and a COMPLETE marker younger than one hour. No database request was made.'); break
      case 'database': console.error('The database rejected the import and rolled back the batch. Inspect its protected local log, then take a fresh backup before retrying.'); break
      case 'unverified': console.error('Import could not be verified. Commit status is unknown; inspect the local database and take a fresh backup before repeating the idempotent import.'); break
      default: console.error('The local import command failed. No internal error details were logged.')
    }
    process.exitCode = 1
  })
}
