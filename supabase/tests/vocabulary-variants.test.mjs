import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { apply } from './helpers/phase3-db.mjs'
import { createPhase1Database, actor, teacher, student, vocabularyUnit, result } from './helpers/phase1-db.mjs'
import { ambiguityReasons, auditCards } from '../../scripts/audit-vocabulary-variants.mjs'

const snapshot = JSON.parse(await readFile(new URL('../../scripts/fixtures/vocabulary-sentence-audit.json', import.meta.url), 'utf8'))
const decisions = JSON.parse(await readFile(new URL('../../scripts/fixtures/vocabulary-variant-decisions.json', import.meta.url), 'utf8'))
const migration = ['31_vocabulary_target_forms.sql']

await test('sentence audit recognizes every required ambiguity category', () => {
  for (const [sentence, reason] of [
    ['Wie heißen Sie?', 'du_sie'], ['Du wohnst hier.', 'du_sie'], ['Wie heißt du?', 'du_sie'], ['Heute wohne ich in Berlin.', 'word_order'],
    ['Ich trinke morgens Kaffee.', 'word_order'], ['Tschüs!', 'tschuess'], ['Tschüss!', 'tschuess'],
    ['Wie geht’s?', 'gehts'], ['Wie geht es?', 'gehts'], ['Ich heiße Anna.', 'name_forms'], ['Mein Name ist Anna.', 'name_forms'],
    ['Ich habe 2 Kinder.', 'number'], ['Sie ist siebzehn.', 'number'], ['Es sind einundzwanzig.', 'number'], ['Ich habe zwei Kinder.', 'number'], ['Das kostet 2,50 €.', 'price'], ['Das kostet zwei Euro fünfzig.', 'price'],
  ]) assert.ok(ambiguityReasons(sentence).includes(reason), `${sentence}: ${reason}`)
  assert.deepEqual(auditCards([{ sentence_practice: false, sentence: 'Wie heißen Sie?' }]), [])
  assert.equal(auditCards([{ sentence_practice: true, sentence: 'Wie heißen Sie?', target_form: [' '], alternative_answers_de: [] }])[0].resolved, false)
})

await test('Phase 1.4 sentence variants, target form CMS and reversible idempotent migration', async t => {
  const db = await createPhase1Database()
  try {
    for (const card of snapshot.cards) {
      await db.query('INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,sentence_practice,alternative_answers_de) VALUES($1,$2,$3,true,$4)', [card.id, vocabularyUnit, card.word_de, card.alternative_answers_de])
      await db.query("INSERT INTO vocabulary_translations(card_id,locale,context_sentence) VALUES($1,'de',$2)", [card.id, card.sentence])
    }
    const rows = async () => (await db.query(`SELECT c.id,c.sentence_practice,t.context_sentence AS sentence,c.target_form,c.alternative_answers_de FROM learning_vocabulary_cards c JOIN vocabulary_translations t ON t.card_id=c.id AND t.locale='de' ORDER BY c.id`)).rows
    const permissions = async () => (await db.query("SELECT proacl::text,prosecdef,proconfig FROM pg_proc WHERE oid='public.save_learning_content(text,jsonb,uuid)'::regprocedure")).rows
    const beforePermissions = await permissions()
    await apply(db, migration)

    await t.test('all 26 live sentence cards remain and every reported ambiguity has its reviewed decision', async () => {
      assert.equal(snapshot.shared_active_cards, 512)
      assert.equal((await rows()).length, 26)
      const findings = auditCards(await rows())
      assert.equal(findings.length, 15)
      assert.ok(findings.every(card => card.resolved))
      assert.deepEqual(findings.map(card => card.id).sort(), decisions.map(card => card.id).sort())
      for (const decision of decisions) {
        const card = (await rows()).find(card => card.id === decision.id)
        assert.deepEqual(card.target_form, decision.target_form)
        assert.deepEqual(card.alternative_answers_de, decision.alternative_answers_de)
      }
      assert.deepEqual(await permissions(), beforePermissions)
    })
    await t.test('migration replay leaves content and first backup unchanged', async () => {
      const first = await rows()
      const backup = (await db.query('SELECT * FROM learning_private.vocabulary_variant_backups ORDER BY card_id')).rows
      await apply(db, migration)
      assert.deepEqual(await rows(), first)
      assert.deepEqual((await db.query('SELECT * FROM learning_private.vocabulary_variant_backups ORDER BY card_id')).rows, backup)
    })
    const save = async (target, cardId = null) => result(db, "SELECT save_learning_content('vocabulary',$1,$2) result", [JSON.stringify({ unit: { level: 'A1.1', label: 'Lektion 1' }, fields: { word_de: 'heißen', sentence_practice: false, target_form: target }, translations: [] }), cardId])
    await t.test('staff CMS persists, preserves on omitted field and explicitly clears target forms; invalid input returns structured errors', async () => {
      await actor(db, teacher)
      const saved = await save([' heißen ', 'Sie'])
      assert.ok(saved.id, JSON.stringify(saved))
      assert.deepEqual((await db.query('SELECT target_form FROM learning_vocabulary_cards WHERE id=$1', [saved.id])).rows[0].target_form, ['heißen', 'Sie'])
      assert.ok((await save(undefined, saved.id)).id)
      assert.deepEqual((await db.query('SELECT target_form FROM learning_vocabulary_cards WHERE id=$1', [saved.id])).rows[0].target_form, ['heißen', 'Sie'])
      for (const invalid of ['heißen', [null], [' '], ['x'.repeat(121)], Array(13).fill('lernen')]) assert.equal((await save(invalid, saved.id)).error, 'invalid_input')
      assert.ok((await save([], saved.id)).id)
      assert.deepEqual((await db.query('SELECT target_form FROM learning_vocabulary_cards WHERE id=$1', [saved.id])).rows[0].target_form, [])
      assert.ok((await save(null, saved.id)).id)
      assert.equal((await db.query('SELECT target_form FROM learning_vocabulary_cards WHERE id=$1', [saved.id])).rows[0].target_form, null)
      await actor(db, student)
      assert.equal((await save(['lernen'])).error, 'not_authorized')
      await assert.rejects(db.query('SELECT * FROM learning_private.vocabulary_variant_backups'), error => error.code === '42501')
      await db.exec('RESET ROLE')
    })
    await t.test('replay and rollback preserve later CMS edits while restoring untouched decisions', async () => {
      const edited = decisions[0].id
      await db.query('UPDATE learning_vocabulary_cards SET target_form=$2 WHERE id=$1', [edited, ['Telefonnummer', 'Ihre']])
      await apply(db, migration)
      assert.deepEqual((await rows()).find(card => card.id === edited).target_form, ['Telefonnummer', 'Ihre'])
      await apply(db, ['rollback/31_vocabulary_target_forms.sql'])
      await apply(db, ['rollback/31_vocabulary_target_forms.sql'])
      const restored = await rows()
      assert.deepEqual(restored.find(card => card.id === edited).target_form, ['Telefonnummer', 'Ihre'])
      for (const card of restored.filter(card => card.id !== edited)) {
        assert.equal(card.target_form, null)
        assert.deepEqual(card.alternative_answers_de, [])
      }
      await apply(db, migration)
      assert.ok(auditCards(await rows()).every(card => card.resolved))
    })
  } finally { await db.close() }
})
