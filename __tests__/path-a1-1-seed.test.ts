import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { grammarWriteSchema, normalizeGrammarAnswer } from '@/lib/grammar-validation'
import { EXERCISE_TYPES } from '@/lib/types/exercise'

/**
 * Lernpfad A1.1 (supabase/seeds/path-a1.1.json): Pfade → Knoten → Übungen.
 * Heutige Abbildung: unit → learning_units, node.topic → learning_exercises.topic,
 * exercise_type/content → learning_exercises.type/content, hint/explanation (de) und
 * translations.<locale>.hint/explanation → grammar_translations. Knoten (practice |
 * review | test), Merkkarte, test_size und translations.<locale>.instruction folgen dem
 * Datenmodell aus MASTER-PROMPT-4, Phase 3.3, das noch keine Tabellen hat.
 */
type Locale = 'en' | 'ru' | 'uk' | 'tr'
interface SeedExercise {
  id: string
  ref: string
  goal: string
  exercise_type: string
  content: Record<string, unknown> & {
    target_form: string[]; instruction: string; correct_answer: string; accepted_answers: string[]
    options?: string[]; parts?: string[]; text_before?: string; needs_article?: boolean
  }
  accepted_answers: string[]
  hint: string
  explanation: string
  explanation_card: string
  translations: Record<Locale, { instruction: string; hint: string; explanation: string }>
}
interface SeedNode {
  id: string; kind: string; sort_order: number; topic: string; title: string; goals: string[]
  translations: Record<Locale, { title: string }>
  merkkarte?: { card: string; rule: string; examples: string[]; highlight: string | null; translations: Record<Locale, { rule: string }> }
  test_size?: number
  exercises: SeedExercise[]
}
interface SeedPath {
  id: string; level: string; path: number; slug: string; title: string; translations: Record<Locale, { title: string }>
  unit: { level: string; trainer: string; label: string; sort_order: number }
  objectives: { id: string; area: string; description: string }[]
  nodes: SeedNode[]
}

