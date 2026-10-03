import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { grammarWriteSchema, normalizeGrammarAnswer } from '@/lib/grammar-validation'
import { learningPathSeedSchema } from '@/lib/learning-path-schema'
import { EXERCISE_TYPES } from '@/lib/types/exercise'

/**
 * Lernpfade ab A1.2 (supabase/seeds/path-<niveau>.json), derzeit A1.2, A2.1 und A2.2. Die Seeds entstehen aus den
 * Quellen in supabase/seeds/path-src/<niveau>/ (scripts/build-path-seed.mjs) und müssen
 * denselben Vertrag erfüllen wie A1.1: Pfade → Lektionen mit Merkkarte → Wiederholung →
 * Test, jedes Lernziel geübt, wiederholt und geprüft, alles in fünf Sprachen.
 * „from“ in LATER: erst ab diesem Pfad eingeführte Formen dürfen vorher in keiner Aufgabe stehen.
 */
type Locale = 'en' | 'ru' | 'uk' | 'tr'
interface SeedExercise {
  id: string; ref: string; goal: string; exercise_type: string
  content: Record<string, unknown> & {
    target_form: string[]; instruction: string; correct_answer: string; accepted_answers: string[]
    options?: string[]; parts?: string[]; gap_hint?: string; needs_article?: boolean
  }
  accepted_answers: string[]; hint: string; explanation: string; explanation_card: string
  translations: Record<Locale, { instruction: string; hint: string; explanation: string; task?: string; gap_hint?: string }>
}
interface SeedNode {
  id: string; kind: string; sort_order: number; topic: string; title: string; goals: string[]
  translations: Record<Locale, { title: string }>
  merkkarte?: { card: string; rule: string; examples: string[]; highlight: string | null; translations: Record<Locale, { rule: string }> }
  test_size?: number; exercises: SeedExercise[]
}
interface SeedPath {
  id: string; level: string; path: number; slug: string; title: string; translations: Record<Locale, { title: string }>
  unit: { level: string; trainer: string; label: string; sort_order: number }
  objectives: { id: string; area: string; description: string }[]; nodes: SeedNode[]
}
interface LevelRules { later: { from: number; words: string[] }[] }

