/**
 * Compiles the compact authoring sources in supabase/seeds/path-src/<level>/ into the
 * import format of lib/learning-path-schema.ts (the format of supabase/seeds/path-a1.1.json).
 *
 * Authoring writes every text once: a rule card carries its rule, its hints and their
 * translations; an exercise only names its goal, its card and the task itself. The build
 * repeats those texts per exercise, derives IDs, goals, option order and article flags,
 * and refuses to write a seed that breaks one of the content rules below.
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
 * Mirrors the tolerance of learning_private.grade_answer (migrations 06/30): besides case and
 * punctuation, a typed answer passes as SOFT_ERROR when only umlauts are spelled out or when
 * exactly one word of at least four letters differs by one letter. A wrong grammar form that
 * close to the solution ("einer" for "einem") would therefore pass a typed gap.
 */
export function passesAsTypo(input, accepted) {
  const plain = value => value.normalize('NFC').toLocaleLowerCase('de-DE')
    .replace(/[.,!?;:'"()[\]{}…„“”«»’‘-]/g, '').replace(/\s+/g, ' ').trim()
  const expand = value => value.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  const oneEdit = (left, right) => {
    if (Math.abs(left.length - right.length) > 1) return false
    const [a, b] = [[...left], [...right]]
    let [i, j, edits] = [0, 0, 0]
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue }
      if (++edits > 1) return false
      if (a.length >= b.length) i++
      if (b.length >= a.length && !(a.length > b.length)) j++
    }
    return edits + (a.length - i) + (b.length - j) === 1
  }
  const typed = plain(input)
  return accepted.some(answer => {
    const target = plain(answer)
    if (typed === target) return true
    if (expand(typed) === expand(target)) return true
    const [words, targets] = [typed.split(' '), target.split(' ')]
    if (words.length !== targets.length) return false
    const differing = words.map((word, index) => [word, targets[index]]).filter(([word, other]) => word !== other)
    return differing.length === 1 && differing.every(([word, other]) =>
      /^\p{L}+$/u.test(word) && /^\p{L}+$/u.test(other) && Math.min(word.length, other.length) >= 4 && oneEdit(word, other))
  })
}

export class SeedBuildError extends Error {
  constructor(problems) { super(`Lernpfad-Seed ungültig (${problems.length}):\n${problems.join('\n')}`); this.problems = problems }
}

function localized(problems, where, values, german) {
  if (!Array.isArray(values) || values.length !== 4 || values.some(value => typeof value !== 'string' || !value.trim())) {
    problems.push(`${where}: vier Übersetzungen (en, ru, uk, tr) erwartet`); return four(['?', '?', '?', '?'])
  }
  values.forEach((value, index) => {
    const locale = LOCALES[index]
    if (CYRILLIC.test(value) !== (locale === 'ru' || locale === 'uk')) problems.push(`${where}.${locale}: falsche Schrift`)
    if (locale === 'ru' && /[іїєґ]/i.test(value)) problems.push(`${where}.ru: ukrainische Buchstaben`)
    if (locale === 'uk' && /[ыэъё]/i.test(value)) problems.push(`${where}.uk: russische Buchstaben`)
    if (german !== undefined && value === german) problems.push(`${where}.${locale}: nicht übersetzt`)
  })
  return four(values)
}

function german(problems, where, value) {
  if (typeof value !== 'string' || !value.trim()) problems.push(`${where}: Text fehlt`)
  else if (NOT_GERMAN.test(value.normalize('NFC'))) problems.push(`${where}: kein deutscher Text`)
  return value
}

