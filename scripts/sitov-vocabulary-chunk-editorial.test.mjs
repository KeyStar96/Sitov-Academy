import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = JSON.parse(await readFile(new URL('../content/vocabulary/teacher-source.json', import.meta.url), 'utf8'))
const editorial = JSON.parse(await readFile(new URL('../content/vocabulary/chunk-editorial.json', import.meta.url), 'utf8'))
const chunks = source.units.flatMap(unit => unit.cards.filter(card => card.content_kind === 'chunk'))
test('every intentional teacher chunk has one concrete reviewed example with its stable source identity', () => {
  assert.equal(chunks.length, 354)
  assert.deepEqual(Object.keys(editorial).sort(), chunks.map(card => card.source_id).sort())
  for (const card of chunks) {
    const entry = editorial[card.source_id]
    assert.equal(typeof entry.sentence_de, 'string', card.source_id)
    assert.ok(entry.sentence_de.length > 8 && entry.sentence_de.length <= 300, card.source_id)
    assert.doesNotMatch(entry.sentence_de, /^(?:Beispiel:|Im Alltag sagt man|Wir können heute)/u, card.source_id)
    assert.doesNotMatch(entry.sentence_de, /\b(?:Schwester|Tochter|Freundin|Nachbarin|Kollegin|Lehrerin|Sängerin|Mitarbeiterin|Kellnerin|Krankenschwester|Frau|Anna|Maria|Lisa)\b/u, card.source_id)
    assert.doesNotMatch(entry.sentence_de, /\bSie (?:ist|macht|möchte|hat|kann|studiert|bewirbt|bildet|kommt)\b/u, card.source_id)
    if (/[…+]/u.test(card.word_de)) {
      assert.equal(typeof entry.word_de, 'string', `${card.source_id}: canonical spoken chunks complete teacher grammar shorthand`)
      assert.doesNotMatch(entry.word_de, /[…+]/u, card.source_id)
    }
  }
})
test('material, traffic and reflexive chunks express a plausible action rather than a generic template', () => {
  assert.equal(editorial['sitov-A2.2-L09-C005'].sentence_de, 'Die Vase auf dem Tisch ist aus Glas.')
  assert.equal(editorial['sitov-A2.2-L11-C001'].sentence_de, 'Wir stehen im Stau und kommen später zur Arbeit.')
  assert.equal(editorial['sitov-A2.2-L14-C003'].sentence_de, 'Paul hat sich in Jonas verliebt.')
  assert.equal(editorial['sitov-A2.1-L05-C016'].word_de, 'Ich verabrede mich mit meinem Freund.')
})
