import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCurrentDatabase, id, student, teacher } from './helpers/current-db.mjs'

const revisions = JSON.parse(await readFile(new URL('../seeds/sitov-pronunciation-revisions-2026.json', import.meta.url), 'utf8'))
const seed = JSON.parse(await readFile(new URL('../seeds/pronunciation-reading-2026.json', import.meta.url), 'utf8'))
const migration = await readFile(new URL('../vps/66_sitov_pronunciation_readiness.sql', import.meta.url), 'utf8')
const block = migration.slice(migration.indexOf('-- BEGIN SITOV MALE PRONUNCIATION READINGS'))

test('male pronunciation curriculum keeps stable text IDs and all reviewed sentence changes', () => {
 assert.equal(seed.length, 60)
 assert.equal(new Set(seed.map(row => row.id)).size, 60)
 assert.equal(revisions.length, 35)
 for (const revision of revisions) {
  const current = seed.find(row => row.id === revision.id)
  assert.equal(current.title, revision.title)
  assert.equal(current.text, revision.text)
  assert.ok(block.includes(revision.id))
 }
 assert.ok(!seed.some(row => /\b(?:Anna|Leyla|Maria|Mutter|Schwester|Tochter|Freundin|Nachbarin|Lehrerin|Kollegin|Verkäuferin|Chefin|Trainerin|Mitarbeiterin|Rentnerin|Beraterin|Organisatorin|Frau|Bekannte)\b/u.test(`${row.title} ${row.text}`)))
})

test('reading revision archives old references, keeps recorded snapshots and respects custom edits', async () => {
 const db = await createCurrentDatabase()
 try {
  const original = revisions.find(row => row.oldTitle !== row.title)
  const custom = revisions.find(row => row.id !== original.id)
  const thread = id(910000), message = id(910001)
  const audio = `storage://pronunciation_audio/${student}/${id(910002)}.webm`
  const reference = 'https://media.example.test/old-teacher-reference.mp3'
  await db.exec('RESET ROLE')
  for (const row of [original, custom]) {
   await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.1','pronunciation',$2)", [row.id, row.oldTitle])
   await db.query('INSERT INTO learning_reading_texts(id,unit_id,sentence_de,audio_url) VALUES($1,$1,$2,$3)', [row.id, row.id === custom.id ? 'Ein individuell bearbeiteter Text.' : row.oldText, reference])
  }
  // Fixtures capture already committed records; write-boundary tests own their triggers.
  await db.exec('SET session_replication_role=replica')
  await db.query("INSERT INTO submissions(id,auth_user_id,type,prompt_id,content_url,text_content,status,level) VALUES($1,$2,'audio',$3,$4,$5,'reviewed','A1.1')", [thread, student, original.id, audio, original.oldText])
  await db.query("INSERT INTO pronunciation_messages(id,submission_id,sender_id,sender_role,text_content) VALUES($1,$2,$3,'teacher','Gut gelesen!')", [message, thread, teacher])
  await db.exec('SET session_replication_role=origin')
  const before = (await db.query('SELECT * FROM submissions WHERE id=$1', [thread])).rows[0]
  const beforeMessage = (await db.query('SELECT * FROM pronunciation_messages WHERE id=$1', [message])).rows[0]
  await db.exec('CREATE SCHEMA IF NOT EXISTS sitov_pronunciation_private')
  await db.exec(block)
  assert.deepEqual((await db.query('SELECT * FROM submissions WHERE id=$1', [thread])).rows[0], before)
  assert.deepEqual((await db.query('SELECT * FROM pronunciation_messages WHERE id=$1', [message])).rows[0], beforeMessage)
  assert.deepEqual((await db.query('SELECT sentence_de,audio_url FROM learning_reading_texts WHERE id=$1', [original.id])).rows[0], { sentence_de: original.text, audio_url: null })
  assert.equal((await db.query('SELECT label FROM learning_units WHERE id=$1', [original.id])).rows[0].label, original.title)
  assert.deepEqual((await db.query('SELECT sentence_de,audio_url FROM learning_reading_texts WHERE id=$1', [custom.id])).rows[0], { sentence_de: 'Ein individuell bearbeiteter Text.', audio_url: reference })
  assert.deepEqual((await db.query('SELECT prompt_id,sentence_de,audio_url FROM sitov_pronunciation_private.legacy_reference_audio')).rows, [{ prompt_id: original.id, sentence_de: original.oldText, audio_url: reference }])
  // Reapplying cannot rewrite snapshots or overwrite the archived reference.
  await db.exec(block)
  assert.equal((await db.query('SELECT count(*)::integer count FROM sitov_pronunciation_private.legacy_reference_audio')).rows[0].count, 1)
 } finally { await db.close() }
})