function buildExercise(problems, ctx, source, ref) {
  const where = ref
  const type = KINDS[source.type]
  if (!type) { problems.push(`${where}: unbekannter Aufgabentyp`); return null }
  const goal = `P${ctx.path}-${source.goal}`
  if (!ctx.objectives.has(goal)) problems.push(`${where}: unbekanntes Lernziel ${source.goal}`)
  const cardId = source.c ?? ctx.nodeCard ?? ctx.goalCards.get(goal)
  const card = ctx.cards.get(cardId)
  if (!card) { problems.push(`${where}: Merkkarte ${cardId ?? '(keine)'} fehlt`); return null }
  const hint = source.h ? card.hints?.[source.h] : card.hint
  if (!Array.isArray(hint) || hint.length !== 5) { problems.push(`${where}: Hinweis ${source.h ?? 'der Karte'} fehlt`); return null }
  if (!source.instr?.de) { problems.push(`${where}: Arbeitsanweisung fehlt`); return null }
  const instruction = german(problems, `${where}.instruction`, source.instr.de)
  const target_form = [source.target].flat()
  target_form.forEach(value => german(problems, `${where}.target_form`, value))

  let content
  if (type === 'multiple_choice') {
    const [correct] = source.options
    if (source.options.length < 3 || source.options.length > 4) problems.push(`${where}: 3 bis 4 Antworten erwartet`)
    if (new Set(source.options.map(normalized)).size !== source.options.length) problems.push(`${where}: doppelte Antworten`)
    source.options.forEach(option => german(problems, `${where}.options`, option))
    content = { target_form, instruction, question: german(problems, `${where}.question`, source.question),
      options: shuffled(source.options, ref), correct_answer: correct, accepted_answers: [correct] }
  } else if (type === 'fill_in_blank') {
    const [correct] = source.answers
    const options = [correct, ...source.distractors]
    if (options.length !== 3) problems.push(`${where}: genau zwei falsche Formen erwartet`)
    if (new Set([...source.answers, ...source.distractors].map(normalized)).size !== source.answers.length + source.distractors.length) {
      problems.push(`${where}: Lösung und falsche Formen überschneiden sich`)
    }
    options.concat(source.answers).forEach(option => german(problems, `${where}.answers`, option))
    if (!`${source.before}${source.after}`.trim()) problems.push(`${where}: Satz fehlt`)
    // A test decides about unlocking: there a wrong form must never pass as a typing error.
    if (ctx.kind === 'test') for (const wrong of source.distractors.filter(option => passesAsTypo(option, source.answers))) {
      problems.push(`${where}: „${wrong}“ gälte als Tippfehler von „${correct}“ (${source.before}…${source.after}) – im Test als Auswahl stellen (asChoice)`)
    }
    for (const part of [source.before, source.after]) if (NOT_GERMAN.test(part.normalize('NFC'))) problems.push(`${where}: kein deutscher Satz`)
    const hintIsGerman = typeof source.gapHint === 'string'
    if (hintIsGerman) german(problems, `${where}.gap_hint`, source.gapHint)
    if (hintIsGerman && normalized(source.gapHint) === normalized(correct)) problems.push(`${where}: Der Hinweis nennt die Lösung`)
    // Every gap names its word, unless the task itself already shows it (e.g. a number to write out).
    if (source.gapHint == null && !source.instr.selfEvident) problems.push(`${where}: Lücke ohne Hinweis (Grundform oder Bedeutung)`)
    content = { target_form, instruction, text_before: source.before, text_after: source.after,
      ...(hintIsGerman ? { gap_hint: source.gapHint } : {}), correct_answer: correct, options: shuffled(options, ref),
      accepted_answers: source.answers,
      ...(/^(der|die|das|den|dem|des) \p{Lu}/u.test(correct) ? { needs_article: true } : {}) }
  } else {
    const end = source.sentence.match(/[.?!]$/)?.[0]
    if (!end) problems.push(`${where}: Satzzeichen am Ende fehlt`)
    const parts = source.sentence.slice(0, -1).split(' / ').map(part => part.trim())
    if (parts.length < 3 || parts.some(part => !part)) problems.push(`${where}: mindestens drei Satzteile erwartet`)
    const correct = `${parts.join(' ')}${end ?? ''}`
    german(problems, `${where}.sentence`, correct)
    const accepted = [correct, ...(source.alt ?? [])]
    for (const answer of accepted) if (words(answer) !== words(correct)) problems.push(`${where}: „${answer}“ benutzt andere Wörter`)
    if (new Set(accepted.map(normalized)).size !== accepted.length) problems.push(`${where}: doppelte Lösungen`)
    let order = shuffled(parts, ref)
    if (order.join(' ') === parts.join(' ')) order = [...order.slice(1), order[0]]
    content = { target_form, instruction, parts: order, correct_answer: correct, accepted_answers: accepted }
  }

  const instructions = localized(problems, `${where}.instruction`, source.instr.t, instruction)
  const hints = localized(problems, `${where}.hint`, hint.slice(1), hint[0])
  const tasks = source.tr === null ? null : localized(problems, `${where}.task`, source.tr)
  if (source.tr === undefined) problems.push(`${where}: Übersetzung der Aufgabe fehlt (oder ausdrücklich null)`)
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

function buildPath(problems, level, source) {
  const where = `P${source.n}`
  const objectives = Object.entries(source.objectives).map(([id, description]) => {
    if (!/^[GKZW]\d+$/.test(id)) problems.push(`${where}: Lernziel-ID ${id}`)
    return { id: `P${source.n}-${id}`, area: AREAS[id[0]], description: german(problems, `${where}.${id}`, description) }
  })
  const practice = source.nodes.filter(node => !node.kind)
  const cards = new Map()
  for (const node of practice) {
    const card = node.card
    if (!card?.id || cards.has(card.id)) { problems.push(`${where} „${node.title}“: Merkkarte fehlt oder ist doppelt`); continue }
    if (card.examples.length < 2 || card.examples.length > 4) problems.push(`${where} ${card.id}: 2 bis 4 Beispiele erwartet`)
    card.examples.forEach(example => german(problems, `${where} ${card.id}.examples`, example))
    cards.set(card.id, { id: card.id, rule: german(problems, `${where} ${card.id}.rule`, card.rule), hint: card.hint, hints: card.hints,
      translations: Object.fromEntries(Object.entries(localized(problems, `${where} ${card.id}.rule`, card.t, card.rule)).map(([locale, rule]) => [locale, { rule }])) })
  }
  // A goal is explained by the card of the first lesson that practises it, unless an exercise names another card.
  const goalCards = new Map()
  for (const node of practice) for (const exercise of node.ex) {
    const goal = `P${source.n}-${exercise.goal}`
    if (!goalCards.has(goal)) goalCards.set(goal, exercise.c ?? node.card.id)
  }
  const ctx = { level, path: source.n, objectives: new Set(objectives.map(objective => objective.id)), cards, goalCards }
  const ordered = [...practice, ...source.nodes.filter(node => node.kind === 'review'), ...source.nodes.filter(node => node.kind === 'test')]
  if (ordered.length !== source.nodes.length || ordered.at(-1)?.kind !== 'test' || ordered.at(-2)?.kind !== 'review') {
    problems.push(`${where}: Lektionen, dann genau eine Wiederholung und ein Test erwartet`)
  }
  const nodes = ordered.map((node, index) => {
    const id = `P${source.n}-N${index + 1}`
    const meta = node.kind === 'review' ? REVIEW : node.kind === 'test' ? TEST : node
    // From recognising to writing: choices first, then gaps, then word order.
    const sources = [...node.ex].sort((a, b) => TYPE_ORDER.indexOf(KINDS[a.type]) - TYPE_ORDER.indexOf(KINDS[b.type]))
    const exercises = sources.map((exercise, position) => buildExercise(problems, { ...ctx, nodeCard: node.card?.id, kind: node.kind },
      exercise, `${id}-E${String(position + 1).padStart(2, '0')}`)).filter(Boolean)
    const used = new Set(exercises.map(exercise => exercise.goal))
    if (!node.kind && (exercises.length < 5 || exercises.length > 10)) problems.push(`${id}: 5 bis 10 Aufgaben je Lektion (${exercises.length})`)
    if (!node.kind && !exercises.some(exercise => exercise.explanation_card === node.card?.id)) problems.push(`${id}: keine Aufgabe zur eigenen Merkkarte`)
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

  // Every goal is practised at least twice, repeated once and tested from at least two tasks.
  const goalsOf = kind => nodes.filter(node => node.kind === kind).flatMap(node => node.exercises.map(exercise => exercise.goal))
  const [practised, reviewed, pool] = [goalsOf('practice'), goalsOf('review'), goalsOf('test')]
  const test = nodes.at(-1)
  for (const { id } of objectives) {
    if (practised.filter(goal => goal === id).length < 2) problems.push(`${id}: weniger als zwei Übungsaufgaben`)
    if (!reviewed.includes(id)) problems.push(`${id}: fehlt in der Wiederholung`)
    if (pool.filter(goal => goal === id).length < 2) problems.push(`${id}: weniger als zwei Testaufgaben`)
  }
  if (test?.kind === 'test') {
    if (!(test.test_size >= Math.max(12, objectives.length) && test.test_size <= 16)) problems.push(`${where}: Testgröße ${test.test_size} (12–16, mindestens je Lernziel eine Aufgabe)`)
    if (pool.length < 2 * test.test_size) problems.push(`${where}: Testpool ${pool.length} kleiner als das Doppelte der Testgröße`)
  }
  return {
    id: `P${source.n}`, level, path: source.n, slug: source.slug, title: german(problems, `${where}.title`, source.title),
    translations: Object.fromEntries(Object.entries(localized(problems, `${where}.title`, source.t)).map(([locale, title]) => [locale, { title }])),
    unit: { level, trainer: 'exercises', label: `${level} · Pfad ${source.n} · ${source.title}`, sort_order: source.n },
    objectives, nodes,
  }
}

/** @returns the seed (array of paths) or throws a SeedBuildError listing every problem. */
export function buildLevelSeed({ level, paths }) {
  const problems = []
  const seed = paths.map(path => buildPath(problems, level, path))
  if (seed.map(path => path.path).join() !== seed.map((_, index) => index + 1).join()) problems.push('Pfade müssen lückenlos ab 1 nummeriert sein')
  // No task twice in a level: a repeated task would be recognised instead of solved.
  const seen = new Map()
  for (const path of seed) for (const node of path.nodes) for (const { ref, content } of node.exercises) {
    const key = JSON.stringify(['text_before', 'text_after', 'question', 'parts', 'correct_answer'].map(field =>
      Array.isArray(content[field]) ? [...content[field]].sort() : content[field]))
    if (seen.has(key)) problems.push(`${path.id} ${ref}: gleiche Aufgabe wie ${seen.get(key)}`)
    else seen.set(key, `${path.id} ${ref}`)
  }
  if (TEXTBOOK.test(JSON.stringify(seed))) problems.push('Lehrbuchname oder Lehrbuchverweis im Inhalt')
  if (problems.length) throw new SeedBuildError(problems)
  return seed
}

export const serializeSeed = seed => `${JSON.stringify(seed, null, 2)}\n`
