import {
  SITOV_PRONUNCIATION_PRETEST_POLICY as policy,
  sitovPronunciationPretestRequiredCorrect as required,
  sitovPronunciationPretestTaskSchema as taskSchema,
  sitovPronunciationPretestAttemptSchema as attemptSchema,
  sitovPronunciationPretestAttemptWithTasksSchema as openSchema,
  sitovPronunciationPretestCompletedAttemptSchema as completedSchema,
  sitovPronunciationPretestCatalogSchema as catalogSchema,
  sitovPronunciationPretestResultSchema as resultSchema,
  sitovPronunciationPretestProofSchema as proofSchema,
  sitovPronunciationPretestUploadTicketSchema as ticketSchema,
  sitovPronunciationPretestPoolSchema as poolSchema,
  sitovPronunciationPretestLearningLinkSchema as linkSchema,
  sitovPronunciationPretestStartInputSchema as startSchema,
  sitovPronunciationPretestAnswersInputSchema as answersSchema,
  sitovPronunciationPretestActionResultSchema as actionSchema,
} from '@/lib/sitov-pronunciation-pretest-contract'

const textId = '00000000-0000-4000-8000-000000000001'
const attemptId = '00000000-0000-4000-8000-000000000002'
const otherId = '00000000-0000-4000-8000-000000000003'
const version = 'a'.repeat(64), testVersion = 'b'.repeat(64)
const time = '2026-10-08T21:00:00Z'
function task(index = 0, core = 'sitov.vocabulary') {
  return { id: `sitov.q${index}`, competencyId: core, kind: 'single_choice' as const,
    promptDe: `Was bedeutet „Tasse“ in Situation ${index + 1}?`, fragmentDe: null,
    options: [{ id: 'sitov.opt1', textDe: 'Ein Gefäß zum Trinken.' }, { id: 'sitov.opt2', textDe: 'Ein Möbelstück zum Sitzen.' }, { id: 'sitov.opt3', textDe: 'Ein Weg zur Schule.' }] }
}
function attempt() {
  return { id: attemptId, textId, textVersion: version, testVersion, status: 'in_progress' as string,
    revision: 0, startedAt: time, updatedAt: time, questionIds: [0, 1, 2].map(i => `sitov.q${i}`),
    answers: {} as Record<string, string>, answeredCount: 0, totalCount: 3 }
}
function proof() {
  return { id: otherId, textId, textVersion: version, testVersion, passedAttemptId: attemptId, passedAt: time, compatibilityId: null }
}
function result(corrects = [3, 3, 2, 1]) {
  const competencies = corrects.map((correct, i) => ({ id: `sitov.core${i}`, correct, total: 3, required: 2, met: correct >= 2 }))
  const correct = corrects.reduce((sum, value) => sum + value, 0)
  const passed = correct >= 9 && competencies.every(core => core.met)
  return { attemptId, textId, textVersion: version, testVersion, passed, correct, total: 12,
    competencies, failedCompetencyIds: competencies.filter(core => !core.met).map(core => core.id), learningLinks: [], proof: passed ? proof() : null }
}
function entry() {
  return { textId, unitId: textId, level: 'A1.1', title: 'Mein Frühstück', focus: 'ü', kind: 'regular',
    textVersion: version, testVersion, status: 'available', lockedReason: null, attempt: null, proof: null, target: 'pretest' }
}

