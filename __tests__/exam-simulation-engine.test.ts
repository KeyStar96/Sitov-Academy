/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { SIMULATION_LEVELS, SIMULATION_UNIVERSAL_PROFILES, getSimulationProfileById } from '@/lib/exam-simulation/catalogue'
import { SIMULATION_TASK_POOL, SIMULATION_AUDIO_SOURCES } from '@/lib/exam-simulation/content'
import { buildSimulation, evaluateSimulation, finishSimulation, getUniversalReadiness, publicSimulation, reviewSimulationTask, submitSimulationAnswer, validateSimulationAnswer } from '@/lib/exam-simulation/engine'
import type { SimulationAnswer, SimulationLevel } from '@/lib/exam-simulation/types'
import type { StoredSimulationSession } from '@/lib/exam-simulation/engine'
import { normalizeSimulationFormAnswer } from '@/lib/exam-simulation/answers'
const now = new Date('2026-10-04T10:00:00.000Z')
const preparedAudio = Object.fromEntries(SIMULATION_AUDIO_SOURCES.map(source => [source.id, { src: `https://storage.sitov.example/${source.id}.mp3`, wordTimingsVerified: true as const }]))
const start = (level: SimulationLevel = 'B1', seed = 'sitov-engine-test') => buildSimulation({ level, provider: 'sitov', preparedAudio, now, seed })
function completeAnswers(session: StoredSimulationSession, excludedId?: string): StoredSimulationSession {
  let updated = session
  for (const task of session.tasks) if (task.id !== excludedId) {
    const answer: SimulationAnswer = task.correctAnswer ?? (task.type === 'speaking' ? { text: '', audioPath: `sitov-owner/${task.id}.webm` } : 'Ein selbstständig verfasster und noch von der Lehrkraft zu bewertender Text.')
    updated = submitSimulationAnswer(updated, task.id, answer, now)
  }
  return updated
}
function reviewAll(session: StoredSimulationSession, overrides: Record<string, number> = {}): StoredSimulationSession {
  let updated = session
  for (const task of session.tasks.filter(item => item.type === 'writing' || item.type === 'speaking')) {
    if (!session.answers[task.id]) continue
    updated = reviewSimulationTask(updated, task.id, { score: overrides[task.id] ?? task.maxPoints, maxPoints: task.maxPoints, comment: 'Inhalt, Sprache und tatsächliches Gespräch wurden anhand der Kriterien bewertet.', teacherId: 'sitov-teacher', reviewedAt: now.toISOString(), interactionConfirmed: true })
  }
  return updated
}