const LEVELS: Record<string, LevelRules> = {
  'A1.2': { later: [
    { from: 2, words: ['muss', 'musst', 'müsst', 'müssen', 'darf', 'darfst', 'dürft', 'dürfen'] },
    { from: 3, words: ['soll', 'sollst', 'sollt', 'sollen'] },
    { from: 5, words: ['könnten', 'könntest', 'würden', 'würdest'] },
    // „Welcher Satz …?“ gehört seit A1.1 zur Aufgabensprache; neu sind in Pfad 6 dieser/dieses/diesen.
    { from: 6, words: ['dieser', 'dieses', 'diesen', 'besser', 'liebsten', 'meisten', 'mag', 'magst', 'mögt'] },
    { from: 7, words: ['werde', 'wirst', 'wird', 'werdet'] },
  ] },
  'A2.1': { later: [
    { from: 2, words: ['hierhin', 'dahin', 'dorthin', 'rein', 'raus', 'rauf', 'runter', 'rüber'] },
    { from: 3, words: ['eins', 'keins', 'meins'] },
    { from: 4, words: ['wenn', 'sollte', 'solltest', 'solltet', 'sollten'] },
    { from: 5, words: ['dafür', 'darauf', 'daran', 'darüber', 'damit', 'davon', 'wofür', 'worauf', 'woran', 'worüber', 'womit', 'wovon'] },
    { from: 6, words: ['dass', 'musste', 'musstest', 'mussten', 'musstet', 'konnte', 'konntest', 'konnten', 'konntet',
      'wollte', 'wolltest', 'wollten', 'wolltet', 'durfte', 'durftest', 'durften', 'durftet'] },
  ] },
  'A2.2': { later: [
    // Vergleichspartikel „als“ (schöner als …) erst ab Pfad 2.
    { from: 2, words: ['als'] },
    // Passiv mit wird/werden erst ab Pfad 3; würde/würden (Pfad 1) sind andere Formen.
    { from: 3, words: ['wird', 'werden'] },
    { from: 4, words: ['deshalb', 'entlang', 'gegenüber'] },
    // „Lass uns …“ ist in Pfad 5 eine feste Wendung; das Verb lassen folgt in Pfad 6.
    { from: 6, words: ['ob', 'lassen', 'lässt', 'lasst'] },
  ] },
}
const LOCALES: Locale[] = ['en', 'ru', 'uk', 'tr']
const TYPE_ORDER = ['multiple_choice', 'fill_in_blank', 'sentence_building']
const AREAS: Record<string, string> = { G: 'grammar', K: 'communication', Z: 'can_do', W: 'vocabulary' }
// Mirrors learning_private.german_text_allowed and grammar_private.german_content_allowed.
const NOT_GERMAN = /[Ѐ-ԯᲀ-᲏ᴫᵸⷠ-ⷿꙀ-ꚟ\u{1E030}-\u{1E08F}ığşİĞŞ]/u
const GERMAN_FIELDS = ['instruction', 'text_before', 'text_after', 'question', 'correct_answer', 'gap_hint', 'options', 'accepted_answers', 'parts', 'target_form']
const TASK_FIELDS = ['text_before', 'text_after', 'question', 'correct_answer', 'options', 'accepted_answers', 'parts']
const CYRILLIC = /[Ѐ-ӿ]/
const TEXTBOOK = /Schritte plus|Schritte international|Menschen A[12]|Netzwerk neu|Studio d|Begegnungen A[12]|Linie 1|Berliner Platz|Pluspunkt Deutsch|Momente A[12]|Motive A[12]|DaF kompakt|ÜG\s*\d|\bLektion \d|\bSeite \d/
// Translating "which word does not belong" would give the answer away.
const UNTRANSLATED = ['Welches Wort passt nicht in die Gruppe?']
const stableId = (value: string) => {
  const hex = createHash('sha256').update(value).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
const words = (value: string) => (value.match(/[\p{L}\p{N}'-]+/gu) ?? []).map(word => word.toLocaleLowerCase('de-DE')).sort()
const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

describe.each(Object.entries(LEVELS))('%s learning path seed', (level, rules) => {
  // Parsed at runtime so the 4 MB file never becomes a TypeScript literal type.
  const paths: SeedPath[] = JSON.parse(readFileSync(join(__dirname, `../supabase/seeds/path-${level.toLowerCase()}.json`), 'utf8'))
  const rows = paths.flatMap(path => path.nodes.flatMap(node => node.exercises.map(exercise => ({ path, node, exercise }))))

  it('passes the import schema unchanged', () => {
    expect(learningPathSeedSchema.parse(paths)).toEqual(paths)
  })

  it('builds seven paths from lessons, one review and one final test', () => {
    expect(paths.map(path => path.path)).toEqual([1, 2, 3, 4, 5, 6, 7])
    for (const path of paths) {
      expect(path).toMatchObject({ id: `P${path.path}`, level, unit: { level, trainer: 'exercises', sort_order: path.path } })
      expect(path.unit.label).toBe(`${level} · Pfad ${path.path} · ${path.title}`)
      for (const locale of LOCALES) expect(CYRILLIC.test(path.translations[locale].title)).toBe(locale === 'ru' || locale === 'uk')
      expect(path.nodes.map(node => node.sort_order)).toEqual(path.nodes.map((_, index) => index + 1))
      expect(path.nodes.map(node => node.kind)).toEqual([...path.nodes.slice(0, -2).map(() => 'practice'), 'review', 'test'])
      for (const node of path.nodes) {
        expect(node.id).toBe(`P${path.path}-N${node.sort_order}`)
        expect(node.topic).toBe(`${path.title} · ${node.title}`)
        expect([...node.goals].sort()).toEqual([...new Set(node.exercises.map(exercise => exercise.goal))].sort())
        for (const locale of LOCALES) expect(CYRILLIC.test(node.translations[locale].title)).toBe(locale === 'ru' || locale === 'uk')
        // Vom Erkennen zum Schreiben: Auswahl zuerst, dann Lücken, dann Satzbau.
        const order = node.exercises.map(exercise => TYPE_ORDER.indexOf(exercise.exercise_type))
        expect(order).toEqual([...order].sort((a, b) => a - b))
      }
    }
  })

  it('starts every lesson with a rule card in German and all interface languages', () => {
    const cards = new Set<string>()
    for (const node of paths.flatMap(path => path.nodes)) {
      if (node.kind !== 'practice') { expect(node.merkkarte).toBeUndefined(); continue }
      expect(node.exercises.length).toBeGreaterThanOrEqual(5)
      expect(node.exercises.length).toBeLessThanOrEqual(10)
      const card = node.merkkarte!
      expect(cards.has(card.card)).toBe(false)
      cards.add(card.card)
      expect(node.exercises.map(exercise => exercise.explanation_card)).toContain(card.card)
      expect(card.rule).toBe(node.exercises.find(exercise => exercise.explanation_card === card.card)!.explanation)
      expect(card.examples.length).toBeGreaterThanOrEqual(2)
      expect(card.examples.length).toBeLessThanOrEqual(4)
      expect(NOT_GERMAN.test(`${card.rule} ${card.examples.join(' ')}`)).toBe(false)
      expect([null, 'article', 'verb']).toContain(card.highlight)
      for (const locale of LOCALES) {
        expect(card.translations[locale].rule).not.toBe(card.rule)
        expect(CYRILLIC.test(card.translations[locale].rule)).toBe(locale === 'ru' || locale === 'uk')
      }
    }
    // Wiederholung und Test erklären mit den Merkkarten der Lektionen.
    for (const { exercise } of rows) expect(cards.has(exercise.explanation_card)).toBe(true)
  })

  it('assigns one goal per task and covers every goal in practice, review and every test draw', () => {
    for (const path of paths) {
      const ids = path.objectives.map(objective => objective.id)
      for (const objective of path.objectives) {
        expect(objective.id).toMatch(new RegExp(`^P${path.path}-[GKZW]\\d+$`))
        expect(objective.area).toBe(AREAS[objective.id.split('-')[1][0]])
      }
      const goals = (kind: string) => path.nodes.filter(node => node.kind === kind).flatMap(node => node.exercises.map(exercise => exercise.goal))
      const [practice, review, pool] = [goals('practice'), goals('review'), goals('test')]
      expect([...practice, ...review, ...pool].every(goal => ids.includes(goal))).toBe(true)
      const test = path.nodes[path.nodes.length - 1]
      expect(test.test_size).toBeGreaterThanOrEqual(Math.max(12, ids.length))
      expect(test.test_size).toBeLessThanOrEqual(16)
      expect(pool.length).toBeGreaterThanOrEqual(2 * test.test_size!)
      for (const id of ids) {
        expect(practice.filter(goal => goal === id).length).toBeGreaterThanOrEqual(2)
        expect(review).toContain(id)
        expect(pool.filter(goal => goal === id).length).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('uses stable unique identifiers and never repeats a task', () => {
    for (const { node, exercise } of rows) {
      expect(exercise.ref).toMatch(new RegExp(`^${node.id}-E\\d{2}$`))
      expect(exercise.id).toBe(stableId(`sitov-path:${level}:${exercise.ref}`))
    }
    expect(new Set(rows.map(row => row.exercise.id)).size).toBe(rows.length)
    const tasks = rows.map(({ exercise: { content } }) => JSON.stringify(['text_before', 'text_after', 'question', 'parts', 'correct_answer']
      .map(key => Array.isArray(content[key]) ? [...content[key] as string[]].sort() : content[key])))
    expect(new Set(tasks).size).toBe(tasks.length)
  })

  it('passes the CMS write schema for every choice and gap', () => {
    const failures = rows.filter(row => row.exercise.exercise_type !== 'sentence_building').flatMap(({ path, node, exercise }) => {
      const parsed = grammarWriteSchema.safeParse({
        level: path.level, lesson: path.unit.label, topic: node.topic, type: exercise.exercise_type, solution_audio_url: null,
        hint: { de: exercise.hint, ...Object.fromEntries(LOCALES.map(locale => [locale, exercise.translations[locale].hint])) },
        content: exercise.content,
      })
      return parsed.success ? [] : [`${exercise.ref}: ${parsed.error.issues.map(issue => issue.message).join(', ')}`]
    })
    expect(failures).toEqual([])
  })

  it('satisfies the database content rules', () => {
    for (const { node, exercise } of rows) {
      const { content } = exercise
      expect(EXERCISE_TYPES).toContain(exercise.exercise_type)
      expect(content.target_form.length).toBeGreaterThan(0)
      expect(content.target_form.every(value => value.trim().length > 0)).toBe(true)
      expect(NOT_GERMAN.test(JSON.stringify([node.topic, exercise.hint, exercise.explanation, ...GERMAN_FIELDS.map(field => content[field])]))).toBe(false)
      expect(exercise.accepted_answers).toEqual(content.accepted_answers)
      const accepted = content.accepted_answers.map(normalizeGrammarAnswer)
      expect(new Set(accepted).size).toBe(accepted.length)
      expect(accepted[0]).toBe(normalizeGrammarAnswer(content.correct_answer))
      expect(Boolean(content.needs_article)).toBe(/^(der|die|das|den|dem|des) \p{Lu}/u.test(content.correct_answer) && exercise.exercise_type === 'fill_in_blank')
      if (exercise.exercise_type === 'multiple_choice') {
        expect(content.accepted_answers).toEqual([content.correct_answer])
        expect(content.options!.length).toBeGreaterThanOrEqual(3)
        expect(content.options).toContain(content.correct_answer)
      }
      if (exercise.exercise_type === 'fill_in_blank') {
        expect(content.options).toHaveLength(3)
        // Die falschen Formen dürfen keine zugelassene Antwort sein.
        expect(content.options!.filter(option => accepted.includes(normalizeGrammarAnswer(option)))).toEqual([content.correct_answer])
      }
      if (exercise.exercise_type === 'sentence_building') {
        expect(content.parts!.length).toBeGreaterThanOrEqual(3)
        expect(content.parts!.join(' ')).not.toBe(content.correct_answer.replace(/[.?!]$/, ''))
        for (const answer of content.accepted_answers) expect(words(answer)).toEqual(words(content.parts!.join(' ')))
      }
    }
  })

  it('does not always put the solution in the same place', () => {
    const positions = rows.filter(row => row.exercise.exercise_type === 'multiple_choice')
      .map(({ exercise: { content } }) => content.options!.indexOf(content.correct_answer))
    for (const position of [0, 1, 2]) expect(positions.filter(value => value === position).length).toBeGreaterThan(positions.length / 5)
  })

  it('uses no grammar from later paths, no textbook names and no grammar references', () => {
    const violations = rows.flatMap(({ path, exercise }) => TASK_FIELDS.flatMap(field => strings(exercise.content[field])).flatMap(text => {
      const found = rules.later.filter(rule => path.path < rule.from).flatMap(rule =>
        Array.from(text.matchAll(/\p{L}+/gu), match => match[0]).filter(word => rule.words.includes(word.toLocaleLowerCase('de-DE'))))
      return found.length ? [`${exercise.ref}: ${found.join(', ')}`] : []
    }))
    expect(violations).toEqual([])
    expect(TEXTBOOK.test(JSON.stringify(paths))).toBe(false)
  })

  it('explains every exercise in German and all four interface languages', () => {
    for (const { exercise } of rows) {
      expect(exercise.hint.trim()).not.toBe('')
      expect(exercise.explanation.trim()).not.toBe('')
      for (const locale of LOCALES) {
        for (const field of ['instruction', 'hint', 'explanation'] as const) {
          const text = exercise.translations[locale][field]
          expect(text.trim().length).toBeGreaterThan(0)
          expect(CYRILLIC.test(text)).toBe(locale === 'ru' || locale === 'uk')
          expect(text).not.toBe({ instruction: exercise.content.instruction, hint: exercise.hint, explanation: exercise.explanation }[field])
        }
      }
      expect(JSON.stringify(exercise.translations.ru)).not.toMatch(/[іїєґ]/i)
      expect(JSON.stringify(exercise.translations.uk)).not.toMatch(/[ыэъё]/i)
    }
  })

  it('translates every task into the interface language and names the word of every gap', () => {
    for (const { exercise } of rows) {
      const translated = LOCALES.filter(locale => exercise.translations[locale].task)
      if (UNTRANSLATED.includes(exercise.content.instruction)) expect(translated).toEqual([])
      else {
        expect(translated).toEqual(LOCALES)
        for (const locale of LOCALES) expect(CYRILLIC.test(exercise.translations[locale].task!)).toBe(locale === 'ru' || locale === 'uk')
      }
      const meanings = LOCALES.filter(locale => exercise.translations[locale].gap_hint)
      if (exercise.exercise_type !== 'fill_in_blank') { expect(meanings).toEqual([]); expect(exercise.content.gap_hint).toBeUndefined(); continue }
      // Entweder die deutsche Grundform (bzw. die geschlossene Auswahl) oder die Bedeutung in allen vier Sprachen.
      expect(Boolean(exercise.content.gap_hint) !== (meanings.length === LOCALES.length)).toBe(true)
      expect([0, LOCALES.length]).toContain(meanings.length)
      if (exercise.content.gap_hint) expect(normalizeGrammarAnswer(exercise.content.gap_hint)).not.toBe(normalizeGrammarAnswer(exercise.content.correct_answer))
    }
  })
})