// Parsed at runtime so the 2 MB file never becomes a TypeScript literal type.
const paths: SeedPath[] = JSON.parse(readFileSync(join(__dirname, '../supabase/seeds/path-a1.1.json'), 'utf8'))
const rows = paths.flatMap(path => path.nodes.flatMap(node => node.exercises.map(exercise => ({ path, node, exercise }))))
const LOCALES: Locale[] = ['en', 'ru', 'uk', 'tr']
const TYPE_ORDER = ['multiple_choice', 'fill_in_blank', 'sentence_building']
// Mirrors learning_private.german_text_allowed and grammar_private.german_content_allowed.
const NOT_GERMAN = /[Ѐ-ԯᲀ-᲏ᴫᵸⷠ-ⷿꙀ-ꚟ\u{1E030}-\u{1E08F}ığşİĞŞ]/u
const GERMAN_FIELDS = ['instruction', 'text_before', 'text_after', 'question', 'correct_answer', 'gap_hint', 'options', 'accepted_answers', 'parts', 'target_form']
const TASK_FIELDS = ['text_before', 'text_after', 'question', 'correct_answer', 'options', 'accepted_answers', 'parts', 'target_form']
const CYRILLIC = /[Ѐ-ӿ]/
// Kein Vorgriff (MASTER-PROMPT-4, 4.2/4.4): Wortlisten je Pfad; feste Wendungen sind ausdrücklich erlaubt.
const LATER: { from: number; words: string[]; phrases: string[] }[] = [
  { from: 6, words: ['einen', 'keinen', 'meinen', 'deinen', 'seinen', 'ihren', 'unseren', 'euren', 'ihn', 'den'], phrases: [] },
  { from: 7, words: ['gemacht', 'gespielt', 'gekauft', 'gearbeitet', 'gelernt', 'gewohnt', 'gekocht', 'gehört', 'getroffen', 'getrunken',
    'gesprochen', 'geschrieben', 'gelesen', 'gesehen', 'gegessen', 'geschlafen', 'gegangen', 'gefahren', 'gekommen', 'gewesen', 'gehabt',
    'gesagt', 'gefragt', 'gelebt', 'getanzt', 'gewandert', 'gestorben', 'angerufen', 'aufgestanden', 'eingekauft', 'ferngesehen', 'geschehen',
    'war', 'waren', 'warst', 'hatte', 'hattest', 'hatten'], phrases: ['gern geschehen'] },
  { from: 7, words: ['kann', 'kannst', 'können', 'könnt', 'will', 'willst', 'wollen', 'wollt'], phrases: ['Können Sie das bitte', 'Kann ich Ihnen helfen'] },
  { from: 3, words: ['möchte', 'möchtest', 'möchten', 'möchtet', 'hätte'], phrases: [] },
]
const TEXTBOOK = /Schritte plus|Schritte international|Menschen A1|Netzwerk neu|Studio d|Begegnungen A1|Linie 1|Berliner Platz|Pluspunkt Deutsch|Momente A1|Motive A1|DaF kompakt|ÜG\s*\d|\bLektion \d|\bSeite \d/
const stableId = (value: string) => {
  const hex = createHash('sha256').update(value).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
const words = (value: string) => (value.match(/[\p{L}\p{N}'-]+/gu) ?? []).map(word => word.toLocaleLowerCase('de-DE')).sort()
const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

describe('A1.1 learning path seed', () => {
  it('builds seven paths from practice nodes, one review and one final test', () => {
    expect(paths.map(path => path.path)).toEqual([1, 2, 3, 4, 5, 6, 7])
    for (const path of paths) {
      expect(path).toMatchObject({ id: `P${path.path}`, level: 'A1.1', unit: { level: 'A1.1', trainer: 'exercises', sort_order: path.path } })
      expect(path.unit.label).toBe(`A1.1 · Pfad ${path.path} · ${path.title}`)
      expect(path.nodes.map(node => node.sort_order)).toEqual(path.nodes.map((_, index) => index + 1))
      expect(path.nodes.map(node => node.kind)).toEqual([...path.nodes.slice(0, -2).map(() => 'practice'), 'review', 'test'])
      for (const node of path.nodes) {
        expect(node.topic).toBe(`${path.title} · ${node.title}`)
        expect([...node.goals].sort()).toEqual([...new Set(node.exercises.map(exercise => exercise.goal))].sort())
        // Vom Erkennen zum Schreiben: Auswahl zuerst, dann Lücken, dann Satzbau.
        const order = node.exercises.map(exercise => TYPE_ORDER.indexOf(exercise.exercise_type))
        expect(order).toEqual([...order].sort((a, b) => a - b))
      }
    }
  })

  it('starts every practice node with a rule card in German and all interface languages', () => {
    for (const node of paths.flatMap(path => path.nodes)) {
      if (node.kind !== 'practice') { expect(node.merkkarte).toBeUndefined(); continue }
      expect(node.exercises.length).toBeGreaterThanOrEqual(5)
      expect(node.exercises.length).toBeLessThanOrEqual(10)
      const card = node.merkkarte!
      expect(node.exercises.map(exercise => exercise.explanation_card)).toContain(card.card)
      expect(card.rule).toBe(node.exercises.find(exercise => exercise.explanation_card === card.card)!.explanation)
      expect(card.examples.length).toBeGreaterThanOrEqual(2)
      expect(card.examples.length).toBeLessThanOrEqual(4)
      expect(NOT_GERMAN.test(card.examples.join(' '))).toBe(false)
      expect([null, 'article', 'verb']).toContain(card.highlight)
      for (const locale of LOCALES) expect(card.translations[locale].rule.trim()).not.toBe('')
    }
  })

  it('assigns one goal per task and covers every goal in practice, review and every test draw', () => {
    for (const path of paths) {
      const ids = path.objectives.map(objective => objective.id)
      for (const id of ids) expect(id).toMatch(new RegExp(`^P${path.path}-[GKZW]\\d+$`))
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
      expect(exercise.id).toBe(stableId(`sitov-path:A1.1:${exercise.ref}`))
    }
    expect(new Set(rows.map(row => row.exercise.id)).size).toBe(rows.length)
    const tasks = rows.map(({ exercise: { content } }) => JSON.stringify(['text_before', 'text_after', 'question', 'options', 'parts', 'correct_answer'].map(key => content[key])))
    expect(new Set(tasks).size).toBe(tasks.length)
  })

  it('passes the CMS write schema for every playable exercise', () => {
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
      expect(['smart_hint', 'explanation', 'alternative_answers'].some(key => key in content)).toBe(false)
      expect(NOT_GERMAN.test(JSON.stringify([node.topic, ...GERMAN_FIELDS.map(field => content[field])]))).toBe(false)
      expect(exercise.accepted_answers).toEqual(content.accepted_answers)
      const accepted = content.accepted_answers.map(normalizeGrammarAnswer)
      expect(new Set(accepted).size).toBe(accepted.length)
      expect(accepted).toContain(normalizeGrammarAnswer(content.correct_answer))
      expect(Boolean(content.needs_article)).toBe(/^(der|die|das|den|dem|des) \p{Lu}/u.test(content.correct_answer) && exercise.exercise_type === 'fill_in_blank')
      if (exercise.exercise_type === 'multiple_choice') expect(content.accepted_answers).toEqual([content.correct_answer])
      if (exercise.exercise_type === 'sentence_building') {
        expect(content.parts!.length).toBeGreaterThanOrEqual(3)
        for (const answer of content.accepted_answers) expect(words(answer)).toEqual(words(content.parts!.join(' ')))
      }
    }
  })

  it('uses no grammar from later paths, no textbook names and no grammar references', () => {
    const violations = rows.flatMap(({ path, exercise }) => TASK_FIELDS.flatMap(field => strings(exercise.content[field])).flatMap(text => {
      const found = LATER.filter(rule => path.path < rule.from).flatMap(rule => {
        const cleaned = rule.phrases.reduce((value, phrase) => value.split(phrase).join(''), text)
        return Array.from(cleaned.matchAll(/\p{L}+/gu), match => match[0]).filter(word => rule.words.includes(word.toLocaleLowerCase('de-DE')))
      })
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
})
