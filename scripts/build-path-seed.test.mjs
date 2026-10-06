import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildSeed, formatBuildError, run, seedFile } from './build-path-seed.mjs'
import { answerKey, buildLevelSeed, RULES, serializeSeed, SeedBuildError, stableId } from './lib/path-seed-builder.mjs'
import { I, asChoice, gap, mc, sb } from '../supabase/seeds/path-src/shared.mjs'

// Levels whose seed is generated from supabase/seeds/path-src/<level>/.
const LEVELS = ['A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B2.1', 'B2.2']
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
  // A "wrong" form that grading cannot tell from the solution (case, punctuation, ae/oe/ue/ss).
  has(source => { source.nodes[0].ex[0] = gap('G1', 'Maß', I.word, 'Die ', ' stimmen.', 'Maße', ['Masse', 'Messe'], four('The measurements are right.'), four('measurements')) }, /„Masse“ ist nur eine andere Schreibweise der Lösung „Maße“/)
  has(source => { source.nodes[0].ex[0] = gap('G1', 'Anrede', I.pronoun, 'Wie heißen ', '?', 'Sie', ['sie.', 'du'], four('What is your name?'), four('you (formal)')) }, /„sie\.“ ist nur eine andere Schreibweise/)
  // Near-identical wrong forms are welcome in every node: grading never forgives them (migration 58).
  assert.deepEqual(problems(source => { source.nodes[2].ex[0] = gap('G1', 'Dativ', I.article, 'seit ', ' Jahr', 'einem', ['einen', 'einer'], four('for a year'), 'ein') }), [])
})

await test('builder: every violation names its rule, its task and its source line', () => {
  let error
  try {
    buildLevelSeed(minimal(source => {
      source.nodes[0].ex[0] = gap('G1', 'sein', I.verb, 'Ich ', ' hier.', 'bin', ['bist', 'ist'], four('I am here.'))
      source.nodes[0].card.examples = ['Eins.']
      source.objectives.K1 = 'Ungeübtes Ziel.'
    }))
  } catch (caught) { error = caught }
  assert.ok(error instanceof SeedBuildError)
  assert.equal(error.details.length, error.problems.length)
  for (const detail of error.details) assert.ok(RULES[detail.rule], detail.rule)
  const hint = error.details.find(detail => detail.rule === 'gap-hint')
  // Gaps follow the choices of a lesson: the seed reference is its position after sorting.
  assert.equal(hint.where, 'P1-N1-E05')
  assert.equal(hint.message, 'Lücke ohne Hinweis (Grundform oder Bedeutung)')
  assert.equal(hint.task, 'Lücke: Ich ___ hier. → bin')
  assert.equal(hint.node, 'Lektion 1 „Lektion“')
  assert.equal(hint.origin.file, import.meta.url)
  assert.ok(hint.origin.line > 0)
  assert.deepEqual(error.details.filter(detail => detail.rule === 'card').map(detail => [detail.where, detail.message, detail.part, detail.needle]),
    [['P1 c1', '2 bis 4 Beispiele erwartet (1)', 'lessons', 'c1']])
  assert.deepEqual(error.details.filter(detail => detail.rule === 'goal-coverage').map(detail => [detail.where, detail.part]),
    [['P1-K1', 'lessons'], ['P1-K1', 'check'], ['P1-K1', 'check']])
})

