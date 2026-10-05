#!/usr/bin/env node
/**
 * Builds supabase/seeds/path-<level>.json from supabase/seeds/path-src/<level>/index.mjs.
 * Usage: node scripts/build-path-seed.mjs A1.2 [--check]
 * --check writes nothing and fails when the committed seed differs from its sources.
 * Local only: no database is contacted. Import the result with `npm run seed:learning-path`.
 *
 * A failed build lists every rule violation with its rule, its task and its source line.
 * The report only repeats text from the local authoring files of this repository.
 */
import { existsSync, readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildLevelSeed, serializeSeed, RULES, SeedBuildError } from './lib/path-seed-builder.mjs'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LEVELS = ['A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B2.1']

export const seedFile = level => resolve(root, `supabase/seeds/path-${level.toLowerCase()}.json`)
export const sourceDir = level => resolve(root, `supabase/seeds/path-src/${level.toLowerCase()}`)

/** Compiles one level and validates the result against the import schema. */
export async function buildSeed(level, { sources = sourceDir(level) } = {}) {
  if (!LEVELS.includes(level)) throw new Error(`Unbekanntes Niveau: ${level}. Erlaubt: ${LEVELS.join(', ')}`)
  const source = (await import(pathToFileURL(resolve(sources, 'index.mjs')).href)).default
  const seed = buildLevelSeed({ level, paths: source })
  require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
  const { learningPathSeedSchema } = require('../lib/learning-path-schema.ts')
  const parsed = learningPathSeedSchema.safeParse(seed)
  if (!parsed.success) {
    throw new SeedBuildError(parsed.error.issues.map(issue => {
      // [path index, 'nodes', node index, 'exercises', task index, …field] → the task and its source line.
      const [pathIndex, , nodeIndex, list, taskIndex] = issue.path
      const node = seed[pathIndex]?.nodes?.[nodeIndex]
      const task = list === 'exercises' ? node?.exercises?.[taskIndex] : undefined
      const field = issue.path.slice(task ? 5 : node ? 3 : 1).join('.')
      return {
        rule: 'schema', where: [task?.ref ?? node?.id ?? seed[pathIndex]?.id ?? level, field].filter(Boolean).join('.'),
        message: issue.message, path: seed[pathIndex]?.path, ...(task ? seed.origins.get(task.ref) : {}),
      }
    }))
  }
  return seed
}

/** File and line of a violation: the recorded call of the task, else a search in the path file. */
function locate(detail, sources) {
  // Inside the repository a relative path is enough (and clickable in an editor terminal).
  const shown = file => relative(root, file).startsWith('..') ? file : relative(root, file)
  if (detail.origin) return `${shown(fileURLToPath(detail.origin.file))}:${detail.origin.line}`
  if (detail.path == null) return shown(resolve(sources, 'index.mjs'))
  const file = resolve(sources, `p${detail.path}${detail.part === 'check' ? '-check' : ''}.mjs`)
  if (!existsSync(file)) return shown(resolve(sources, 'index.mjs'))
  const line = detail.needle ? readFileSync(file, 'utf8').split('\n').findIndex(text => text.includes(detail.needle)) + 1 : 0
  return line ? `${shown(file)}:${line}` : shown(file)
}

/** The detailed report of a failed build: one block per violation, then the broken rules. */
export function formatBuildError(error, level, { sources = sourceDir(level) } = {}) {
  const details = error.details.map(detail => ({ ...detail, source: locate(detail, sources) }))
  const lines = [`Seed-Validierung fehlgeschlagen: ${level} – ${details.length} ${details.length === 1 ? 'Regelverstoß' : 'Regelverstöße'}`, '']
  details.forEach((detail, index) => {
    lines.push(`${index + 1}) ${detail.where} · Regel „${detail.rule}“`, `   Verstoß: ${detail.message}`, `   Quelle:  ${detail.source}`)
    if (detail.node) lines.push(`   Knoten:  ${detail.node}`)
    if (detail.task) lines.push(`   Aufgabe: ${detail.task}`)
    lines.push('')
  })
  lines.push('Verletzte Regeln:')
  const counts = new Map()
  for (const { rule } of details) counts.set(rule, (counts.get(rule) ?? 0) + 1)
  for (const [rule, count] of counts) lines.push(`  ${rule} (${count}×): ${RULES[rule]}`)
  return lines.join('\n')
}

/** Runs the command line and returns the exit code; `io` receives the output. */
export async function run(args, io = console, options = {}) {
  const [level, ...flags] = args
  if (!level || flags.some(flag => flag !== '--check')) {
    io.error('Usage: node scripts/build-path-seed.mjs <A1.2|A2.1|…> [--check]')
    return 1
  }
  let seed
  try { seed = await buildSeed(level, options) } catch (error) {
    if (error instanceof SeedBuildError) io.error(formatBuildError(error, level, options))
    // Anything else is a defect in a source file (syntax, missing import): show where it happened.
    else io.error(`Seed-Build fehlgeschlagen: ${level}\n${error?.stack ?? error}`)
    return 1
  }
  const output = serializeSeed(seed)
  const nodes = seed.flatMap(path => path.nodes)
  const summary = `${seed.length} Pfade, ${nodes.length} Knoten, ${nodes.reduce((sum, node) => sum + node.exercises.length, 0)} Aufgaben, ${seed.reduce((sum, path) => sum + path.objectives.length, 0)} Lernziele`
  const file = options.output ?? seedFile(level)
  if (flags.includes('--check')) {
    const current = await readFile(file, 'utf8').catch(() => null)
    if (current !== output) {
      io.error(current === null ? `Der Seed ${relative(root, file)} fehlt. Bitte ohne --check bauen.`
        : `Der gespeicherte Seed ${relative(root, file)} entspricht nicht den Quellen. Bitte ohne --check neu bauen.`)
      return 1
    }
    io.log(`Aktuell: ${level} – ${summary}.`)
    return 0
  }
  await writeFile(file, output)
  io.log(`Geschrieben: ${level} – ${summary}.`)
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await run(process.argv.slice(2))
}