describe('universal complete Sitov simulations', () => {
  it('has one universal profile per level, preserving readable legacy profiles', () => {
    expect(SIMULATION_UNIVERSAL_PROFILES.map(profile => profile.level)).toEqual(SIMULATION_LEVELS)
    expect(SIMULATION_UNIVERSAL_PROFILES.every(profile => profile.provider === 'sitov')).toBe(true)
    expect(getSimulationProfileById('goethe_b1')?.provider).toBe('goethe')
    expect(getSimulationProfileById('sitov_c2')?.passRule).toContain('70 %')
    expect(getSimulationProfileById('sitov_c2')?.passRule).toContain('50 %')
    expect(() => buildSimulation({ level: 'B2', provider: 'dtz', now })).toThrow('nicht verfügbar')
  })
  it('requires every family and six imported source variants per hearing genre before a full start', () => {
    expect(getUniversalReadiness({}).every(profile => !profile.fullExamReleased)).toBe(true)
    expect(() => buildSimulation({ level: 'B1', provider: 'sitov', now })).toThrow('noch nicht freigegeben')
    expect(getUniversalReadiness(preparedAudio).every(profile => profile.fullExamReleased)).toBe(true)
    const oneMissing = { ...preparedAudio }
    delete oneMissing[SIMULATION_AUDIO_SOURCES[0].id]
    expect(getUniversalReadiness(oneMissing).find(profile => profile.level === 'A1')?.fullExamReleased).toBe(false)
    expect(getUniversalReadiness(oneMissing).find(profile => profile.level === 'A1')?.blockers.some(message => message.includes('5/6'))).toBe(true)
  })
  it('also rejects publication if a mandatory written family is missing from any one of the six packs', () => {
    const removed = SIMULATION_TASK_POOL.filter(task => task.level === 'B2' && task.family === 'reading-coherence' && ['fahrrad', 'wohnung'].includes(task.scenarioId))
    const indices = removed.map(task => SIMULATION_TASK_POOL.indexOf(task))
    try {
      for (const index of [...indices].sort((a, b) => b - a)) SIMULATION_TASK_POOL.splice(index, 1)
      const readiness = getUniversalReadiness(preparedAudio)
      expect(readiness.find(profile => profile.level === 'B2')?.fullExamReleased).toBe(false)
      expect(readiness.find(profile => profile.level === 'B2')?.blockers.some(message => message.includes('5/6 vollständige Aufgabenvarianten'))).toBe(true)
      expect(() => start('B2')).toThrow('noch nicht freigegeben')
      expect(readiness.find(profile => profile.level === 'B1')?.fullExamReleased).toBe(true)
    } finally {
      indices.forEach((index, position) => SIMULATION_TASK_POOL.splice(index, 0, removed[position]))
    }
  })
  it('builds every compulsory family with complete declared counts and no absent hearing', () => {
    const counts = { A1: 20, A2: 23, B1: 29, B2: 31, C1: 32, C2: 33 }
    const automaticDecisions = { A1: 21, A2: 21, B1: 23, B2: 27, C1: 28, C2: 30 }
    const times = { A1: 80, A2: 100, B1: 150, B2: 180, C1: 210, C2: 240 }
    for (const profile of SIMULATION_UNIVERSAL_PROFILES) {
      const session = start(profile.level)
      expect(session.tasks).toHaveLength(counts[profile.level])
      expect(session.tasks.filter(task => !['writing', 'speaking'].includes(task.type)).reduce((sum, task) => sum + (Array.isArray(task.correctAnswer) ? task.correctAnswer.length : 1), 0)).toBe(automaticDecisions[profile.level])
      expect(session.coverage.fullExam).toBe(true)
      expect(session.coverage.missing).toEqual([])
      expect(new Set(session.tasks.map(task => task.id)).size).toBe(session.tasks.length)
      for (const family of profile.families) expect(session.tasks.filter(task => task.family === family.id)).toHaveLength(family.practiceTasks)
      expect(session.tasks.filter(task => task.skill === 'listening')).toHaveLength(8)
      expect(session.tasks.some(task => task.type === 'true-false')).toBe(true)
      if (['B2', 'C1', 'C2'].includes(profile.level)) expect(session.tasks.filter(task => task.type === 'ordering')).toHaveLength(1)
      if (['A1', 'A2', 'B1', 'B2'].includes(profile.level)) expect(session.tasks.filter(task => task.type === 'true-false')).toHaveLength(2)
      const grammarChoice = session.tasks.filter(task => task.family === 'language-choice').map(task => task.text)
      expect(session.tasks.filter(task => task.family === 'language-cloze').every(task => !grammarChoice.includes(task.text))).toBe(true)
      expect(new Date(session.expiresAt).getTime() - now.getTime()).toBe(times[profile.level] * 60_000)
      expect(session.rubric?.requiredFamilies).toEqual(profile.families.map(family => ({ id: family.id, tasks: family.practiceTasks })))
      expect(publicSimulation(session)).not.toHaveProperty('rubric')
    }
  })
  it('chooses one complete source per genre, and upper mediation uses the selected lecture', () => {
    const session = start('C2')
    for (const family of ['listening-announcement', 'listening-detail', 'listening-conversation', 'listening-opinion']) {
      const tasks = session.tasks.filter(task => task.family === family)
      expect(tasks).toHaveLength(2)
      expect(new Set(tasks.map(task => task.audioSource?.id)).size).toBe(1)
    }
    const lecture = session.tasks.find(task => task.family === 'listening-detail')!
    const mediation = session.tasks.find(task => task.family === 'integrated-listening-writing')!
    expect(mediation.audioSource?.id).toBe(lecture.audioSource?.id)
    expect(session.tasks.find(task => task.family === 'writing-reformulation')).toBeDefined()
    expect(session.tasks.find(task => task.family === 'speaking-experience')?.image?.alt).toContain('Zwei Männer')
  })
  it('produces six fully fresh whole exams per level then requests authored replenishment without recycling', () => {
    for (const level of SIMULATION_LEVELS) {
      const seen: string[] = []
      const seenSources = new Set<string>()
      for (let run = 0; run < 6; run++) {
        const session = buildSimulation({ level, provider: 'sitov', preparedAudio, previousTaskIds: seen, now, seed: `sitov-${level}-${run}` })
        expect(session.tasks.every(task => !seen.includes(task.id))).toBe(true)
        for (const task of session.tasks) if (task.image) {
          expect(task.image.src).toMatch(/^\/Bilder\/exam-(preparation|simulation)\/sitov-.+\.webp$/)
          expect(existsSync(join(process.cwd(), 'public', task.image.src))).toBe(true)
        }
        const sources = new Set(session.tasks.filter(task => task.skill === 'listening').map(task => task.audioSource!.id))
        const heardStories = new Set(session.tasks.filter(task => task.skill === 'listening').map(task => task.scenarioId))
        expect(heardStories.size).toBe(4)
        const printedStories = session.tasks.filter(task => !task.audioSource).flatMap(task => task.sourceScenarioIds ?? [task.scenarioId])
        expect(printedStories.every(id => !heardStories.has(id))).toBe(true)
        for (const source of sources) expect(seenSources.has(source)).toBe(false)
        for (const source of sources) seenSources.add(source)
        seen.push(...session.tasks.map(task => task.id))
      }
      expect(seenSources.size).toBe(24)
      expect(() => buildSimulation({ level, provider: 'sitov', preparedAudio, previousTaskIds: seen, now })).toThrow('bereits bearbeitet')
    }
  })
  it('shuffles option positions while keeping keys private and matching answers consistent', () => {
    const positions = new Set<string>()
    for (let index = 0; index < 15; index++) {
      const session = start('B1', `sitov-choice-${index}`)
      const task = session.tasks.find(item => item.type === 'choice')!
      positions.add(task.correctAnswer as string)
      const updated = submitSimulationAnswer(session, task.id, task.correctAnswer!, now)
      expect(evaluateSimulation(updated).feedback.find(item => item.taskId === task.id)?.points).toBe(1)
    }
    expect(positions.size).toBe(3)
    const session = start(), task = session.tasks.find(item => item.type === 'matching')!, correct = task.correctAnswer as string[]
    const feedback = evaluateSimulation(submitSimulationAnswer(session, task.id, [correct[0], '', correct[2]], now)).feedback.find(item => item.taskId === task.id)!
    expect(feedback.points).toBe(2)
    expect(feedback.correct).toBe(false)
    expect(() => validateSimulationAnswer(task, [correct[0], correct[0], ''])).toThrow('mehrfach')
    expect(() => validateSimulationAnswer(task, [...correct, ''])).toThrow('zu viele')
  })
  it('provides real form fields with accurate, normalized partial scores', () => {
    const session = start('A1'), form = session.tasks.find(task => task.type === 'form')!, correct = form.correctAnswer as string[]
    expect(form.fields).toHaveLength(4)
    const values = [...correct]
    values[0] = `  ${values[0].toUpperCase()}  `
    values[3] = values[3].replace(/^0/, '').replace(':', '.') + ' Uhr'
    expect(evaluateSimulation(submitSimulationAnswer(session, form.id, values, now)).feedback.find(item => item.taskId === form.id)?.points).toBe(4)
    values[2] = ''
    expect(evaluateSimulation(submitSimulationAnswer(session, form.id, values, now)).feedback.find(item => item.taskId === form.id)?.points).toBe(3)
    expect(() => validateSimulationAnswer(form, [...values, 'extra'])).toThrow('Formularfelder')
    for (const time of ['08.00 Uhr', '08.00Uhr', '8:00', '8 Uhr']) expect(normalizeSimulationFormAnswer(time, 'sitov-time')).toBe('8:00')
    expect(normalizeSimulationFormAnswer('8.00 Uhr', 'Uhrzeit')).toBe('8:00')
    expect(normalizeSimulationFormAnswer('25:00', 'sitov-time')).toBe('25:00')
    expect(normalizeSimulationFormAnswer('8:99', 'Uhrzeit')).toBe('8:99')
  })
  it('requires explicit sequence answers and gives accurate partial ordering and true-false scores', () => {
    for (const [level, steps] of [['B2', 4], ['C1', 5], ['C2', 7]] as const) {
      const session = start(level), task = session.tasks.find(item => item.type === 'ordering')!, correct = task.correctAnswer as string[]
      expect(task.options).toHaveLength(steps)
      expect(task.maxPoints).toBe(steps)
      expect(session.answers[task.id]).toBeUndefined()
      expect(publicSimulation(session).answers[task.id]).toBeUndefined()
      expect(evaluateSimulation(session).feedback.find(item => item.taskId === task.id)?.points).toBe(0)
      const partial = Array<string>(steps).fill('')
      partial[1] = correct[1]
      const score = evaluateSimulation(submitSimulationAnswer(session, task.id, partial, now)).feedback.find(item => item.taskId === task.id)!
      expect(score.points).toBe(1)
      expect(score.correct).toBe(false)
      const full = evaluateSimulation(submitSimulationAnswer(session, task.id, correct, now)).feedback.find(item => item.taskId === task.id)!
      expect(full.points).toBe(steps)
      expect(full.correct).toBe(true)
      expect(full.expectedAnswer).toEqual(correct.map(id => task.options!.find(option => option.id === id)!.text))
      expect(() => validateSimulationAnswer(task, [correct[0], correct[0]])).toThrow('mehrfach')
      expect(() => validateSimulationAnswer(task, [...correct, ''])).toThrow('zu viele')
    }
    const session = start('A2'), task = session.tasks.find(item => item.type === 'true-false')!
    expect(evaluateSimulation(submitSimulationAnswer(session, task.id, task.correctAnswer!, now)).feedback.find(item => item.taskId === task.id)?.points).toBe(1)
    const wrong = task.correctAnswer === 'true' ? 'false' : 'true'
    expect(evaluateSimulation(submitSimulationAnswer(session, task.id, wrong, now)).feedback.find(item => item.taskId === task.id)?.points).toBe(0)
  })
  it('uses an allowlist so no keys, scripts, evidence, private rubric or future authoring fields escape active runs', () => {
    const session = start()
    ;(session.tasks[0] as unknown as Record<string, unknown>).secretAuthorNote = 'sitov-confidential'
    const payload = publicSimulation(session)
    expect(payload.result).toBeUndefined()
    for (const task of payload.tasks) for (const secret of ['correctAnswer', 'explanation', 'evidence', 'scenarioId', 'audioSource', 'provenance']) expect(task).not.toHaveProperty(secret)
    expect(payload).not.toHaveProperty('teacherReviews')
    expect(payload).not.toHaveProperty('rubric')
    expect(JSON.stringify(payload)).not.toContain('sitov-confidential')
    for (const source of SIMULATION_AUDIO_SOURCES) expect(JSON.stringify(payload)).not.toContain(source.script)
    const final = publicSimulation(finishSimulation(completeAnswers(session), now))
    expect(final.result?.feedback.some(task => task.expectedAnswer)).toBe(true)
    expect(final.tasks.every(task => !('correctAnswer' in task))).toBe(true)
  })
  it('preserves frozen snapshots and enforces owned-task choices and the authoritative deadline', () => {
    const session = start(), snapshot = JSON.stringify(session), task = session.tasks.find(item => item.correctAnswer !== undefined)!
    const updated = submitSimulationAnswer(session, task.id, task.correctAnswer!, now)
    expect(JSON.stringify(session)).toBe(snapshot)
    expect(updated.answers[task.id]).toEqual(task.correctAnswer)
    expect(() => submitSimulationAnswer(session, 'sitov-forged', 'a', now)).toThrow('nicht zu')
    expect(() => submitSimulationAnswer(session, task.id, 'forged', now)).toThrow('gültige')
    expect(() => submitSimulationAnswer(session, task.id, task.correctAnswer!, new Date(session.expiresAt))).toThrow('abgelaufen')
    expect(() => submitSimulationAnswer(finishSimulation(updated, now), task.id, task.correctAnswer!, now)).toThrow('abgeschlossen')
  })
  it('keeps writing and actual conversations pending teacher review and ignores client playback URLs', () => {
    let session = start()
    const writing = session.tasks.find(task => task.type === 'writing')!, speaking = session.tasks.find(task => task.type === 'speaking')!
    session = submitSimulationAnswer(session, writing.id, 'Ein eigener Text.', now)
    session = submitSimulationAnswer(session, speaking.id, { text: 'Nur ein Vorbereitungstext.', audioUrl: 'https://untrusted.example/file.mp3' }, now)
    expect(session.answers[speaking.id]).not.toHaveProperty('audioUrl')
    const finished = finishSimulation(session, now)
    expect(finished.result?.pendingTeacherTasks).toBe(1)
    expect(finished.result?.feedback.find(task => task.taskId === writing.id)?.points).toBeNull()
    expect(finished.result?.feedback.find(task => task.taskId === speaking.id)?.points).toBe(0)
    expect(finished.result?.examPass).toBe(false)
  })
  it('shows the definite A1 outcome while an actually submitted personal text still awaits review', () => {
    let session = start('A1')
    const reading = session.tasks.filter(task => task.skill === 'reading'), listening = session.tasks.filter(task => task.skill === 'listening')
    const form = session.tasks.find(task => task.type === 'form')!, writing = session.tasks.find(task => task.type === 'writing')!
    for (const task of [...reading.slice(0, 2), ...listening.slice(0, 3), form]) session = submitSimulationAnswer(session, task.id, task.correctAnswer!, now)
    session = submitSimulationAnswer(session, writing.id, 'Guten Tag, ich möchte am Samstag kommen. Bitte sagen Sie mir die Uhrzeit.', now)
    const result = finishSimulation(session, now).result!
    expect(result.skills.find(skill => skill.skill === 'reading')?.percentage).toBe(22.2)
    expect(result.skills.find(skill => skill.skill === 'listening')?.percentage).toBe(37.5)
    expect(result.skills.find(skill => skill.skill === 'speaking')?.percentage).toBe(0)
    expect(result.feedback.find(item => item.taskId === form.id)?.points).toBe(4)
    expect(result.feedback.find(item => item.taskId === writing.id)?.points).toBeNull()
    expect(result.pendingTeacherTasks).toBe(1)
    expect(result.status).toBe('not-passed')
    expect(result.examPass).toBe(false)
    expect(result.headline).toBe('Vor der Prüfung noch gezielt üben')
  })
  it.each(['closed-skill', 'missing-production', 'weak-reviewed-production'] as const)('prioritizes the known %s failure without dropping other pending reviews', failure => {
    let session = completeAnswers(start())
    if (failure === 'closed-skill') session = { ...session, answers: Object.fromEntries(Object.entries(session.answers).filter(([id]) => !session.tasks.some(task => task.id === id && task.skill === 'reading'))) }
    if (failure === 'missing-production') {
      const absent = session.tasks.find(task => task.type === 'speaking')!.id
      session = { ...session, answers: Object.fromEntries(Object.entries(session.answers).filter(([id]) => id !== absent)) }
    }
    session = finishSimulation(session, now)
    if (failure === 'weak-reviewed-production') {
      const task = session.tasks.find(item => item.type === 'writing')!
      session = reviewSimulationTask(session, task.id, { score: 9, maxPoints: task.maxPoints, comment: 'Inhaltspunkte fehlen; gezielt überarbeiten.', teacherId: 'sitov-teacher', reviewedAt: now.toISOString() })
    }
    expect(session.result?.pendingTeacherTasks).toBe(failure === 'closed-skill' ? 8 : 7)
    expect(session.result?.examPass).toBe(false)
    expect(session.result?.status).toBe('not-passed')
  })
  it('translates true-false feedback labels without changing literal free-text answers', () => {
    const session = start(), writing = session.tasks.find(task => task.type === 'writing')!, binary = session.tasks.find(task => task.type === 'true-false')!
    let updated = submitSimulationAnswer(session, writing.id, 'true', now)
    updated = submitSimulationAnswer(updated, binary.id, 'false', now)
    const feedback = finishSimulation(updated, now).result!.feedback
    expect(feedback.find(item => item.taskId === writing.id)?.answerText).toBe('true')
    expect(feedback.find(item => item.taskId === binary.id)?.answerText).toBe('Falsch')
    expect(feedback.find(item => item.taskId === binary.id)?.expectedAnswer).toMatch(/^(Richtig|Falsch)$/)
  })
  it('requires confirmed partner interaction for positive oral points but allows zero for an unsuitable monologue', () => {
    const session = finishSimulation(completeAnswers(start()), now), speaking = session.tasks.find(task => task.type === 'speaking')!
    const review = { score: 20, maxPoints: 20, comment: 'Gesprächskriterien prüfen.', teacherId: 'sitov-teacher', reviewedAt: now.toISOString() }
    expect(() => reviewSimulationTask(session, speaking.id, review)).toThrow('echtes Gespräch')
    const failed = reviewSimulationTask(session, speaking.id, { ...review, score: 0 })
    expect(failed.result?.feedback.find(item => item.taskId === speaking.id)?.points).toBe(0)
  })
  it('rechecks actual interaction when evaluating an inconsistent imported teacher review snapshot', () => {
    const reviewed = reviewAll(finishSimulation(completeAnswers(start()), now)), oral = reviewed.tasks.find(task => task.interactionRequired)!
    const inconsistent = { ...reviewed, teacherReviews: { ...reviewed.teacherReviews, [oral.id]: { ...reviewed.teacherReviews[oral.id], interactionConfirmed: false } } }
    const result = evaluateSimulation(inconsistent)
    expect(result.examPass).toBe(false)
    expect(result.feedback.find(feedback => feedback.taskId === oral.id)?.correct).toBe(false)
    expect(result.feedback.find(feedback => feedback.taskId === oral.id)?.explanation).toContain('Bestätigung einer echten Interaktion')
  })
  it('passes only after every productive task is reviewed and all Sitov thresholds are reached', () => {
    for (const level of SIMULATION_LEVELS) {
      const session = finishSimulation(completeAnswers(start(level)), now)
      expect(session.result?.status).toBe('teacher-review-required')
      expect(session.result?.examPass).toBeNull()
      const reviewed = reviewAll(session)
      expect(reviewed.result?.percentage).toBe(100)
      expect(reviewed.result?.status).toBe('passed')
      expect(reviewed.result?.examPass).toBe(true)
      expect(session.result?.examPass).toBeNull()
      expect(reviewed.result?.description).toContain('garantiert')
    }
  })
  it('fails a missing or below-50% productive task even when that skill remains above 70%', () => {
    const active = start(), speaking = active.tasks.find(task => task.type === 'speaking')!
    const missing = reviewAll(finishSimulation(completeAnswers(active, speaking.id), now))
    expect(missing.result?.pendingTeacherTasks).toBe(0)
    expect(missing.result?.skills.find(skill => skill.skill === 'speaking')?.percentage).toBe(80)
    expect(missing.result?.examPass).toBe(false)
    const weak = reviewAll(finishSimulation(completeAnswers(active), now), { [speaking.id]: 9 })
    expect(weak.result?.skills.find(skill => skill.skill === 'speaking')?.percentage).toBe(89)
    expect(weak.result?.examPass).toBe(false)
  })
  it('does not round a subthreshold raw score up to passing and rejects incomplete snapshot coverage', () => {
    const active = start(), writing = active.tasks.filter(task => task.type === 'writing')
    const reviewed = reviewAll(finishSimulation(completeAnswers(active), now), Object.fromEntries(writing.map(task => [task.id, 13.9])))
    expect(reviewed.result?.skills.find(skill => skill.skill === 'writing')?.percentage).toBe(69.5)
    expect(reviewed.result?.examPass).toBe(false)
    expect(reviewed.result?.nextSteps.some(step => step.startsWith('Schreiben:'))).toBe(true)
    const corrupted = { ...reviewed, tasks: reviewed.tasks.filter(task => task.family !== 'listening-opinion') }
    expect(evaluateSimulation(corrupted).examPass).toBeNull()
  })
})

