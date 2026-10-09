import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { sitovLoadIntegrated99, createSitovIntegrated99NativeDatabase } from './helpers/sitov-night-integrated99-native-db.mjs'
import { sitovLoadInstallTarget, sitovVerifyPinnedContent, sitovHistorySnapshot, sitovRightsSnapshot, sitovUsers } from './helpers/sitov-night-current-db.mjs'
import { SitovNativeDatabase } from './helpers/sitov-night-current-native-db.mjs'

test('separate immutable99 pins reviewed seven overlays and exact historical canonical source', async () => {
 const { plan, overlays } = await sitovLoadIntegrated99()
 const { schema } = await sitovLoadInstallTarget({ target: 'baseline92' })
 let combined = schema
 for (const [index, item] of plan.overlays.entries()) {
  combined = (item.stripPreviousTrailingWhitespace ? combined.trimEnd() : combined) + item.canonicalPrefix + overlays[index]
  const alias = `${item.through}_${item.name.slice(15)}`
  assert.equal(await readFile(new URL(`../migrations/${item.name}`, import.meta.url), 'utf8'), overlays[index])
  assert.equal(await readFile(new URL(`../vps/${alias}`, import.meta.url), 'utf8'), overlays[index])
  assert.throws(() => sitovVerifyPinnedContent(overlays[index] + 'SELECT 100;', item.sha256, item.name), /checksum mismatch/)
 }
 sitovVerifyPinnedContent(combined, plan.canonicalSha256, 'immutable99 canonical')
 assert.match(plan.sourceIntegrationSha, /^[a-f0-9]{40}$/)
 // Future additive migrations must not invalidate this historical frozen target.
 const pinnedSource = execFileSync('git', ['show', `${plan.sourceIntegrationSha}:supabase/schema.sql`], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
 assert.equal(combined, pinnedSource)
 assert.equal(plan.actualTransportProof, false)
})

test('native combined93–99 preserves rights/history, latest-overlay replay and private read-only boundaries', async () => {
 const database = `sitov_night_combined99_${process.pid}`, admin = new SitovNativeDatabase()
 admin.raw(`CREATE DATABASE ${database}`)
 let db
 try {
  db = await createSitovIntegrated99NativeDatabase({ database, captureBefore: async connection => ({ history: await sitovHistorySnapshot(connection), rights: await sitovRightsSnapshot(connection) }) })
  assert.deepEqual(await sitovHistorySnapshot(db), db.beforeOverlayHistory.history)
  const after = await sitovRightsSnapshot(db)
  assert.deepEqual(after, { ...db.beforeOverlayHistory.rights, german: db.beforeOverlayHistory.rights.german.map(row => ({ ...row, trainer_allowed: true, unit_allowed: true })) })
  const { overlays } = await sitovLoadIntegrated99()
  // The runbook supplies an explicit incremental --apply list. Replaying97 after99
  // would encounter a superseded function contract; only the new99 overlay is replayed.
  await db.exec(`BEGIN; ${overlays.at(-1)} COMMIT;`)
  assert.deepEqual(await sitovHistorySnapshot(db), db.beforeOverlayHistory.history)
  assert.deepEqual(await sitovRightsSnapshot(db), after)
  await db.actor(sitovUsers.selected)
  await assert.rejects(db.query('SELECT * FROM sitov_pronunciation_private.pretest_question_audio_proofs'), /permission denied/)
  await assert.rejects(db.query("SELECT * FROM sitov_storage_private.sitov_audio_metadata('audio_cache','unknown')"), /permission denied/)
  const access = (await db.query('SELECT get_sitov_access_context() AS access')).rows[0].access
  assert.equal(access.vip_enabled, false)
  assert.deepEqual(access.trial, { version: 1, rules: [] })
  assert.deepEqual(access.purchased_levels, [])
  // Baseline hard/readiness/checkpoints alone never constitute an individual pass.
  const raw = db.raw(`BEGIN READ ONLY; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"${sitovUsers.german}"}',true); SELECT count(*) FROM public.learning_reading_texts; ROLLBACK;`)
  assert.equal(raw.split('\n').at(-1), '0')
 } finally { await db?.close(); admin.raw(`DROP DATABASE ${database} WITH(FORCE)`) }
})