describe('Sitov Academy pretest public transport contract', () => {
  it.each([[3, 2, 3], [4, 3, 3], [5, 4, 4], [12, 8, 9], [15, 10, 12], [18, 12, 14]])('uses exact integer policy for %i items', (total, core, aggregate) => {
    expect(required(total, 'core')).toBe(core); expect(required(total, 'total')).toBe(aggregate)
  })
  it.each([0, -1, 1.5, NaN, Infinity, 1001, Number.MAX_SAFE_INTEGER])('rejects invalid question count %s', total => {
    expect(() => required(total, 'total')).toThrow(RangeError)
  })
  it('exposes frozen policy metadata without an answer grader or unlock helper', () => {
    expect(Object.isFrozen(policy)).toBe(true); expect(policy.minimumCoreQuestions).toBe(3); expect(policy.minimumPoolQuestions).toBe(6)
  })
  it('rejects secret fields rather than serializing keys or target bodies', () => {
    for (const field of ['correctOptionId', 'solution', 'pool', 'evidence', 'sentence_de', 'audioUrl']) {
      expect(taskSchema.safeParse({ ...task(), [field]: 'secret' }).success).toBe(false)
      expect(catalogSchema.safeParse([{ ...entry(), [field]: 'secret' }]).success).toBe(false)
    }
    expect(Object.keys(taskSchema.parse(task()))).toEqual(['id', 'competencyId', 'kind', 'promptDe', 'fragmentDe', 'options'])
    expect(taskSchema.safeParse({ ...task(), options: task().options.map(option => ({ ...option, correct: false })) }).success).toBe(false)
  })
  it('rejects duplicated IDs/options, malformed text/version/clock data and forbidden account/score input', () => {
    expect(taskSchema.safeParse({ ...task(), options: [task().options[0], task().options[0], task().options[2]] }).success).toBe(false)
    expect(taskSchema.safeParse({ ...task(), promptDe: ' ' }).success).toBe(false)
    for (const change of [{ textId: 'foreign' }, { testVersion: version.slice(1) }, { textVersion: version.toUpperCase() }, { updatedAt: '2026-10-07T00:00:00Z' }, { revision: -1 }]) expect(attemptSchema.safeParse({ ...attempt(), ...change }).success).toBe(false)
    expect(startSchema.safeParse({ textId, requestId: otherId }).success).toBe(true)
    for (const field of ['studentId', 'score', 'passed', 'textVersion']) expect(startSchema.safeParse({ textId, requestId: otherId, [field]: 'forged' }).success).toBe(false)
    expect(answersSchema.safeParse({ attemptId, requestId: otherId, revision: 0, answers: {}, score: 100 }).success).toBe(false)
  })
  it('requires persisted question/answer counts and rejects foreign questions and options on resume', () => {
    const data = { attempt: attempt(), tasks: [0, 1, 2].map(i => task(i)) }
    expect(openSchema.safeParse(data).success).toBe(true)
    expect(attemptSchema.safeParse({ ...attempt(), questionIds: ['sitov.q0', 'sitov.q0', 'sitov.q2'] }).success).toBe(false)
    expect(attemptSchema.safeParse({ ...attempt(), answers: { 'sitov.foreign': 'sitov.opt1' }, answeredCount: 1 }).success).toBe(false)
    expect(openSchema.safeParse({ ...data, tasks: [task(1), task(0), task(2)] }).success).toBe(false)
    expect(openSchema.safeParse({ ...data, attempt: { ...attempt(), answers: { 'sitov.q0': 'sitov.unknown' }, answeredCount: 1 } }).success).toBe(false)
    expect(openSchema.safeParse({ ...data, tasks: [task(0), task(1), task(2, 'sitov.syntax')] }).success).toBe(false)
    expect(attemptSchema.safeParse({ ...attempt(), status: 'passed' }).success).toBe(false)
  })
  it('validates both core and aggregate persisted outcomes without allowing missing-core passage', () => {
    expect(resultSchema.safeParse(result([3, 3, 2, 1])).success).toBe(true)
    expect(resultSchema.safeParse({ ...result([3, 3, 2, 1]), passed: true, proof: proof() }).success).toBe(false)
    expect(resultSchema.safeParse(result([2, 2, 2, 2])).success).toBe(true)
    expect(resultSchema.safeParse({ ...result([2, 2, 2, 2]), passed: true, proof: proof() }).success).toBe(false)
    expect(resultSchema.safeParse(result([3, 2, 2, 2])).success).toBe(true)
    for (const change of [{ correct: 100 }, { total: 0 }, { total: 1001 }, { failedCompetencyIds: [] }, { proof: proof() }]) {
      expect(() => resultSchema.safeParse({ ...result(), ...change })).not.toThrow()
      expect(resultSchema.safeParse({ ...result(), ...change }).success).toBe(false)
    }
    expect(resultSchema.safeParse({ ...result(), failedCompetencyIds: [] }).success).toBe(false)
  })
  it('rejects foreign proof text/attempt/version and does not permit compatibility migration', () => {
    for (const change of [{ textId: otherId }, { passedAttemptId: otherId }, { testVersion: version }, { textVersion: testVersion }]) expect(resultSchema.safeParse({ ...result([3, 3, 3, 3]), proof: { ...proof(), ...change } }).success).toBe(false)
    expect(proofSchema.safeParse({ ...proof(), compatibilityId: textId }).success).toBe(false)
    const done = { ...attempt(), status: 'passed', answers: { 'sitov.q0': 'sitov.opt1', 'sitov.q1': 'sitov.opt1', 'sitov.q2': 'sitov.opt1' }, answeredCount: 3 }
    const single = { ...result([3]), total: 3, correct: 3, passed: true, proof: proof() }
    expect(completedSchema.safeParse({ attempt: done, result: single }).success).toBe(true)
    expect(completedSchema.safeParse({ attempt: { ...done, id: otherId }, result: single }).success).toBe(false)
    expect(completedSchema.safeParse({ attempt: { ...attempt(), status: 'outdated' }, result: null }).success).toBe(true)
  })
  it('keeps locked/available/in-progress/failed/passed catalog states consistent', () => {
    expect(catalogSchema.safeParse([entry()]).success).toBe(true)
    expect(catalogSchema.safeParse([{ ...entry(), status: 'locked', testVersion: null, lockedReason: 'authoring_not_ready', target: null }]).success).toBe(true)
    expect(catalogSchema.safeParse([{ ...entry(), status: 'in_progress', attempt: attempt(), target: 'resume_pretest' }]).success).toBe(true)
    expect(catalogSchema.safeParse([entry(), entry()]).success).toBe(false)
    for (const change of [{ proof: proof() }, { status: 'passed', target: 'pronunciation' }, { target: 'pronunciation' }, { lockedReason: 'version_changed' }]) expect(catalogSchema.safeParse([{ ...entry(), ...change }]).success).toBe(false)
    expect(catalogSchema.safeParse([{ ...entry(), status: 'in_progress', target: 'resume_pretest', attempt: { ...attempt(), textId: otherId } }]).success).toBe(false)
    expect(catalogSchema.safeParse([{ ...entry(), status: 'in_progress', target: 'resume_pretest', attempt: { ...attempt(), textVersion: testVersion } }]).success).toBe(false)
  })
  it('requires two structurally complete retry forms per declared essential competence', () => {
    const pool = { policyId: policy.id, competencies: [{ id: 'sitov.vocabulary', itemsPerAttempt: 3 }], tasks: Array.from({ length: 6 }, (_, i) => task(i)) }
    expect(poolSchema.safeParse(pool).success).toBe(true)
    expect(poolSchema.safeParse({ ...pool, tasks: pool.tasks.slice(0, 5) }).success).toBe(false)
    expect(poolSchema.safeParse({ ...pool, competencies: [{ id: 'sitov.vocabulary', itemsPerAttempt: 4 }] }).success).toBe(false)
    expect(poolSchema.safeParse({ ...pool, tasks: [task(0, 'sitov.syntax'), ...pool.tasks.slice(1)] }).success).toBe(false)
    expect(poolSchema.safeParse({ ...pool, tasks: [task(1), ...pool.tasks.slice(1)] }).success).toBe(false)
    expect(poolSchema.safeParse({ ...pool, policyId: 'sitov.unapproved' }).success).toBe(false)
  })
  it.each(['de', 'en', 'ru', 'uk', 'tr'])('accepts actual existing remediation routes in %s and rejects foreign/unsafe links', lang => {
    const link = { kind: 'learning_path', level: 'A1.1', targetId: 'sitov.node', href: `/${lang}/dashboard/level/A1.1/path?node=sitov.node` }
    expect(linkSchema.safeParse(link).success).toBe(true)
    for (const href of ['https://example.test/path', '//example.test/path', `/${lang}/dashboard/level/A1.2/path`, `/${lang}/dashboard/level/A1.1/verbs`, `/${lang}/dashboard/level/A1.1/path/%zz`, `/${lang}/dashboard/level/A1.1/path/../verbs`, `/${lang}/dashboard/level/A1.1/path/%2e%2e/verbs`]) expect(linkSchema.safeParse({ ...link, href }).success).toBe(false)
  })
  it('parses explicit stable action results without raw errors or extra server data', () => {
    const schema = actionSchema(catalogSchema)
    expect(schema.safeParse({ ok: true, data: [entry()] }).success).toBe(true)
    expect(schema.safeParse({ ok: false, error: 'retryable_failure', retryable: true }).success).toBe(true)
    expect(schema.safeParse({ ok: false, error: 'unknown', retryable: false }).success).toBe(false)
    expect(schema.safeParse({ ok: false, error: 'not_found', retryable: false, sql: 'secret' }).success).toBe(false)
  })
  it('accepts only immutable upload paths, never public URLs or traversal paths', () => {
    const ticket = { ticketId: otherId, textVersion: version, expiresAt: time, path: `${textId}/${otherId}.webm` }
    expect(ticketSchema.safeParse(ticket).success).toBe(true)
    for (const path of [`https://example.test/${ticket.path}`, `storage://pronunciation_audio/${ticket.path}`, `${textId}/../${otherId}.webm`, `${ticket.path}.exe`]) expect(ticketSchema.safeParse({ ...ticket, path }).success).toBe(false)
    expect(ticketSchema.safeParse({ ...ticket, studentId: textId }).success).toBe(false)
  })
})
