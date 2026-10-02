/**
 * Compiles the compact authoring sources in supabase/seeds/path-src/<level>/ into the
 * import format of lib/learning-path-schema.ts (the format of supabase/seeds/path-a1.1.json).
 *
 * Authoring writes every text once: a rule card carries its rule, its hints and their
 * translations; an exercise only names its goal, its card and the task itself. The build
 * repeats those texts per exercise, derives IDs, goals, option order and article flags,
 * and refuses to write a seed that breaks one of the content rules (RULES below). Every
 * violation names its rule, its task and the place in the sources (SeedBuildError.details).
 */
import { createHash } from 'node:crypto'

export const LOCALES = ['en', 'ru', 'uk', 'tr']
const AREAS = { G: 'grammar', K: 'communication', Z: 'can_do', W: 'vocabulary' }
const KINDS = { mc: 'multiple_choice', gap: 'fill_in_blank', sb: 'sentence_building' }
const TYPE_ORDER = ['multiple_choice', 'fill_in_blank', 'sentence_building']
// Mirrors learning_private.german_text_allowed and the schema's German-field protection.
const NOT_GERMAN = /[Ѐ-ԯᲀ-᲏ᴫᵸⷠ-ⷿꙀ-ꚟ\u{1E030}-\u{1E08F}ığşİĞŞ]/u
const CYRILLIC = /[Ѐ-ӿ]/
const TEXTBOOK = /Schritte plus|Schritte international|Menschen A[12]|Netzwerk neu|Studio d|Begegnungen A[12]|Linie 1|Berliner Platz|Pluspunkt Deutsch|Momente A[12]|Motive A[12]|DaF kompakt|ÜG\s*\d|\bLektion \d|\bSeite \d/
const REVIEW = { title: 'Wiederholung', t: ['Review', 'Повторение', 'Повторення', 'Tekrar'] }
const TEST = { title: 'Test', t: ['Test', 'Тест', 'Тест', 'Test'] }

