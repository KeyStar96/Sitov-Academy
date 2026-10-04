import 'server-only'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { getSimulationProfile, getSimulationProfileById, SIMULATION_SKILL_LABELS, SIMULATION_UNIVERSAL_PROFILES } from './catalogue'
import { SIMULATION_AUDIO_SOURCES, SIMULATION_CONTENT_VERSION, SIMULATION_TASK_POOL, type ServerSimulationTask } from './content'
import scenarios from '@/content/exam-simulation/sitov-scenarios.json'
import { normalizeSimulationFormAnswer } from './answers'
import type { SimulationAnswer, SimulationLevel, SimulationMode, SimulationProfile, SimulationProvider, SimulationResult, SimulationSession, SimulationSkill, SimulationTask, SimulationTaskFeedback, SimulationTeacherReview } from './types'

export { SIMULATION_AUDIO_SOURCES } from './content'
export type { ServerSimulationTask } from './content'
export interface StoredSimulationSession extends Omit<SimulationSession, 'tasks'> {
  tasks: ServerSimulationTask[]
  teacherReviews: Record<string, SimulationTeacherReview>
  /** Frozen with the snapshot so later catalogue changes cannot regrade old runs. */
  rubric?: { version: number; variantSet: number; skillMinimum: number; productiveTaskMinimum: number; requiredSkills: SimulationSkill[]; requiredFamilies: { id: string; tasks: number }[] }
}
export interface BuildSimulationOptions {
  level: SimulationLevel
  provider: SimulationProvider
  mode?: SimulationMode
  previousTaskIds?: string[]
  preparedAudio?: Record<string, { src: string; wordTimingsVerified: true }>
  now?: Date
  /** For reproducible server tests only; the action never accepts a client seed. */
  seed?: string
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const universalAudioIds = new Set(SIMULATION_AUDIO_SOURCES.map(source => source.id))
const audioFamilies = ['listening-announcement', 'listening-detail', 'listening-conversation', 'listening-opinion']
/** Bijections: every hearing source is used once; printed matching triples never share its story. */
const audioVariantMapping = [[3, 0, 1, 2, 4, 5], [1, 2, 4, 0, 3, 5], [0, 1, 2, 4, 5, 3], [0, 1, 2, 3, 4, 5]]

function sourceIdForSet(level: SimulationLevel, family: string, set: number): string {
  const familyIndex = audioFamilies.indexOf(family === 'integrated-listening-writing' ? 'listening-detail' : family)
  return `sitov-simulation-${level.toLowerCase()}-${audioFamilies[familyIndex]}-v${audioVariantMapping[familyIndex][set] + 1}`
}

function tasksForVariant(level: SimulationLevel, family: string, set: number): ServerSimulationTask[] {
  const first = set * 2
  const pair = [scenarios[first].id, scenarios[first + 1].id]
  return SIMULATION_TASK_POOL.filter(task => task.level === level && task.family === family).filter(task => {
    if (task.audioSource) return task.audioSource.id === sourceIdForSet(level, family, set)
    if (task.type === 'matching') return task.scenarioId === scenarios[first].id
    if (task.skill === 'language') return pair.includes(task.sourceScenarioIds?.[0] ?? '')
    return pair.includes(task.scenarioId)
  })
}
type PreparedAudio = NonNullable<BuildSimulationOptions['preparedAudio']>

/** A level starts only with six complete, imported sources for every mandatory hearing genre. */
export function getUniversalReadiness(preparedAudio: PreparedAudio): SimulationProfile[] {
  return SIMULATION_UNIVERSAL_PROFILES.map(profile => {
    const blockers: string[] = []
    for (const family of profile.families) {
      const candidates = SIMULATION_TASK_POOL.filter(task => task.level === profile.level && task.family === family.id)
      if (family.requiresAudio) {
        const importedSources = new Set(candidates.filter(task => task.audioSource && universalAudioIds.has(task.audioSource.id)
          && preparedAudio[task.audioSource.id]?.wordTimingsVerified === true
          && /^https?:\/\//.test(preparedAudio[task.audioSource.id]?.src ?? '')).map(task => task.audioSource!.id))
        const sufficient = [...importedSources].filter(id => candidates.filter(task => task.audioSource?.id === id).length >= family.practiceTasks)
        if (sufficient.length < 6) blockers.push(`${family.title}: ${sufficient.length}/6 vollständige Hörvarianten mit importierter Aufnahme und Wortzeitmarken.`)
      } else {
        const completeSets = [0, 1, 2, 3, 4, 5].filter(set => {
          const tasks = tasksForVariant(profile.level, family.id, set)
          return new Set(tasks.map(task => task.id)).size >= family.practiceTasks
        }).length
        if (completeSets < 6) blockers.push(`${family.title}: ${completeSets}/6 vollständige Aufgabenvarianten im freigegebenen Pool.`)
      }
    }
    return { ...clone(profile), fullExamReleased: blockers.length === 0, blockers }
  })
}

/** Seed never crosses the server boundary. SHA-256 with rejection avoids selection bias. */
function randomGenerator(seed: string): (limit: number) => number {
  let counter = 0
  return (limit: number) => {
    const ceiling = Math.floor(0x100000000 / limit) * limit
    let number: number
    do { number = createHash('sha256').update(`${seed}:${counter++}`).digest().readUInt32BE(0) } while (number >= ceiling)
    return number % limit
  }
}
function shuffled<T>(values: T[], random: (limit: number) => number): T[] {
  const output = [...values]
  for (let index = output.length - 1; index > 0; index--) {
    const other = random(index + 1)
    ;[output[index], output[other]] = [output[other], output[index]]
  }
  return output
}
function shuffleChoices(task: ServerSimulationTask, random: (limit: number) => number): ServerSimulationTask {
  if (!task.options || !['choice', 'matching', 'ordering'].includes(task.type)) return task
  const options = shuffled(task.options, random)
  const mapping = new Map(options.map((option, index) => [option.id, String.fromCharCode(97 + index)]))
  const transform = (answer: string) => mapping.get(answer) ?? answer
  return { ...task, options: options.map((option, index) => ({ id: String.fromCharCode(97 + index), text: option.text })), correctAnswer: Array.isArray(task.correctAnswer) ? task.correctAnswer.map(transform) : task.correctAnswer ? transform(task.correctAnswer) : undefined }
}

export function buildSimulation(options: BuildSimulationOptions): StoredSimulationSession {
  const profile = getSimulationProfile(options.level, options.provider)
  if (!profile.available || !profile.practiceAvailable) throw new Error('Dieses Prüfungsformat ist für das gewählte Niveau nicht verfügbar.')
  const mode = options.mode ?? (options.provider === 'sitov' ? 'exam' : 'practice')
  const universal = options.provider === 'sitov'
  if (mode === 'exam' && !(universal ? getUniversalReadiness(options.preparedAudio ?? {}).find(item => item.level === options.level)?.fullExamReleased : profile.fullExamReleased)) throw new Error('Die vollständige Prüfung ist noch nicht freigegeben. Alle Pflichtaufgaben, Hörvarianten und Wortzeitmarken müssen vorbereitet sein.')
  const random = randomGenerator(options.seed ?? randomBytes(32).toString('hex'))
  const seen = new Set(options.previousTaskIds ?? [])
  const availableSets = universal ? [0, 1, 2, 3, 4, 5].filter(set => profile.families.every(family => tasksForVariant(options.level, family.id, set).every(task => !seen.has(task.id)))) : []
  if (universal && !availableSets.length) throw new Error('Alle neuen Varianten dieser Aufgabenform wurden bereits bearbeitet. Die Lehrkraft muss den Aufgabenpool ergänzen.')
  const variantSet = universal ? shuffled(availableSets, random)[0] : 0
  const seenAudioSources = new Set(SIMULATION_TASK_POOL.filter(task => seen.has(task.id) && task.audioSource).map(task => task.audioSource!.id))
  const usedScenarios = new Set<string>()
  const chosenSources: Record<string, string> = {}
  const tasks: ServerSimulationTask[] = []
  const missing: string[] = []
  // Choose hearing sets first so later reading questions do not reveal the same source story.
  const orderedFamilies = [...profile.families].sort((a, b) => Number(b.requiresAudio) - Number(a.requiresAudio)
    || (a.skill === 'listening' ? -1 : 0) - (b.skill === 'listening' ? -1 : 0))
  for (const family of orderedFamilies) {
    const available = (universal ? tasksForVariant(options.level, family.id, variantSet) : SIMULATION_TASK_POOL.filter(task => task.level === options.level && task.family === family.id))
      .filter(task => !universal || task.skill !== 'listening' || (task.audioSource && universalAudioIds.has(task.audioSource.id)))
      .filter(task => !task.audioSource || options.preparedAudio?.[task.audioSource.id]?.wordTimingsVerified === true)
      .filter(task => family.id !== 'integrated-listening-writing' || !chosenSources['listening-detail'] || task.audioSource?.id === chosenSources['listening-detail'])
    const fresh = available.filter(task => !seen.has(task.id) && (!task.audioSource || !seenAudioSources.has(task.audioSource.id)))
    if (available.length && !fresh.length && (universal || family.skill !== 'listening')) throw new Error('Alle neuen Varianten dieser Aufgabenform wurden bereits bearbeitet. Die Lehrkraft muss den Aufgabenpool ergänzen.')
    if (fresh.length < family.practiceTasks) { missing.push(family.id); continue }
    const distinct = shuffled(fresh.filter(task => !usedScenarios.has(task.scenarioId)), random)
    const remaining = shuffled(fresh.filter(task => usedScenarios.has(task.scenarioId)), random)
    let selected = [...distinct, ...remaining].slice(0, family.practiceTasks)
    if (family.requiresAudio) {
      const groups = [...new Set(fresh.map(task => task.audioSource?.id).filter((id): id is string => Boolean(id)))]
        .filter(id => fresh.filter(task => task.audioSource?.id === id).length >= family.practiceTasks)
      if (!groups.length) { missing.push(family.id); continue }
      const sourceId = shuffled(groups, random)[0]
      chosenSources[family.id] = sourceId
      selected = fresh.filter(task => task.audioSource?.id === sourceId).slice(0, family.practiceTasks)
    }
    for (const source of selected) {
      let task = shuffleChoices(clone(source), random)
      if (task.audioSource) {
        const proof = options.preparedAudio![task.audioSource.id]
        if (!proof.src || !/^https?:\/\//.test(proof.src)) throw new Error('Die vorbereitete Aufnahme hat keine gültige Storage-Adresse.')
        task = { ...task, audio: { id: task.audioSource.id, src: proof.src, plays: task.audioSource.plays } }
      }
      tasks.push(task)
      usedScenarios.add(task.scenarioId)
    }
  }
  if (!tasks.length) throw new Error('Für dieses Prüfungsformat sind noch keine Aufgaben freigegeben.')
  if (universal) {
    const heardStories = new Set(tasks.filter(task => task.skill === 'listening').flatMap(task => task.sourceScenarioIds ?? [task.scenarioId]))
    const printedStories = tasks.filter(task => !task.audioSource).flatMap(task => task.sourceScenarioIds ?? [task.scenarioId])
    if (printedStories.some(id => heardStories.has(id))) throw new Error('Die Prüfung kann nicht starten, weil ein gedruckter Text Lösungen einer Hörquelle vorwegnehmen würde.')
  }
  if (universal && mode === 'exam' && missing.length) throw new Error('Die Prüfung kann erst beginnen, wenn alle Pflichtgebiete vollständig vorbereitet sind.')
  const sortedTasks = tasks.sort((a, b) => profile.families.findIndex(family => family.id === a.family) - profile.families.findIndex(family => family.id === b.family))
  const now = options.now ?? new Date()
  return {
    id: randomUUID(), version: SIMULATION_CONTENT_VERSION, profileId: profile.id,
    level: profile.level, provider: profile.provider, mode, title: universal ? profile.title : `Lerncheck im Prüfungsformat · ${profile.title}`,
    startedAt: now.toISOString(), expiresAt: new Date(now.getTime() + profile.practiceMinutes * 60_000).toISOString(),
    status: 'active', tasks: sortedTasks, answers: {}, teacherReviews: {},
    ...(universal ? { rubric: { version: 1, variantSet, skillMinimum: 70, productiveTaskMinimum: 50, requiredSkills: [...new Set(profile.families.map(family => family.skill))], requiredFamilies: profile.families.map(family => ({ id: family.id, tasks: family.practiceTasks })) } } : {}),
    coverage: { included: [...new Set(tasks.map(task => task.family))], missing, fullExam: universal && mode === 'exam' && missing.length === 0,
      note: universal ? 'Umfassende eigene Prüfung von Sitov Academy mit Aufgabenformen mehrerer Institute. Die Bewertung folgt der transparenten Sitov-Rubrik; sie ist eine Einschätzung der Prüfungsbereitschaft und keine Garantie für eine reale Prüfung.' : 'Ausgewählte Aufgabenformen mit eigenen Texten. Fehlende Originalbestandteile erlauben keine Bestehenszusage.' },
  }
}

/** Explicit allowlist prevents future confidential authoring fields from escaping. */
function publicTask(task: ServerSimulationTask): SimulationTask {
  return {
    id: task.id, version: task.version, level: task.level, skill: task.skill, family: task.family,
    type: task.type, title: task.title, instruction: task.instruction, maxPoints: task.maxPoints, minutes: task.minutes,
    ...(task.text ? { text: task.text } : {}), ...(task.options ? { options: clone(task.options) } : {}),
    ...(task.prompts ? { prompts: clone(task.prompts) } : {}), ...(task.criteria ? { criteria: [...task.criteria] } : {}),
    ...(task.fields ? { fields: clone(task.fields) } : {}), ...(task.interactionRequired ? { interactionRequired: true } : {}),
    ...(task.audio ? { audio: clone(task.audio) } : {}), ...(task.image ? { image: clone(task.image) } : {}),
  }
}
export function publicSimulation(session: StoredSimulationSession): SimulationSession {
  return {
    id: session.id, version: session.version, profileId: session.profileId, level: session.level,
    provider: session.provider, mode: session.mode, title: session.title,
    startedAt: session.startedAt, expiresAt: session.expiresAt, status: session.status,
    ...(session.completedAt ? { completedAt: session.completedAt } : {}), tasks: session.tasks.map(publicTask),
    answers: clone(session.answers), coverage: clone(session.coverage),
    ...(session.status === 'completed' && session.result ? { result: clone(session.result) } : {}),
  }
}

export function validateSimulationAnswer(task: ServerSimulationTask, answer: SimulationAnswer): SimulationAnswer {
  if (task.type === 'form') {
    if (!Array.isArray(answer) || answer.length > (task.fields?.length ?? 0) || answer.some(value => typeof value !== 'string' || value.length > 300)) throw new Error('Bitte füllen Sie die vorgesehenen Formularfelder aus.')
    return [...answer]
  }
  if (task.type === 'writing' || task.type === 'speaking') {
    if (typeof answer === 'string') {
      if (answer.length > 20_000) throw new Error('Die Antwort ist zu lang.')
      return answer
    }
    if (!answer || Array.isArray(answer) || typeof answer.text !== 'string' || answer.text.length > 20_000) throw new Error('Bitte geben Sie eine gültige Antwort ein.')
    if (answer.audioPath !== undefined && (typeof answer.audioPath !== 'string' || answer.audioPath.length > 500)) throw new Error('Die Aufnahme ist ungültig.')
    return { text: answer.text, ...(answer.audioPath ? { audioPath: answer.audioPath } : {}) }
  }
  if (task.type === 'matching' || task.type === 'ordering') {
    if (!Array.isArray(answer) || answer.length > 30 || answer.some(value => typeof value !== 'string' || value.length > 200)) throw new Error('Bitte geben Sie eine gültige Zuordnung ein.')
    if (answer.length > (task.type === 'matching' ? task.prompts?.length ?? 0 : task.options?.length ?? 0)) throw new Error('Die Zuordnung enthält zu viele Antworten.')
    const validIds = new Set(task.options?.map(option => option.id) ?? [])
    if (answer.some(value => value !== '' && !validIds.has(value))) throw new Error('Die Antwort enthält eine unbekannte Auswahl.')
    if (task.type === 'matching' && new Set(answer.filter(Boolean)).size !== answer.filter(Boolean).length) throw new Error('Ein Angebot wurde mehrfach zugeordnet.')
    if (task.type === 'ordering' && new Set(answer.filter(Boolean)).size !== answer.filter(Boolean).length) throw new Error('Ein Element wurde mehrfach gewählt.')
    return [...answer]
  }
  if (typeof answer !== 'string' || ![...(task.options?.map(option => option.id) ?? []), ...(task.type === 'true-false' ? ['true', 'false'] : [])].includes(answer)) throw new Error('Bitte wählen Sie eine gültige Antwort.')
  return answer
}
export function submitSimulationAnswer(session: StoredSimulationSession, taskId: string, answer: SimulationAnswer, now = new Date()): StoredSimulationSession {
  if (session.status !== 'active') throw new Error('Dieser Durchgang ist bereits abgeschlossen.')
  if (now.getTime() >= new Date(session.expiresAt).getTime()) throw new Error('Die Bearbeitungszeit ist abgelaufen. Schließen Sie den Durchgang ab.')
  const task = session.tasks.find(item => item.id === taskId)
  if (!task) throw new Error('Diese Aufgabe gehört nicht zu Ihrem Durchgang.')
  return { ...clone(session), answers: { ...clone(session.answers), [taskId]: validateSimulationAnswer(task, answer) } }
}
function answerEvidence(task: ServerSimulationTask, answer: SimulationAnswer | undefined): boolean {
  if (task.type === 'speaking') return Boolean(answer && typeof answer === 'object' && !Array.isArray(answer) && answer.audioPath)
  if (task.type === 'writing') return typeof answer === 'string' ? !!answer.trim() : Boolean(answer && !Array.isArray(answer) && answer.text.trim())
  return answer !== undefined && (Array.isArray(answer) ? answer.some(Boolean) : typeof answer === 'string' && answer.length > 0)
}
function answerText(task: ServerSimulationTask, answer: SimulationAnswer | undefined): string | string[] | undefined {
  if (answer === undefined) return undefined
  const label = (value: string) => task.options?.find(option => option.id === value)?.text ?? (task.type === 'true-false' ? value === 'true' ? 'Richtig' : value === 'false' ? 'Falsch' : value : value)
  if (Array.isArray(answer)) return answer.map(label)
  return typeof answer === 'string' ? label(answer) : answer.text
}

export function evaluateSimulation(session: StoredSimulationSession): SimulationResult {
  const profile = getSimulationProfileById(session.profileId)
  if (!profile || profile.level !== session.level || profile.provider !== session.provider) throw new Error('Der gespeicherte Prüfungsdurchgang ist ungültig.')
  const feedback: SimulationTaskFeedback[] = session.tasks.map(task => {
    const answer = session.answers[task.id]
    const hasAnswer = answerEvidence(task, answer)
    const productive = task.type === 'writing' || task.type === 'speaking'
    const review = session.teacherReviews?.[task.id]
    const interactionSatisfied = session.provider !== 'sitov' || !task.interactionRequired || review?.interactionConfirmed === true
    let correct: boolean | null = null
    let points: number | null = null
    if (productive) {
      if (!hasAnswer) { correct = false; points = 0 }
      else if (review) {
        if (review.maxPoints !== task.maxPoints || !Number.isFinite(review.score) || review.score < 0 || review.score > task.maxPoints) throw new Error('Die Lehrkraftbewertung enthält ungültige Punkte.')
        points = review.score
        correct = interactionSatisfied && points >= task.maxPoints * (session.provider === 'sitov' ? (session.rubric?.productiveTaskMinimum ?? 50) / 100 : 0.6)
      }
    } else {
      if (task.correctAnswer === undefined) throw new Error('Für eine geschlossene Aufgabe fehlt die geprüfte Lösung.')
      if (Array.isArray(task.correctAnswer)) {
        const actual = Array.isArray(answer) ? answer : []
        const normalize = (value: string, index: number) => normalizeSimulationFormAnswer(value, task.fields?.[index]?.id ?? '')
        const hits = task.correctAnswer.filter((value, index) => task.type === 'form' ? normalize(actual[index] ?? '', index) === normalize(value, index) : actual[index] === value).length
        points = task.correctAnswer.length ? task.maxPoints * hits / task.correctAnswer.length : 0
        correct = hasAnswer && hits === task.correctAnswer.length && actual.length === task.correctAnswer.length
      } else { correct = hasAnswer && answer === task.correctAnswer; points = correct ? task.maxPoints : 0 }
    }
    const expected = productive ? undefined : answerText(task, task.correctAnswer)
    return {
      taskId: task.id, title: task.title, skill: task.skill, family: task.family, answer: answer === undefined ? null : clone(answer),
      ...(answerText(task, answer) !== undefined ? { answerText: answerText(task, answer) } : {}), correct, points, maxPoints: task.maxPoints,
      ...(expected !== undefined ? { expectedAnswer: expected } : {}),
      explanation: productive && !hasAnswer ? task.type === 'speaking' ? 'Keine mündliche Aufnahme eingereicht. Ein Vorbereitungstext ersetzt diese Leistung nicht.' : 'Kein Text eingereicht. Diese Leistung wurde mit null Punkten erfasst.' : productive && review && !interactionSatisfied ? 'Für diese Gesprächsaufgabe fehlt die Bestätigung einer echten Interaktion. Positive Punkte allein belegen keine ausreichende Gesprächsleistung.' : task.explanation,
      ...(!productive && task.evidence ? { evidence: task.evidence } : {}), ...(task.criteria ? { criteria: [...task.criteria] } : {}),
      ...(review && hasAnswer ? { teacherReview: clone(review) } : {}),
    }
  })
  const skills = [...new Set(session.tasks.map(task => task.skill))].map(skill => {
    const items = feedback.filter(task => task.skill === skill)
    const reviewed = items.filter(task => task.points !== null)
    const points = reviewed.reduce((sum, task) => sum + (task.points ?? 0), 0)
    const maxPoints = reviewed.reduce((sum, task) => sum + task.maxPoints, 0)
    return { skill, title: SIMULATION_SKILL_LABELS[skill], points, maxPoints, percentage: maxPoints ? Math.floor(points / maxPoints * 1000) / 10 : null,
      pendingTeacherTasks: items.filter(task => task.points === null).length, correctTasks: items.filter(task => task.correct === true).length, wrongTasks: items.filter(task => task.correct === false).length }
  })
  const reviewedPoints = skills.reduce((sum, skill) => sum + skill.points, 0)
  const reviewedMaxPoints = skills.reduce((sum, skill) => sum + skill.maxPoints, 0)
  const percentage = reviewedMaxPoints ? Math.floor(reviewedPoints / reviewedMaxPoints * 1000) / 10 : null
  const pendingTeacherTasks = feedback.filter(task => task.points === null).length
  const missingSkills: SimulationSkill[] = [...new Set(profile.families.filter(family => session.coverage.missing.includes(family.id)).map(family => family.skill))]
  const closed = feedback.filter(task => task.skill !== 'writing' && task.skill !== 'speaking')
  const closedPercentage = closed.length ? closed.reduce((sum, task) => sum + (task.points ?? 0), 0) / closed.reduce((sum, task) => sum + task.maxPoints, 0) : 0
  const missingPerformance = feedback.some(task => task.answer === null || ((task.skill === 'writing' || task.skill === 'speaking') && !answerEvidence(session.tasks.find(item => item.id === task.taskId)!, task.answer ?? undefined)))
  const frozenFamilies = session.rubric?.requiredFamilies
  const exactCoverage = frozenFamilies && session.tasks.length === frozenFamilies.reduce((sum, family) => sum + family.tasks, 0)
    && new Set(session.tasks.map(task => task.id)).size === session.tasks.length
    && frozenFamilies.every(family => session.tasks.filter(task => task.family === family.id).length === family.tasks)
  const fullUniversal = session.provider === 'sitov' && session.mode === 'exam' && session.coverage.fullExam && !session.coverage.missing.length && Boolean(exactCoverage)
  const requiredSkills = session.rubric?.requiredSkills ?? [...new Set(profile.families.map(family => family.skill))]
  const skillMinimum = session.rubric?.skillMinimum ?? 70
  const productiveTaskMinimum = session.rubric?.productiveTaskMinimum ?? 50
  const productiveFeedback = feedback.filter(task => task.skill === 'writing' || task.skill === 'speaking')
  const allProductivePresent = session.tasks.filter(task => task.type === 'writing' || task.type === 'speaking' || task.type === 'form').every(task => answerEvidence(task, session.answers[task.id]))
  const criticalProductivePassed = productiveFeedback.every(feedback => {
    const task = session.tasks.find(item => item.id === feedback.taskId)!
    return feedback.points !== null && feedback.points >= feedback.maxPoints * productiveTaskMinimum / 100
      && (!task.interactionRequired || feedback.teacherReview?.interactionConfirmed === true)
  })
  const knownProductiveFailure = productiveFeedback.some(feedback => {
    if (feedback.points === null) return false
    const task = session.tasks.find(item => item.id === feedback.taskId)!
    return feedback.points < feedback.maxPoints * productiveTaskMinimum / 100
      || Boolean(task.interactionRequired && feedback.teacherReview?.interactionConfirmed !== true)
  })
  const knownSkillFailure = requiredSkills.some(skill => skills.some(item => item.skill === skill && item.maxPoints > 0
    && item.pendingTeacherTasks === 0 && item.points * 100 < item.maxPoints * skillMinimum))
  const knownFailure = !allProductivePresent || knownProductiveFailure || knownSkillFailure
  const skillsPassed = requiredSkills.every(skill => skills.some(item => item.skill === skill && item.maxPoints > 0 && item.points * 100 >= item.maxPoints * skillMinimum && item.pendingTeacherTasks === 0))
  const examPass = fullUniversal ? knownFailure ? false : pendingTeacherTasks ? null : criticalProductivePassed && skillsPassed : null
  const status: SimulationResult['status'] = examPass === false ? 'not-passed' : pendingTeacherTasks ? 'teacher-review-required' : fullUniversal ? 'passed' : closedPercentage >= 0.8 && !missingPerformance ? 'practice-strong' : 'practice-needed'
  const nextSteps = [
    ...skills.filter(skill => skill.percentage !== null && skill.maxPoints > 0 && skill.points / skill.maxPoints * 100 < (session.rubric?.skillMinimum ?? 60)).map(skill => `${skill.title}: Besprechen Sie die markierten Fehler und üben Sie diese Aufgabenform gezielt.`),
    ...(pendingTeacherTasks ? ['Lassen Sie die eingereichten Schreib- und Sprechleistungen durch Ihre Lehrkraft bewerten.'] : []),
    ...(missingSkills.includes('listening') ? ['Hören ist noch nicht vollständig enthalten. Üben Sie die freigegebenen Hörteile, sobald die vorbereiteten Aufnahmen verfügbar sind.'] : []),
    ...(missingPerformance ? ['Reichen Sie im nächsten Durchgang alle schriftlichen Texte und mündlichen Aufnahmen ein.'] : []),
    ...(fullUniversal ? ['Besprechen Sie die Einschätzung mit Ihrer Lehrkraft. Die Regeln Ihrer realen Prüfung können abweichen.'] : ['Nutzen Sie anschließend einen vollständigen offiziellen Modellsatz Ihrer Zielprüfung mit den Originalzeiten.']),
  ]
  return {
    status, headline: status === 'teacher-review-required' ? 'Ihre Lehrkraft bewertet noch' : status === 'passed' ? 'Die Sitov-Prüfung bestanden' : status === 'not-passed' ? 'Vor der Prüfung noch gezielt üben' : status === 'practice-strong' ? 'Stark in diesen Aufgaben' : 'Hier können Sie gezielt weiterüben',
    description: fullUniversal ? 'Eigene Sitov-Rubrik: mindestens 70 % je Fertigkeit sowie mindestens 50 % je Schreib- und Sprechaufgabe; alle produktiven Leistungen und echten Gespräche sind erforderlich. Diese Einschätzung ersetzt keine reale Zertifikatsprüfung und garantiert deren Bestehen nicht.' : 'Dieses Ergebnis beschreibt ausschließlich den Lerncheck und erlaubt keine Aussage über das Bestehen einer realen Prüfung.',
    examPass, percentage, reviewedPoints, reviewedMaxPoints, totalMaxPoints: feedback.reduce((sum, task) => sum + task.maxPoints, 0),
    pendingTeacherTasks, missingSkills, skills, feedback, nextSteps,
  }
}
export function finishSimulation(session: StoredSimulationSession, now = new Date()): StoredSimulationSession {
  if (session.status === 'completed') return clone(session)
  const finished: StoredSimulationSession = { ...clone(session), status: 'completed', completedAt: now.toISOString() }
  finished.result = evaluateSimulation(finished)
  return finished
}
export function reviewSimulationTask(session: StoredSimulationSession, taskId: string, review: SimulationTeacherReview): StoredSimulationSession {
  if (session.status !== 'completed') throw new Error('Der Durchgang muss vor der Bewertung abgeschlossen sein.')
  const task = session.tasks.find(item => item.id === taskId)
  if (!task || !['writing', 'speaking'].includes(task.type)) throw new Error('Diese Aufgabe kann nicht manuell bewertet werden.')
  if (!answerEvidence(task, session.answers[taskId])) throw new Error('Für diese Aufgabe wurde keine bewertbare Leistung eingereicht.')
  if (review.maxPoints !== task.maxPoints || !Number.isFinite(review.score) || review.score < 0 || review.score > task.maxPoints || !review.teacherId || !review.comment?.trim() || !Number.isFinite(Date.parse(review.reviewedAt))) throw new Error('Bitte geben Sie eine vollständige Bewertung mit gültigen Punkten ein.')
  if (task.interactionRequired && review.score > 0 && review.interactionConfirmed !== true) throw new Error('Positive Punkte erfordern ein bestätigtes echtes Gespräch mit Partnerantworten und Rückfragen.')
  const reviewed = { ...clone(session), teacherReviews: { ...clone(session.teacherReviews ?? {}), [taskId]: clone(review) } }
  reviewed.result = evaluateSimulation(reviewed)
  return reviewed
}
