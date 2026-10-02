#!/usr/bin/env node
/**
 * Builds supabase/seeds/path-<level>.json from supabase/seeds/path-src/<level>/index.mjs.
 * Usage: node scripts/build-path-seed.mjs A1.2 [--check]
 * --check writes nothing and fails when the committed seed differs from its sources.
 * Local only: no database is contacted. Import the result with `npm run seed:learning-path`.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildLevelSeed, serializeSeed, SeedBuildError } from './lib/path-seed-builder.mjs'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LEVELS = ['A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2']

export const seedFile = level => resolve(root, `supabase/seeds/path-${level.toLowerCase()}.json`)

/** Compiles one level and validates the result against the import schema. */
export async function buildSeed(level) {
  if (!LEVELS.includes(level)) throw new Error(`Unbekanntes Niveau: ${level}. Erlaubt: ${LEVELS.join(', ')}`)
  const source = (await import(pathToFileURL(resolve(root, `supabase/seeds/path-src/${level.toLowerCase()}/index.mjs`)).href)).default
  const seed = buildLevelSeed({ level, paths: source })
  require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
  const { learningPathSeedSchema } = require('../lib/learning-path-schema.ts')
  const parsed = learningPathSeedSchema.safeParse(seed)
  if (!parsed.success) {
    throw new SeedBuildError(parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`))
  }
  return seed
}

async function main() {
  const [level, ...flags] = process.argv.slice(2)
  if (!level || flags.some(flag => flag !== '--check')) {
    console.error('Usage: node scripts/build-path-seed.mjs <A1.2|A2.1|…> [--check]')
    process.exitCode = 1
    return
  }
  const seed = await buildSeed(level)
  const output = serializeSeed(seed)
  const nodes = seed.flatMap(path => path.nodes)
  const summary = `${seed.length} Pfade, ${nodes.length} Knoten, ${nodes.reduce((sum, node) => sum + node.exercises.length, 0)} Aufgaben, ${seed.reduce((sum, path) => sum + path.objectives.length, 0)} Lernziele`
  if (flags.includes('--check')) {
    const current = await readFile(seedFile(level), 'utf8').catch(() => null)
    if (current !== output) {
      console.error(`${seedFile(level)} entspricht nicht den Quellen. Bitte ohne --check neu bauen.`)
      process.exitCode = 1
      return
    }
    console.log(`Aktuell: ${level} – ${summary}.`)
    return
  }
  await writeFile(seedFile(level), output)
  console.log(`Geschrieben: ${level} – ${summary}.`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof SeedBuildError ? error.message : error)
    process.exitCode = 1
  })
}
