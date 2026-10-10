import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { buildLevelSeed, SeedBuildError } from './path-seed-builder.mjs'
import { I, mc, sb } from '../../supabase/seeds/path-src/shared.mjs'

const four = text => [`${text} en`, `${text} ру`, `${text} ук`, `${text} tr`]
function fixture(sentence = 'Ich / bin / hier.', extra = {}) {
  const task = index => mc('G1', 'Form', I.choose, `Frage ${index}?`, ['richtig', 'falsch', 'anders'], four(`question ${index}`))
  return { level: 'A1.2', paths: [{
    n: 1, slug: 'probe', title: 'Probe', t: four('Sample'), objectives: { G1: 'Eine Form wählen.' },
    nodes: [
      { title: 'Lektion', t: four('Lesson'), card: { id: 'c1', rule: 'Regel.', examples: ['Eins.', 'Zwei.'], highlight: null, t: four('Rule.'),
        hint: ['Tipp.', 'Tip en.', 'Совет.', 'Порада.', 'Tip tr.'] },
      ex: [sb('G1', 'Satz', I.order, sentence, four('Sentence.'), extra), ...[2, 3, 4, 5].map(task)] },
      { kind: 'review', ex: [task(6)] },
      { kind: 'test', size: 12, ex: Array.from({ length: 24 }, (_, index) => task(index + 7)) },
    ],
  }] }
}
const builtTask = source => buildLevelSeed(source)[0].nodes[0].exercises.at(-1)
// Frozen pre-contract algorithm: also covers the legacy rotation when hash order is the solution.
const legacyOrder = (values, ref) => {
  const order = values.map((value, index) => ({ value, key: createHash('sha256').update(`${ref}:${index}:${value}`).digest('hex') }))
    .sort((a, b) => a.key < b.key ? -1 : 1).map(item => item.value)
  return order.join(' ') === values.join(' ') ? [...order.slice(1), order[0]] : order
}

test('sitovPartsOrder: absent and undefined retain legacy hash shuffle and rotation', () => {
  for (const parts of [['Ich', 'bin', 'hier'], ['Er', 'sagt', 'ja', 'ja'], ...Array.from({ length: 30 }, (_, i) => ['Wir', `lernen${i}`, 'hier'])]) {
    const sentence = `${parts.join(' / ')}.`
    const absent = builtTask(fixture(sentence))
    assert.deepEqual(absent.content.parts, legacyOrder(parts, absent.ref))
    assert.deepEqual(builtTask(fixture(sentence, { sitovPartsOrder: undefined })), absent)
  }
})

test('sitovPartsOrder: valid permutations preserve keys, alternatives and source arrays', () => {
  const requested = Object.freeze(['hier', 'Ich', 'bin'])
  const source = fixture(undefined, { sitovPartsOrder: requested, alt: ['Hier bin ich.'] })
  const compiled = builtTask(source)
  assert.deepEqual(compiled.content.parts, requested)
  assert.notEqual(compiled.content.parts, requested)
  assert.equal(compiled.content.correct_answer, 'Ich bin hier.')
  assert.deepEqual(compiled.accepted_answers, ['Ich bin hier.', 'Hier bin ich.'])
  compiled.content.parts.reverse()
  assert.deepEqual(requested, ['hier', 'Ich', 'bin'])
  assert.deepEqual(builtTask(fixture(undefined, { sitovPartsOrder: ['Ich', 'bin', 'hier'] })).content.parts, ['Ich', 'bin', 'hier'])
})

test('sitovPartsOrder: repeated parts retain their exact multiplicities', () => {
  const requested = ['ja', 'Er', 'ja', 'sagt']
  const compiled = builtTask(fixture('Er / sagt / ja / ja.', { sitovPartsOrder: requested }))
  assert.deepEqual(compiled.content.parts, requested)
  assert.equal(compiled.content.correct_answer, 'Er sagt ja ja.')
})

for (const [name, requested] of [
  ['null', null], ['string', 'hier Ich bin'], ['object', {}], ['empty', []],
  ['missing', ['Ich', 'bin']], ['extra', ['Ich', 'bin', 'hier', 'dort']],
  ['different', ['Ich', 'bin', 'dort']], ['case changed', ['ich', 'bin', 'hier']],
  ['non-string', ['Ich', 'bin', 7]], ['sparse', Array(3)], ['duplicate replacing part', ['Ich', 'bin', 'bin']],
]) test(`sitovPartsOrder: rejects ${name} with a located SeedBuildError`, () => {
  assert.throws(() => builtTask(fixture(undefined, { sitovPartsOrder: requested })), error => {
    assert.ok(error instanceof SeedBuildError)
    const detail = error.details.find(item => item.message.includes('explizite Satzteilreihenfolge'))
    assert.equal(detail?.rule, 'sentence-building')
    assert.equal(detail?.where, 'P1-N1-E05')
    assert.match(detail?.task, /Satzbau: Ich/)
    assert.ok(detail?.origin?.file)
    return true
  })
})

test('sitovPartsOrder: rejects changed duplicate counts and aggregates errors', () => {
  const source = fixture('Er / sagt / ja / ja.', { sitovPartsOrder: ['Er', 'sagt', 'sagt', 'ja'] })
  source.paths[0].nodes[0].ex[1].sitovOptionOrder = ['foreign', 'falsch', 'anders']
  assert.throws(() => buildLevelSeed(source), error => {
    assert.ok(error instanceof SeedBuildError)
    assert.ok(error.details.some(item => item.rule === 'sentence-building'))
    assert.ok(error.details.some(item => item.rule === 'choice-options'))
    return true
  })
})
