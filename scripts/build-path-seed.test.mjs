import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildSeed, seedFile } from './build-path-seed.mjs'
import { buildLevelSeed, passesAsTypo, serializeSeed, SeedBuildError, stableId } from './lib/path-seed-builder.mjs'
import { I, asChoice, gap, mc, sb } from '../supabase/seeds/path-src/shared.mjs'

// Levels whose seed is generated from supabase/seeds/path-src/<level>/.
const LEVELS = ['A1.2']
const four = text => [`${text} en`, `${text} ру`, `${text} ук`, `${text} tr`]

/** The smallest valid path: one lesson with five tasks, a review and a test pool of 24. */
function minimal(change = () => {}) {
  const task = index => mc('G1', 'Form', I.choose, `Frage ${index}?`, ['richtig', 'falsch', 'anders'], four(`question ${index}`))
  const source = {
    n: 1, slug: 'probe', title: 'Probe', t: four('Sample'), objectives: { G1: 'Eine Form wählen.' },
    nodes: [
      { title: 'Lektion', t: four('Lesson'), card: { id: 'c1', rule: 'Regel.', examples: ['Eins.', 'Zwei.'], highlight: null, t: four('Rule.'),
        hint: ['Tipp.', 'Tip en.', 'Совет.', 'Порада.', 'Tip tr.'] }, ex: [1, 2, 3, 4, 5].map(task) },
      { kind: 'review', ex: [task(6)] },
      { kind: 'test', size: 12, ex: Array.from({ length: 24 }, (_, index) => task(index + 7)) },
    ],
  }
  change(source)
  return { level: 'A1.2', paths: [source] }
}
const problems = change => {
  try { buildLevelSeed(minimal(change)); return [] } catch (error) {
    assert.ok(error instanceof SeedBuildError, String(error))
    return error.problems
  }
}

for (const level of LEVELS) await test(`${level}: the committed seed is exactly what its sources build`, async () => {
  const built = serializeSeed(await buildSeed(level))
  assert.equal(await readFile(seedFile(level), 'utf8'), built, 'run: node scripts/build-path-seed.mjs ' + level)
})

await test('builder: derives ids, goals, cards and a shuffled option order from the sources', () => {
  const [path] = buildLevelSeed(minimal())
  assert.deepEqual(path.nodes.map(node => [node.id, node.kind]), [['P1-N1', 'practice'], ['P1-N2', 'review'], ['P1-N3', 'test']])
  assert.equal(path.unit.label, 'A1.2 · Pfad 1 · Probe')
  assert.deepEqual(path.objectives, [{ id: 'P1-G1', area: 'grammar', description: 'Eine Form wählen.' }])
  const first = path.nodes[0].exercises[0]
  assert.equal(first.ref, 'P1-N1-E01')
  assert.equal(first.id, stableId('sitov-path:A1.2:P1-N1-E01'))
  assert.equal(first.explanation, 'Regel.')
  assert.equal(first.translations.ru.explanation, 'Rule. ру')
  assert.equal(first.translations.uk.hint, 'Порада.')
  assert.deepEqual([...first.content.options].sort(), ['anders', 'falsch', 'richtig'])
  // Review and test explain with the card of the lesson that practises the goal.
  assert.equal(path.nodes[2].exercises[0].explanation_card, 'c1')
  assert.deepEqual(buildLevelSeed(minimal()), buildLevelSeed(minimal()), 'the build is deterministic')
})

await test('builder: sorts a lesson from recognising to writing and builds gaps and word order', () => {
  const [path] = buildLevelSeed(minimal(source => {
    source.nodes[0].ex.unshift(
      sb('G1', 'Satz', I.order, 'Ich / bin / hier.', four('I am here.'), { alt: ['Hier bin ich.'] }),
      gap('G1', 'sein', I.verb, 'Ich ', ' hier.', 'bin', ['bist', 'ist'], four('I am here.'), 'sein'),
      gap('G1', 'Artikel', I.article, 'Das ist ', '.', 'der Tisch', ['die Tisch', 'das Tisch'], four('That is the table.'), four('table')))
  }))
  const tasks = path.nodes[0].exercises
  assert.deepEqual(tasks.map(task => task.exercise_type).slice(-4), ['multiple_choice', 'fill_in_blank', 'fill_in_blank', 'sentence_building'])
  const [verb, article] = tasks.filter(task => task.exercise_type === 'fill_in_blank')
  assert.equal(verb.content.gap_hint, 'sein')
  assert.equal(verb.translations.en.gap_hint, undefined)
  assert.equal(article.content.needs_article, true)
  assert.equal(article.translations.uk.gap_hint, 'table ук')
  const order = tasks.at(-1).content
  assert.deepEqual([...order.parts].sort(), ['Ich', 'bin', 'hier'])
  assert.notEqual(order.parts.join(' '), 'Ich bin hier')
  assert.deepEqual(order.accepted_answers, ['Ich bin hier.', 'Hier bin ich.'])
})