await test('command line: a failed build reports rule, source file and line of every violation', async () => {
  const sources = await mkdtemp(join(tmpdir(), 'sitov-path-src-'))
  const shared = new URL('../supabase/seeds/path-src/shared.mjs', import.meta.url).href
  const translations = text => JSON.stringify(four(text))
  try {
    await writeFile(join(sources, 'p1.mjs'), [
      `import { I, gap, mc } from '${shared}'`,
      `const task = index => mc('G1', 'Form', I.choose, 'Frage ' + index + '?', ['richtig', 'falsch', 'anders'], ${translations('question')}.map(text => text + index))`,
      'export default { n: 1, slug: \'probe\', title: \'Probe\', t: ' + translations('Sample') + ',',
      '  objectives: {',
      '    G1: \'Eine Form wählen.\',',
      '    K1: \'Ungeübtes Ziel.\',',
      '  },',
      '  nodes: [{ title: \'Formen\', t: ' + translations('Forms') + ',',
      '    card: { id: \'c1\', rule: \'Regel.\', examples: [\'Eins.\', \'Zwei.\'], highlight: null, t: ' + translations('Rule.') + ', hint: [\'Tipp.\', \'Tip en.\', \'Совет.\', \'Порада.\', \'Tip tr.\'] },',
      '    ex: [task(1), task(2), task(3), task(4),',
      '      gap(\'G1\', \'sein\', I.verb, \'Ich \', \' hier.\', \'bin\', [\'bist\', \'ist\'], [\'I am here.\', \'I am here.\', \'Я тут.\', \'Buradayım.\']),',
      '    ] }],',
      '}', ''].join('\n'))
    await writeFile(join(sources, 'p1-check.mjs'), [
      `import { I, mc } from '${shared}'`,
      `const task = index => mc('G1', 'Form', I.choose, 'Frage ' + index + '?', ['richtig', 'falsch', 'anders'], ${translations('question')}.map(text => text + index))`,
      'export default {',
      '  review: [task(6)],',
      '  size: 12,',
      '  test: Array.from({ length: 20 }, (_, index) => task(index + 7)),',
      '}', ''].join('\n'))
    await writeFile(join(sources, 'index.mjs'), [
      "import p1 from './p1.mjs'", "import check from './p1-check.mjs'",
      "export default [{ ...p1, nodes: [...p1.nodes, { kind: 'review', ex: check.review }, { kind: 'test', size: check.size, ex: check.test }] }]", ''].join('\n'))
    const output = { errors: [], logs: [], error(text) { this.errors.push(text) }, log(text) { this.logs.push(text) } }
    assert.equal(await run(['A1.2'], output, { sources, output: join(sources, 'seed.json') }), 1)
    assert.deepEqual(output.logs, [])
    const report = output.errors.join('\n')
    const block = rule => report.split('\n\n').filter(part => part.includes(`Regel „${rule}“`))
    assert.match(report, /^Seed-Validierung fehlgeschlagen: A1\.2 – 6 Regelverstöße\n/)
    // The gap: no hint, and its Russian translation is still English. Both point to line 11 of p1.mjs.
    for (const [rule, where, message] of [['gap-hint', 'P1-N1-E05', 'Lücke ohne Hinweis (Grundform oder Bedeutung)'], ['script', 'P1-N1-E05.task.ru', 'falsche Schrift („I am here.“)']]) {
      const [text] = block(rule)
      assert.ok(text.includes(`${where} · Regel „${rule}“\n   Verstoß: ${message}\n`), text)
      assert.ok(text.includes('p1.mjs:11\n   Knoten:  Lektion 1 „Formen“\n   Aufgabe: Lücke: Ich ___ hier. → bin'), text)
    }
    // Goal K1 is declared in line 6 of p1.mjs; review and test live in p1-check.mjs.
    assert.deepEqual(block('goal-coverage').map(text => text.match(/Quelle: +\S*?(p1[\w-]*\.mjs:\d+)/)[1]), ['p1.mjs:6', 'p1-check.mjs:4', 'p1-check.mjs:6'])
    assert.ok(block('test-size')[0].includes('Testpool 20 kleiner als das Doppelte der Testgröße 12'))
    assert.match(block('test-size')[0], /p1-check\.mjs:5\n   Knoten:  Test/)
    assert.match(report, /Verletzte Regeln:\n(  [\w-]+ \(\d+×\): .+\n?)+$/)
    assert.ok(report.includes(`  gap-hint (1×): ${RULES['gap-hint']}`))

    // A defect in a source file is no content rule: the report shows the original error and its place.
    await mkdir(join(sources, 'broken'))
    await writeFile(join(sources, 'broken', 'index.mjs'), 'export default undefinedPaths\n')
    const broken = { errors: [], error(text) { this.errors.push(text) }, log() {} }
    assert.equal(await run(['B1.2'], broken, { sources: join(sources, 'broken'), output: join(sources, 'seed.json') }), 1)
    assert.match(broken.errors.join('\n'), /^Seed-Build fehlgeschlagen: B1\.2\nReferenceError: undefinedPaths is not defined\n\s+at .*index\.mjs:1:\d+/)
    assert.match(formatBuildError(new SeedBuildError([{ rule: 'schema', where: 'A1.2', message: 'kaputt' }]), 'A1.2', { sources }), /1 Regelverstoß\n\n1\) A1\.2 · Regel „schema“\n   Verstoß: kaputt\n   Quelle: .*index\.mjs/)
  } finally { await rm(sources, { recursive: true, force: true }) }
})

await test('builder: asChoice turns a gap into a choice between the same forms', () => {
  const choice = asChoice(gap('G1', 'Dativ', I.article, 'seit ', ' Jahr', 'einem', ['einen', 'einer'], four('for a year'), 'ein', { h: 'dative' }))
  assert.deepEqual({ type: choice.type, question: choice.question, options: choice.options, h: choice.h },
    { type: 'mc', question: 'seit … Jahr', options: ['einem', 'einen', 'einer'], h: 'dative' })
  assert.deepEqual(problems(source => { source.nodes[2].ex[0] = choice; source.nodes[0].card.hints = { dative: ['Dativ.', 'Dative.', 'Датив.', 'Датів.', 'Dativ tr.'] } }), [])
})

await test('answer key: the same word to grading despite case, punctuation and spelled-out umlauts', () => {
  for (const [left, right, same] of [['Maße', 'masse', true], ['Sie', 'sie.', true], ['fährt', 'Faehrt!', true], ['„Guten Tag“', 'guten  tag', true],
    ['fährt', 'fahrt', false], ['einem', 'einen', false], ['das Haus', 'Haus', false]]) assert.equal(answerKey(left) === answerKey(right), same, `${left} / ${right}`)
})
