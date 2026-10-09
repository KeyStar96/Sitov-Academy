import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { SitovNativeDatabase, createSitovCurrentNativeDatabase } from './helpers/sitov-night-current-native-db.mjs'

const migrationUrl = new URL('../vps/113_sitov_staff_legacy_verb_scope.sql', import.meta.url)
test('113 mirrors the reviewed migration and is registered after 112', async () => {
 const migration = await readFile(migrationUrl, 'utf8')
 assert.equal(migration, await readFile(new URL('../migrations/20261009200300_sitov_staff_legacy_verb_scope.sql', import.meta.url), 'utf8'))
 const runner = await readFile(new URL('../../deploy/vps/migrate-local.py', import.meta.url), 'utf8')
 assert.ok(runner.indexOf("ORDER.append('113_sitov_staff_legacy_verb_scope.sql')") > runner.indexOf("ORDER.append('112_sitov_legacy_metadata_performance.sql')"))
 assert.equal((migration.match(/CREATE OR REPLACE FUNCTION/g) ?? []).length, 2)
 assert.doesNotMatch(migration, /\b(?:GRANT|REVOKE|ALTER|DROP)\b/)
})
test('113 native PostgreSQL17 rollback counterexamples and metadata invariants', { skip: process.env.SITOV_NIGHT_NATIVE !== '1' }, async t => {
 const database = `sitov_night_s1_staff113_${process.pid}`
 const admin = new SitovNativeDatabase()
 let db
 admin.raw(`CREATE DATABASE ${database}`)
 try {
  db = await createSitovCurrentNativeDatabase({ database })
  await db.exec(await readFile(new URL('../vps/93_sitov_commercial_access.sql', import.meta.url), 'utf8'))
  const migration = await readFile(migrationUrl, 'utf8')
  let fixture = await readFile(new URL('./sitov-staff-legacy-verb-native.sql', import.meta.url), 'utf8')
  fixture = fixture.replace('-- SITOV113_FIRST_APPLICATION', migration).replace('-- SITOV113_SECOND_APPLICATION', migration)
  const output = execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql', ['-X','-w','-qAt','-h','/tmp/sitov-night-2026-10-08-pg','-p','55438','-d',database,'-v','ON_ERROR_STOP=1'], { input: fixture, encoding:'utf8', timeout:60000, maxBuffer:4*1024*1024, env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PG'))), stdio:['pipe','pipe','pipe'] })
  const result = JSON.parse(output.trim().split('\n').at(-1))
  assert.equal(result.sitovStaff113Passed, true)
  assert.equal(result.checks, 24)
  assert.ok(result.studentActors >= 5)
  t.diagnostic(JSON.stringify(result))
 } finally {
  if (db) await db.close()
  admin.raw(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`)
 }
})