await test('builder: refuses content that breaks the path rules', () => {
  const has = (change, pattern) => assert.ok(problems(change).some(problem => pattern.test(problem)), `${pattern}: ${problems(change).join(' | ')}`)
  has(source => { source.nodes[0].ex.pop() }, /5 bis 10 Aufgaben/)
  has(source => { source.nodes[2].size = 13 }, /Testpool/)
  has(source => { source.objectives.K1 = 'Ungeübtes Ziel.' }, /P1-K1: weniger als zwei Übungsaufgaben/)
  has(source => { source.nodes[0].ex[0] = { ...source.nodes[0].ex[1] } }, /gleiche Aufgabe/)
  has(source => { source.nodes[0].ex[0].tr = undefined }, /Übersetzung der Aufgabe fehlt/)
  has(source => { source.nodes[0].ex[0].tr = ['a', 'b', 'c', 'd'] }, /task\.ru: falsche Schrift/)
  has(source => { source.nodes[0].ex[0].question = 'Вопрос?' }, /kein deutscher Text/)
  has(source => { source.nodes[0].ex[0] = gap('G1', 'sein', I.verb, 'Ich ', ' hier.', 'bin', ['bist', 'ist'], four('I am here.')) }, /Lücke ohne Hinweis/)
  has(source => { source.nodes[0].ex[0] = gap('G1', 'sein', I.verb, 'Wir ', ' hier.', 'sind', ['seid', 'ist'], four('We are here.'), 'sind') }, /Der Hinweis nennt die Lösung/)
  has(source => { source.nodes[0].ex[0] = sb('G1', 'Satz', I.order, 'Ich / bin / hier.', four('I am here.'), { alt: ['Hier bist du.'] }) }, /benutzt andere Wörter/)
  has(source => { source.nodes[0].ex[0].c = 'unbekannt' }, /Merkkarte unbekannt fehlt/)
  has(source => { source.nodes[2].ex[0] = gap('G1', 'Dativ', I.article, 'seit ', ' Jahr', 'einem', ['einen', 'einer'], four('for a year'), 'ein') }, /gälte als Tippfehler/)
})

await test('builder: asChoice asks for near-identical forms by choice instead of typing', () => {
  const choice = asChoice(gap('G1', 'Dativ', I.article, 'seit ', ' Jahr', 'einem', ['einen', 'einer'], four('for a year'), 'ein', { h: 'dative' }))
  assert.deepEqual({ type: choice.type, question: choice.question, options: choice.options, h: choice.h },
    { type: 'mc', question: 'seit … Jahr', options: ['einem', 'einen', 'einer'], h: 'dative' })
  assert.deepEqual(problems(source => { source.nodes[2].ex[0] = choice; source.nodes[0].card.hints = { dative: ['Dativ.', 'Dative.', 'Датив.', 'Датів.', 'Dativ tr.'] } }), [])
})

await test('typo mirror: agrees with learning_private.grade_answer on what passes as a typing error', () => {
  for (const [typed, accepted, expected] of [
    ['einer', ['einem'], true], ['hilfst', ['hilft'], true], ['Kochin', ['Köchin'], true], ['Koechin', ['Köchin'], true],
    ['Sehr geehrte', ['Lieber', 'Sehr geehrter'], true], ['zwanzigte', ['zwanzigste'], true],
    // Words under four letters stay exact: articles, pronouns, prepositions.
    ['den', ['dem'], false], ['ihm', ['ihn'], false], ['muss', ['musst'], true], ['sei', ['seid'], false],
    ['vor', ['seit'], false], ['werden', ['wird'], false], ['zwanzig', ['zwanzigste'], false], ['einem', ['einem'], true],
  ]) assert.equal(passesAsTypo(typed, accepted), expected, `${typed} → ${accepted.join('/')}`)
})