const sha = value => createHash('sha256').update(value).digest('hex')
export const stableId = value => {
  const hex = sha(value)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
const normalized = value => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE')
const words = value => (value.match(/[\p{L}\p{N}'-]+/gu) ?? []).map(word => word.toLocaleLowerCase('de-DE')).sort().join(' ')
const four = values => Object.fromEntries(LOCALES.map((locale, index) => [locale, values[index]]))
/** A stable order that looks random: the same source always yields the same seed. */
const shuffled = (values, salt) => values.map((value, index) => ({ value, key: sha(`${salt}:${index}:${value}`) }))
  .sort((a, b) => a.key < b.key ? -1 : 1).map(item => item.value)

/**
 * The key under which grading treats two typed answers as the same word: case, punctuation and
 * the ae/oe/ue/ss spelling of umlauts are ignored (learning_private.grade_answer). A stored
 * wrong form with the key of the solution could never be told apart from it.
 */
export const answerKey = value => value.normalize('NFC').toLocaleLowerCase('de-DE')
  .replace(/[.,!?;:'"()[\]{}…„“”«»’‘-]/g, '').replace(/\s+/g, ' ').trim()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')

/** Every content rule of the build. The id is printed with each violation. */
export const RULES = {
  'translations': 'Jeder übersetzte Text braucht genau vier Fassungen in der Reihenfolge en, ru, uk, tr.',
  'script': 'ru und uk stehen in kyrillischer, en und tr in lateinischer Schrift; ru ohne і ї є ґ, uk ohne ы э ъ ё.',
  'untranslated': 'Eine Übersetzung darf nicht wörtlich dem deutschen Text entsprechen.',
  'german-text': 'Deutsche Felder sind ausgefüllt und enthalten weder Kyrillisch noch ı ğ ş İ Ğ Ş.',
  'task-type': 'Aufgaben sind mc (Auswahl), gap (Lücke) oder sb (Satzbau).',
  'goal': 'Jede Aufgabe nennt ein Lernziel des Pfads; Lernziel-IDs sind G, K, Z oder W mit Nummer.',
  'card': 'Jede Lektion hat genau eine Merkkarte mit 2 bis 4 Beispielen; jede Aufgabe verweist auf eine vorhandene Karte.',
  'hint': 'Der Hinweis einer Aufgabe steht auf ihrer Merkkarte: [de, en, ru, uk, tr].',
  'instruction': 'Jede Aufgabe hat eine Arbeitsanweisung aus shared.mjs (I.*).',
  'choice-options': 'Eine Auswahlaufgabe hat 3 bis 4 verschiedene Antworten; die erste ist die Lösung.',
  'gap-forms': 'Eine Lücke hat genau zwei falsche Formen, die sich von jeder Lösung unterscheiden – auch ohne Groß-/Kleinschreibung, Satzzeichen und ae/oe/ue/ss.',
  'gap-sentence': 'Eine Lücke steht in einem deutschen Satz (Text davor oder danach).',
  'gap-hint': 'Jede Lücke nennt das gesuchte Wort: deutsche Grundform, geschlossene Auswahl oder Bedeutung in [en, ru, uk, tr] – nie die Lösung selbst.',
  'sentence-building': 'Satzbau: mindestens drei Teile mit „ / “, Satzzeichen am Ende; weitere Lösungen benutzen dieselben Wörter.',
  'task-translation': 'Jede Aufgabe ist in vier Sprachen übersetzt – oder ausdrücklich tr = null (z. B. „Welches Wort passt nicht?“).',
  'path-structure': 'Ein Pfad besteht aus Lektionen, dann genau einer Wiederholung und einem Test; Pfade sind lückenlos ab 1 nummeriert.',
  'lesson-size': 'Eine Lektion hat 5 bis 10 Aufgaben, mindestens eine davon zur eigenen Merkkarte.',
  'goal-coverage': 'Jedes Lernziel wird mindestens zweimal geübt, einmal wiederholt und von zwei Testaufgaben geprüft.',
  'test-size': 'Ein Test stellt 12 bis 16 Aufgaben, mindestens eine je Lernziel; der Pool ist mindestens doppelt so groß.',
  'duplicate-task': 'Keine Aufgabe kommt in einem Niveau zweimal vor.',
  'textbook': 'Inhalte nennen kein Lehrbuch und verweisen auf keine Lehrbuchseite.',
  'schema': 'Der fertige Seed entspricht dem Importformat (lib/learning-path-schema.ts).',
}

/**
 * Collects rule violations with everything needed to find them in the sources: the rule, the
 * seed reference, the path file part (lessons or check), the node and – for a task – its text
 * and the line of its mc()/gap()/sb() call.
 */
class Problems {
  list = []
  context = {}
  /** @param rule key of RULES; @param where seed reference such as P3-N5-E04 */
  add(rule, where, message, extra = {}) {
    if (!RULES[rule]) throw new Error(`Unbekannte Regel: ${rule}`)
    this.list.push({ rule, where, message, ...this.context, ...extra })
  }
  /** Runs `work` with additional location details and restores the previous ones afterwards. */
  within(context, work) {
    const previous = this.context
    this.context = { ...previous, ...context }
    try { return work() } finally { this.context = previous }
  }
}

export class SeedBuildError extends Error {
  /** @param details {rule, where, message, path?, part?, node?, task?, origin?, needle?}[] */
  constructor(details) {
    const problems = details.map(detail => `${detail.where}: ${detail.message}`)
    super(`Lernpfad-Seed ungültig (${problems.length}):\n${problems.join('\n')}`)
    this.problems = problems
    this.details = details
  }
}

function localized(problems, where, values, german) {
  if (!Array.isArray(values) || values.length !== 4 || values.some(value => typeof value !== 'string' || !value.trim())) {
    problems.add('translations', where, 'vier Übersetzungen (en, ru, uk, tr) erwartet'); return four(['?', '?', '?', '?'])
  }
  values.forEach((value, index) => {
    const locale = LOCALES[index]
    const at = `${where}.${locale}`
    if (CYRILLIC.test(value) !== (locale === 'ru' || locale === 'uk')) problems.add('script', at, `falsche Schrift („${value}“)`)
    if (locale === 'ru' && /[іїєґ]/i.test(value)) problems.add('script', at, `ukrainische Buchstaben („${value}“)`)
    if (locale === 'uk' && /[ыэъё]/i.test(value)) problems.add('script', at, `russische Buchstaben („${value}“)`)
    if (german !== undefined && value === german) problems.add('untranslated', at, `nicht übersetzt („${value}“)`)
  })
  return four(values)
}

function german(problems, where, value) {
  if (typeof value !== 'string' || !value.trim()) problems.add('german-text', where, 'Text fehlt')
  else if (NOT_GERMAN.test(value.normalize('NFC'))) problems.add('german-text', where, `kein deutscher Text („${value}“)`)
  return value
}

/** The task as an author recognises it: its kind and its German text. */
function describe(source) {
  if (source.type === 'mc') return `Auswahl: ${source.question} → ${source.options?.[0]}`
  if (source.type === 'gap') return `Lücke: ${source.before}___${source.after} → ${source.answers?.[0]}`
  if (source.type === 'sb') return `Satzbau: ${source.sentence}`
  return `Aufgabe vom Typ ${source.type}`
}

function buildExercise(problems, ctx, source, ref) {
  const where = ref
  const type = KINDS[source.type]
  if (!type) { problems.add('task-type', where, `unbekannter Aufgabentyp „${source.type}“`); return null }
  const goal = `P${ctx.path}-${source.goal}`
  if (!ctx.objectives.has(goal)) problems.add('goal', where, `unbekanntes Lernziel ${source.goal}`)
  const cardId = source.c ?? ctx.nodeCard ?? ctx.goalCards.get(goal)
  const card = ctx.cards.get(cardId)
  if (!card) { problems.add('card', where, `Merkkarte ${cardId ?? '(keine)'} fehlt`); return null }
  const hint = source.h ? card.hints?.[source.h] : card.hint
  if (!Array.isArray(hint) || hint.length !== 5) { problems.add('hint', where, `Hinweis ${source.h ?? 'der Karte'} fehlt auf Merkkarte ${cardId}`); return null }
  if (!source.instr?.de) { problems.add('instruction', where, 'Arbeitsanweisung fehlt'); return null }
  const instruction = german(problems, `${where}.instruction`, source.instr.de)
  const target_form = [source.target].flat()
  target_form.forEach(value => german(problems, `${where}.target_form`, value))

  let content
  if (type === 'multiple_choice') {
    const [correct] = source.options
    if (source.options.length < 3 || source.options.length > 4) problems.add('choice-options', where, `3 bis 4 Antworten erwartet (${source.options.length})`)
    if (new Set(source.options.map(normalized)).size !== source.options.length) problems.add('choice-options', where, 'doppelte Antworten')
    source.options.forEach(option => german(problems, `${where}.options`, option))
    content = { target_form, instruction, question: german(problems, `${where}.question`, source.question),
      options: shuffled(source.options, ref), correct_answer: correct, accepted_answers: [correct] }
  } else if (type === 'fill_in_blank') {
    const [correct] = source.answers
    const options = [correct, ...source.distractors]
    if (options.length !== 3) problems.add('gap-forms', where, `genau zwei falsche Formen erwartet (${source.distractors.length})`)
    if (new Set([...source.answers, ...source.distractors].map(normalized)).size !== source.answers.length + source.distractors.length) {
      problems.add('gap-forms', where, 'Lösung und falsche Formen überschneiden sich')
    }
    // Grading ignores case, punctuation and ae/oe/ue/ss: such a "wrong" form is the solution to a learner.
    const accepted = new Set(source.answers.map(answerKey))
    for (const wrong of source.distractors) if (accepted.has(answerKey(wrong)) && !source.answers.map(normalized).includes(normalized(wrong))) {
      problems.add('gap-forms', where, `„${wrong}“ ist nur eine andere Schreibweise der Lösung „${correct}“`)
    }
    options.concat(source.answers).forEach(option => german(problems, `${where}.answers`, option))
    if (!`${source.before}${source.after}`.trim()) problems.add('gap-sentence', where, 'Satz fehlt')
    for (const part of [source.before, source.after]) if (NOT_GERMAN.test(part.normalize('NFC'))) problems.add('gap-sentence', where, `kein deutscher Satz („${part}“)`)
    const hintIsGerman = typeof source.gapHint === 'string'
    if (hintIsGerman) german(problems, `${where}.gap_hint`, source.gapHint)
    if (hintIsGerman && normalized(source.gapHint) === normalized(correct)) problems.add('gap-hint', where, `Der Hinweis nennt die Lösung („${correct}“)`)
    // Every gap names its word, unless the task itself already shows it (e.g. a number to write out).
    if (source.gapHint == null && !source.instr.selfEvident) problems.add('gap-hint', where, 'Lücke ohne Hinweis (Grundform oder Bedeutung)')
    content = { target_form, instruction, text_before: source.before, text_after: source.after,
      ...(hintIsGerman ? { gap_hint: source.gapHint } : {}), correct_answer: correct, options: shuffled(options, ref),
      accepted_answers: source.answers,
      ...(/^(der|die|das|den|dem|des) \p{Lu}/u.test(correct) ? { needs_article: true } : {}) }
  } else {
    const end = source.sentence.match(/[.?!]$/)?.[0]
    if (!end) problems.add('sentence-building', where, 'Satzzeichen am Ende fehlt')
    const parts = source.sentence.slice(0, -1).split(' / ').map(part => part.trim())
    if (parts.length < 3 || parts.some(part => !part)) problems.add('sentence-building', where, `mindestens drei Satzteile erwartet (${parts.length})`)
    const correct = `${parts.join(' ')}${end ?? ''}`
    german(problems, `${where}.sentence`, correct)
    const accepted = [correct, ...(source.alt ?? [])]
    for (const answer of accepted) if (words(answer) !== words(correct)) problems.add('sentence-building', where, `„${answer}“ benutzt andere Wörter`)
    if (new Set(accepted.map(normalized)).size !== accepted.length) problems.add('sentence-building', where, 'doppelte Lösungen')
    let order = shuffled(parts, ref)
    if (order.join(' ') === parts.join(' ')) order = [...order.slice(1), order[0]]
    content = { target_form, instruction, parts: order, correct_answer: correct, accepted_answers: accepted }
  }

  const instructions = localized(problems, `${where}.instruction`, source.instr.t, instruction)
  const hints = localized(problems, `${where}.hint`, hint.slice(1), hint[0])
  const tasks = source.tr === null ? null : localized(problems, `${where}.task`, source.tr)
  if (source.tr === undefined) problems.add('task-translation', where, 'Übersetzung der Aufgabe fehlt (oder ausdrücklich null)')
  const gapHints = Array.isArray(source.gapHint) ? localized(problems, `${where}.gap_hint`, source.gapHint) : null
  return {
    id: stableId(`sitov-path:${ctx.level}:${ref}`), ref, goal, exercise_type: type, content,
    accepted_answers: content.accepted_answers,
    hint: german(problems, `${where}.hint`, hint[0]), explanation: card.rule, explanation_card: card.id,
    translations: Object.fromEntries(LOCALES.map(locale => [locale, {
      instruction: instructions[locale], hint: hints[locale], explanation: card.translations[locale].rule,
      ...(tasks ? { task: tasks[locale] } : {}), ...(gapHints ? { gap_hint: gapHints[locale] } : {}),
    }])),
  }
}

function buildPath(problems, level, source, origins) {
  const where = `P${source.n}`
  const objectives = problems.within({ part: 'lessons' }, () => Object.entries(source.objectives).map(([id, description]) =>
    problems.within({ needle: `${id}:` }, () => {
      if (!/^[GKZW]\d+$/.test(id)) problems.add('goal', where, `Lernziel-ID ${id}`)
      return { id: `P${source.n}-${id}`, area: AREAS[id[0]], description: german(problems, `${where}.${id}`, description) }
    })))
  const practice = source.nodes.filter(node => !node.kind)
  const cards = new Map()
  for (const node of practice) problems.within({ part: 'lessons', node: `Lektion „${node.title}“`, needle: node.card?.id ?? node.title }, () => {
    const card = node.card
    if (!card?.id || cards.has(card.id)) { problems.add('card', `${where} „${node.title}“`, 'Merkkarte fehlt oder ist doppelt'); return }
    if (card.examples.length < 2 || card.examples.length > 4) problems.add('card', `${where} ${card.id}`, `2 bis 4 Beispiele erwartet (${card.examples.length})`)
    card.examples.forEach(example => german(problems, `${where} ${card.id}.examples`, example))
    cards.set(card.id, { id: card.id, rule: german(problems, `${where} ${card.id}.rule`, card.rule), hint: card.hint, hints: card.hints,
      translations: Object.fromEntries(Object.entries(localized(problems, `${where} ${card.id}.rule`, card.t, card.rule)).map(([locale, rule]) => [locale, { rule }])) })
  })
  // A goal is explained by the card of the first lesson that practises it, unless an exercise names another card.
  const goalCards = new Map()
  for (const node of practice) for (const exercise of node.ex) {
    const goal = `P${source.n}-${exercise.goal}`
    if (!goalCards.has(goal)) goalCards.set(goal, exercise.c ?? node.card.id)
  }
  const ctx = { level, path: source.n, objectives: new Set(objectives.map(objective => objective.id)), cards, goalCards }
  const ordered = [...practice, ...source.nodes.filter(node => node.kind === 'review'), ...source.nodes.filter(node => node.kind === 'test')]
  if (ordered.length !== source.nodes.length || ordered.at(-1)?.kind !== 'test' || ordered.at(-2)?.kind !== 'review') {
    problems.add('path-structure', where, 'Lektionen, dann genau eine Wiederholung und ein Test erwartet')
  }
  const nodes = ordered.map((node, index) => {
    const id = `P${source.n}-N${index + 1}`
    const meta = node.kind === 'review' ? REVIEW : node.kind === 'test' ? TEST : node
    const location = { part: node.kind ? 'check' : 'lessons', needle: node.kind ? `${node.kind}:` : node.title,
      node: node.kind === 'review' ? 'Wiederholung' : node.kind === 'test' ? 'Test' : `Lektion ${index + 1} „${node.title}“` }
    return problems.within(location, () => {
      // From recognising to writing: choices first, then gaps, then word order.
      const sources = [...node.ex].sort((a, b) => TYPE_ORDER.indexOf(KINDS[a.type]) - TYPE_ORDER.indexOf(KINDS[b.type]))
      const exercises = sources.map((exercise, position) => {
        const ref = `${id}-E${String(position + 1).padStart(2, '0')}`
        const origin = exercise.origin ?? null
        origins.set(ref, { ...location, path: source.n, task: describe(exercise), origin })
        return problems.within({ task: describe(exercise), origin, needle: undefined }, () =>
          buildExercise(problems, { ...ctx, nodeCard: node.card?.id }, exercise, ref))
      }).filter(Boolean)
      const used = new Set(exercises.map(exercise => exercise.goal))
      if (!node.kind && (exercises.length < 5 || exercises.length > 10)) problems.add('lesson-size', id, `5 bis 10 Aufgaben je Lektion (${exercises.length})`)
      if (!node.kind && !exercises.some(exercise => exercise.explanation_card === node.card?.id)) problems.add('lesson-size', id, 'keine Aufgabe zur eigenen Merkkarte')
      return {
        id, kind: node.kind ?? 'practice', sort_order: index + 1,
        topic: `${source.title} · ${meta.title}`, title: german(problems, `${id}.title`, meta.title),
        translations: Object.fromEntries(Object.entries(localized(problems, `${id}.title`, meta.t)).map(([locale, title]) => [locale, { title }])),
        goals: objectives.map(objective => objective.id).filter(goal => used.has(goal)),
        ...(node.kind ? {} : { merkkarte: { card: node.card.id, rule: node.card.rule, examples: node.card.examples,
          highlight: node.card.highlight ?? null, translations: cards.get(node.card.id)?.translations } }),
        ...(node.kind === 'test' ? { test_size: node.size } : {}),
        exercises,
      }
    })
  })

  // Every goal is practised at least twice, repeated once and tested from at least two tasks.
  const goalsOf = kind => nodes.filter(node => node.kind === kind).flatMap(node => node.exercises.map(exercise => exercise.goal))
  const [practised, reviewed, pool] = [goalsOf('practice'), goalsOf('review'), goalsOf('test')]
  const test = nodes.at(-1)
  for (const { id } of objectives) {
    const goal = { needle: `${id.split('-')[1]}:` }
    const count = list => list.filter(entry => entry === id).length
    if (count(practised) < 2) problems.add('goal-coverage', id, `weniger als zwei Übungsaufgaben (${count(practised)})`, { ...goal, part: 'lessons' })
    if (!reviewed.includes(id)) problems.add('goal-coverage', id, 'fehlt in der Wiederholung', { ...goal, part: 'check', node: 'Wiederholung', needle: 'review:' })
    if (count(pool) < 2) problems.add('goal-coverage', id, `weniger als zwei Testaufgaben (${count(pool)})`, { ...goal, part: 'check', node: 'Test', needle: 'test:' })
  }
  if (test?.kind === 'test') problems.within({ part: 'check', node: 'Test', needle: 'size:' }, () => {
    if (!(test.test_size >= Math.max(12, objectives.length) && test.test_size <= 16)) problems.add('test-size', where, `Testgröße ${test.test_size} (12–16, mindestens je Lernziel eine Aufgabe: ${objectives.length})`)
    if (pool.length < 2 * test.test_size) problems.add('test-size', where, `Testpool ${pool.length} kleiner als das Doppelte der Testgröße ${test.test_size}`)
  })
  return problems.within({ part: 'lessons', needle: 'title:' }, () => ({
    id: `P${source.n}`, level, path: source.n, slug: source.slug, title: german(problems, `${where}.title`, source.title),
    translations: Object.fromEntries(Object.entries(localized(problems, `${where}.title`, source.t)).map(([locale, title]) => [locale, { title }])),
    unit: { level, trainer: 'exercises', label: `${level} · Pfad ${source.n} · ${source.title}`, sort_order: source.n },
    objectives, nodes,
  }))
}

/**
 * @returns the seed (array of paths) or throws a SeedBuildError listing every problem.
 * The seed carries a non-enumerable `origins` map (task reference → source location).
 */
export function buildLevelSeed({ level, paths }) {
  const problems = new Problems()
  const origins = new Map()
  const seed = paths.map(path => problems.within({ path: path.n }, () => buildPath(problems, level, path, origins)))
  if (seed.map(path => path.path).join() !== seed.map((_, index) => index + 1).join()) problems.add('path-structure', level, 'Pfade müssen lückenlos ab 1 nummeriert sein')
  // No task twice in a level: a repeated task would be recognised instead of solved.
  const seen = new Map()
  for (const path of seed) for (const node of path.nodes) for (const { ref, content } of node.exercises) {
    const key = JSON.stringify(['text_before', 'text_after', 'question', 'parts', 'correct_answer'].map(field =>
      Array.isArray(content[field]) ? [...content[field]].sort() : content[field]))
    if (seen.has(key)) problems.add('duplicate-task', `${path.id} ${ref}`, `gleiche Aufgabe wie ${seen.get(key)}`, origins.get(ref))
    else seen.set(key, `${path.id} ${ref}`)
  }
  const textbook = JSON.stringify(seed).match(TEXTBOOK)
  if (textbook) problems.add('textbook', level, `Lehrbuchname oder Lehrbuchverweis im Inhalt („${textbook[0]}“)`)
  if (problems.list.length) throw new SeedBuildError(problems.list)
  return Object.defineProperty(seed, 'origins', { value: origins, enumerable: false })
}

export const serializeSeed = seed => `${JSON.stringify(seed, null, 2)}\n`
