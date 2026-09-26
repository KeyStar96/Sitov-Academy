#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { learningPathSeedSchema } = require('../lib/learning-path-schema.ts')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
class SeedCommandError extends Error {
  constructor(category) { super('Seed command failed.'); this.category = category }
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log('Usage: node scripts/path-seed.mjs [seed.json] [--import]')
    console.log('Default: validate the existing seed locally without writing files or contacting the database.')
    console.log('--import: staff RPC import; requires PATH_SEED_SUPABASE_URL, PATH_SEED_ANON_KEY and PATH_SEED_STAFF_ACCESS_TOKEN.')
    return
  }
  const unsupported = args.filter(arg => arg.startsWith('--') && arg !== '--import')
  const filenames = args.filter(arg => !arg.startsWith('--'))
  if (unsupported.length || filenames.length > 1 || args.filter(arg => arg === '--import').length > 1) {
    throw new SeedCommandError('arguments')
  }
  const filename = resolve(root, filenames[0] ?? 'supabase/seeds/path-a1.1.json')
  const result = learningPathSeedSchema.safeParse(JSON.parse(await readFile(filename, 'utf8')))
  if (!result.success) {
    throw new SeedCommandError('validation')
  }
  const paths = result.data
  const nodes = paths.flatMap(path => path.nodes)
  console.log(`Valid: ${paths.length} paths, ${nodes.length} nodes, ${nodes.reduce((sum, node) => sum + node.exercises.length, 0)} exercises, ${paths.reduce((sum, path) => sum + path.objectives.length, 0)} objectives.`)
  if (!args.includes('--import')) return

  const endpoint = process.env.PATH_SEED_SUPABASE_URL
  const anonKey = process.env.PATH_SEED_ANON_KEY
  const accessToken = process.env.PATH_SEED_STAFF_ACCESS_TOKEN
  if (!endpoint || !anonKey || !accessToken) {
    throw new SeedCommandError('configuration')
  }
  const url = new URL(endpoint)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new SeedCommandError('configuration')
  }
  // All paths have been validated before the first request. Each RPC is atomic;
  // stable source IDs let a later Phase 4 import resume safely after a failed path.
  for (const path of paths) {
    const response = await fetch(new URL('/rest/v1/rpc/import_learning_path', url), {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ p_path: path }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload || payload.error) {
      // Do not log response bodies or credentials; database errors can include content.
      throw new SeedCommandError('import')
    }
    console.log(`Imported ${path.id}: ${payload.node_count} nodes, ${payload.exercise_count} exercises.`)
  }
}

main().catch(error => {
  switch (error instanceof SeedCommandError ? error.category : undefined) {
    case 'arguments': console.error('Invalid seed arguments. Use --help for the supported command format.'); break
    case 'validation': console.error('Seed schema validation failed. No database request was made.'); break
    case 'configuration': console.error('Staff import needs a local PATH_SEED_SUPABASE_URL, PATH_SEED_ANON_KEY and PATH_SEED_STAFF_ACCESS_TOKEN. No import was attempted.'); break
    case 'import': console.error('Staff seed import failed. Inspect the local database before repeating; earlier paths may already be committed.'); break
    default: console.error('Seed command failed. Check the local seed JSON and connection; no internal error details were logged.')
  }
  process.exitCode = 1
})