describe('content corpus and versioned authoring', () => {
  it('keeps oral instructions focused and retains the shared real-dialogue criteria for every task', () => {
    const oral = SIMULATION_TASK_POOL.filter(task => task.type === 'speaking')
    expect(oral).toHaveLength(372)
    for (const task of oral) {
      expect(task.interactionRequired).toBe(true)
      expect(task.instruction).not.toMatch(/Aufnahme|aufnehmen|Nehmen Sie|geschriebene Vorbereitung|schriftliche Notizen|Beide Stimmen/)
      expect(task.criteria).toEqual(expect.arrayContaining([
        'Beide Gesprächspartner müssen in der Aufnahme hörbar sein.',
        'Mindestens zwei Rückfragen verständlich beantworten.',
        'Auf Vorschläge reagieren und bei Planungsaufgaben gemeinsam entscheiden.',
        'Schriftliche Notizen oder ein allein gesprochener Text ersetzen keine echte Gesprächsaufnahme.',
      ]))
    }
    for (const task of oral.filter(item => item.family === 'speaking-experience')) expect(task.instruction).toContain('Beschreiben Sie das Bild.')
  })
  it('has 144 distinct audio sources and 1,519 distinct task variants with stable sitov IDs', () => {
    expect(SIMULATION_TASK_POOL).toHaveLength(1519)
    const levelCounts = { A1: 252, A2: 228, B1: 259, B2: 252, C1: 258, C2: 270 }
    for (const level of SIMULATION_LEVELS) expect(SIMULATION_TASK_POOL.filter(task => task.level === level)).toHaveLength(levelCounts[level])
    expect(SIMULATION_AUDIO_SOURCES).toHaveLength(144)
    expect(new Set(SIMULATION_TASK_POOL.map(task => task.id)).size).toBe(SIMULATION_TASK_POOL.length)
    for (const task of SIMULATION_TASK_POOL) {
      expect(task.id).toMatch(/^sitov-/)
      expect(task.version).toBe(1)
      expect(task.instruction.trim()).not.toBe('')
      expect(task.provenance).toContain('Sitov Academy')
      expect(task.skill !== 'listening' || Boolean(task.audioSource?.script)).toBe(true)
    }
    for (const level of SIMULATION_LEVELS) {
      const hearing = SIMULATION_TASK_POOL.filter(task => task.level === level && task.skill === 'listening' && task.id.endsWith('-global'))
      expect(hearing).toHaveLength(24)
      for (const family of new Set(hearing.map(task => task.family))) expect(hearing.filter(task => task.family === family)).toHaveLength(6)
    }
    const a1 = SIMULATION_TASK_POOL.find(task => task.id === 'sitov-simulation-a1-fahrrad-reading-detail')!, c2 = SIMULATION_TASK_POOL.find(task => task.id === 'sitov-simulation-c2-fahrrad-reading-detail')!
    expect(c2.options).not.toEqual(a1.options)
    expect(c2.title).toBe('Eine Schlussfolgerung beurteilen')
    expect(c2.text!.split(/\s+/).length).toBeGreaterThanOrEqual(500)
  })
})
