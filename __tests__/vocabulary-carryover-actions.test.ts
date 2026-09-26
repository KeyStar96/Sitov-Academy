import { vocabularyDatabaseRow } from './fixtures/learning-catalog'
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))

import { createClient } from '@/utils/supabase/server'
import { beginVocabularyLevel, checkVocabularyRetry, getPhaseCards, getVocabularyCarryover, getVocabularyOverview,
  getVocabularySession, setVocabularyCarryover, submitVocabularyAnswer, submitVocabularySelfRating } from '@/app/actions/vocabulary'
import { readCarryoverCatalog } from '@/lib/vocabulary-carryover-server'
import type { VocabularyCardRow } from '@/lib/types/vocabulary'

const userId = '00000000-0000-4000-8000-000000000001'
const otherId = '00000000-0000-4000-8000-000000000002'
const requestId = '00000000-0000-4000-8000-000000000003'
const uuid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const target = 'A2.1'
function card(n: number, level: string, own = false): VocabularyCardRow {
  return { id: uuid(n), unit_id: uuid(n + 100), word_de: `Wort ${n}`, lesson: own ? 'Eigene Wörter' : `Lektion ${n}`, level,
    article: null, plural: null, created_at: null, image_url: null, audio_url: null, is_own: own,
    is_hard_for_ru: false, is_hard_for_tr: false, sentence_practice: false, alternative_answers_de: [],
    translation_en: 'word', translation_ru: 'слово', translation_uk: 'слово', translation_tr: 'kelime',
    context_sentence_de: null, context_sentence_en: null, context_sentence_ru: null, context_sentence_uk: null, context_sentence_tr: null }
}
const ownCard = card(1, target)
const source = card(2, 'A1.1')
const ownSource = card(3, 'A1.2', true)
function progress(c: VocabularyCardRow, boxes = [3, 4], actor = userId) {
  return boxes.map((box_number, index) => ({ id: uuid(Number(c.id.slice(-12)) * 10 + index), auth_user_id: actor,
    card_id: c.id, direction: index ? 'native_to_de' : 'de_to_native', box_number,
    next_review_date: '2020-01-01T00:00:00.000Z' }))
}
const receipt = { success: true, isCorrect: true, correctAnswer: 'Wort', isAlternative: false, softError: null,
  previousPhase: 3, newPhase: 4, becameLearned: false, movedBack: false, intervalInDays: 7 }

function setup(options: { enabled?: boolean; locked?: boolean; sourceCards?: VocabularyCardRow[];
  sourceProgress?: ReturnType<typeof progress>; rpcFailure?: string; paused?: string[]; signedIn?: boolean } = {}) {
  const sourceCards = options.sourceCards ?? [source, ownSource]
  const sourceProgress = options.sourceProgress ?? sourceCards.flatMap(c => progress(c))
  const state = { success: true as const, targetLevel: target, enabled: options.enabled ?? true,
    decidedAt: null as string | null, startedAt: null as string | null, promptRequired: false,
    cards: sourceCards.map(c => ({ cardId: c.id, originLevel: c.level })) }
  const rpc = jest.fn(async (name: string, args: Record<string, unknown>) => {
    if (options.rpcFailure === name) return { data: { error: 'access_denied', message: 'Denied', sqlstate: 'PT403' }, error: null }
    if (name === 'get_vocabulary_carryover') return { data: { ...state }, error: null }
    if (name === 'begin_vocabulary_level') {
      state.startedAt ??= '2026-09-26T10:00:00Z'
      if (!state.cards.length) state.decidedAt ??= state.startedAt
      state.promptRequired = !!state.cards.length && !state.decidedAt
      return { data: { ...state }, error: null }
    }
    if (name === 'set_vocabulary_carryover') {
      state.enabled = args.p_enabled as boolean
      state.decidedAt = '2026-09-26T10:01:00Z'
      state.promptRequired = false
      return { data: { ...state }, error: null }
    }
    if (name === 'get_vocabulary_carryover_cards') {
      const offset = args.p_offset as number
      const page = sourceCards.slice(offset, offset + 500)
      return { data: { success: true, cards: page.map(c => ({ ...vocabularyDatabaseRow(c),
        unit: { ...vocabularyDatabaseRow(c).unit, owner_auth_user_id: c.is_own ? userId : null } })),
        progress: sourceProgress.filter(row => page.some(c => c.id === row.card_id)) }, error: null }
    }
    return { data: receipt, error: null }
  })
  function chain(data: unknown) {
    const result = { data, error: null }
    const q = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(), lt: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue(result), single: jest.fn().mockResolvedValue(result), maybeSingle: jest.fn().mockResolvedValue(result),
      then: Promise.resolve(result).then.bind(Promise.resolve(result)) }
    return q
  }
  const from = jest.fn((table: string) => {
    if (table === 'profiles') return chain({ role: 'student', native_language: 'ru', ui_language: 'ru',
      // Earlier source levels deliberately have no entitlement anymore.
      level_access: options.locked ? [] : [{ level: target }] })
    if (table === 'learning_trainer_grants') return chain([])
    if (table === 'vocabulary_learning_state') return chain({ last_card_id: null })
    if (table === 'vocabulary_lesson_pauses') return chain((options.paused ?? []).map(unit_id => ({ unit_id })))
    if (table === 'learning_vocabulary_cards') return chain([vocabularyDatabaseRow(ownCard)])
    return chain(progress(ownCard, [1, 1]))
  })
  const client = { from, rpc, auth: { getUser: jest.fn().mockResolvedValue({ data: { user: options.signedIn === false ? null : { id: userId } }, error: null }) } }
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  return { rpc, from, state, client }
}
beforeEach(() => jest.clearAllMocks())

it('keeps original progress IDs, compartments and origin levels in the target session after source access expires', async () => {
  setup()
  const result = await getVocabularySession(target, 'ru')
  expect(result.cards).toHaveLength(6)
  expect(result.cards).toEqual(expect.arrayContaining([
    expect.objectContaining({ progressId: progress(source)[0].id, box: 3, targetLevel: target, originLevel: 'A1.1', card: expect.objectContaining({ id: source.id, level: 'A1.1' }) }),
    expect.objectContaining({ progressId: progress(ownSource)[1].id, box: 4, targetLevel: target, originLevel: 'A1.2' }),
  ]))
})

it('counts carried boxes and due directions separately from own lessons and target progress', async () => {
  setup()
  const result = await getVocabularyOverview(target)
  expect(result.stats).toHaveLength(1)
  expect(result.stats[0]).toMatchObject({ lesson: ownCard.lesson, total: 1 })
  expect(result.ownBox).toMatchObject({ total: 1, inPhases: 1, percent: 14 })
  expect(result.box).toMatchObject({ total: 3, inPhases: 3, percent: 14 })
  expect(result.dueCards).toBe(6)
  expect(result.carryover).toMatchObject({ total: 2, byLevel: [
    { level: 'A1.1', total: 1, box: { inPhases: 1 } }, { level: 'A1.2', total: 1, box: { inPhases: 1 } },
  ] })
  expect(result.box.buckets.find(bucket => bucket.key === 3)?.count).toBe(2)
  const phase = await getPhaseCards(3, target, 'ru')
  expect(phase.cards.map(c => c.originLevel)).toEqual(['A1.1', 'A1.2'])
  expect(phase.cards.every(c => c.phase === 3 && c.isHalfKnown)).toBe(true)
})

it('keeps disabled candidates visible in the station but removes them from boxes, due queues and inspector', async () => {
  setup({ enabled: false })
  const overview = await getVocabularyOverview(target)
  expect(overview.carryover).toMatchObject({ enabled: false, total: 2 })
  expect(overview.box.total).toBe(1)
  expect(overview.dueCards).toBe(2)
  const session = await getVocabularySession(target, 'ru')
  expect(session.cards).toHaveLength(1)
  expect(session.deferredCount).toBe(1)
  expect(session.cards[0].card.id).toBe(ownCard.id)
  expect((await getPhaseCards(3, target, 'ru')).cards).toEqual([])
})

it('does not schedule future reviews and retains the existing compartment for an interrupted assessment', async () => {
  const rows = progress(source, [5])
  rows[0].next_review_date = '2099-01-01T00:00:00Z'
  setup({ sourceCards: [source], sourceProgress: rows })
  const overview = await getVocabularyOverview(target)
  expect(overview.carryover?.total).toBe(1)
  expect(overview.carryover?.byLevel[0].box.buckets.find(bucket => bucket.key === 5)?.count).toBe(1)
  expect(overview.dueCards).toBe(2)
  const session = await getVocabularySession(target, 'ru')
  expect(session.cards).toHaveLength(1)
  expect(session.deferredCount).toBe(1)
  expect(session.cards[0].card.id).toBe(ownCard.id)
})

it('does not count or schedule foreign progress accidentally included in an RPC payload', async () => {
  setup({ sourceCards: [source], sourceProgress: progress(source, [3, 3], otherId) })
  expect((await getVocabularyOverview(target)).carryover?.total).toBe(0)
  const session = await getVocabularySession(target, 'ru')
  expect(session.cards).toHaveLength(1)
  expect(session.deferredCount).toBe(1)
  expect(session.cards[0].card.id).toBe(ownCard.id)
})

it('fails explicitly when carryover cannot be loaded, instead of declaring the queue empty', async () => {
  setup({ rpcFailure: 'get_vocabulary_carryover' })
  await expect(getVocabularyOverview(target)).rejects.toThrow('vocabulary_carryover_unavailable')
  await expect(getVocabularySession(target, 'ru')).rejects.toThrow('vocabulary_carryover_unavailable')
})

it('begins only through the explicit action and persists accept/decline for subsequent starts', async () => {
  const { rpc } = setup({ enabled: false })
  await getVocabularyOverview(target)
  expect(rpc).not.toHaveBeenCalledWith('begin_vocabulary_level', expect.anything())
  expect(await beginVocabularyLevel(target, userId)).toMatchObject({ success: true, carryover: { promptRequired: true, total: 2 } })
  expect(await setVocabularyCarryover(target, false, userId)).toMatchObject({ success: true, carryover: { enabled: false, promptRequired: false } })
  expect(await beginVocabularyLevel(target, userId)).toMatchObject({ success: true, carryover: { promptRequired: false } })
  expect(await setVocabularyCarryover(target, true, userId)).toMatchObject({ success: true, carryover: { enabled: true } })
})

it('blocks locked targets, account changes, malformed switches and failed DB decisions', async () => {
  const { rpc } = setup({ locked: true })
  expect(await beginVocabularyLevel(target)).toEqual({ success: false, error: 'save_failed' })
  expect(rpc).not.toHaveBeenCalled()
  setup()
  expect(await setVocabularyCarryover(target, true, otherId)).toEqual({ success: false, error: 'save_failed' })
  expect(await setVocabularyCarryover(target, 'yes' as unknown as boolean)).toEqual({ success: false, error: 'invalid_input' })
  expect(await beginVocabularyLevel('')).toEqual({ success: false, error: 'invalid_input' })
  setup({ rpcFailure: 'set_vocabulary_carryover' })
  expect(await setVocabularyCarryover(target, true)).toEqual({ success: false, error: 'save_failed' })
})

it('passes the chosen target into every grading and retry RPC, including idempotent writes', async () => {
  const { rpc } = setup()
  const input = { progressId: progress(source)[0].id, targetLevel: target, expectedLearnerId: userId, typedAnswer: 'Wort', uiLanguage: 'ru' }
  await submitVocabularyAnswer(input)
  await submitVocabularyAnswer({ ...input, requestId })
  await submitVocabularySelfRating({ ...input, requestId, known: true })
  await checkVocabularyRetry(input)
  for (const name of ['submit_vocabulary_answer', 'submit_vocabulary_answer_once', 'submit_vocabulary_self_rating_once', 'check_vocabulary_retry']) {
    expect(rpc).toHaveBeenCalledWith(name, expect.objectContaining({ p_target_level: target, p_progress_id: input.progressId }))
  }
})

it('reads every catalog page beyond PostgREST default page sizes without duplicating rows', async () => {
  const cards = Array.from({ length: 501 }, (_, index) => card(index + 1000, 'A1.1'))
  const { client, state, rpc } = setup({ sourceCards: cards })
  const result = await readCarryoverCatalog(client as unknown as Awaited<ReturnType<typeof createClient>>, state, userId)
  expect(result.cards).toHaveLength(501)
  expect(result.progress).toHaveLength(1002)
  expect(rpc).toHaveBeenCalledWith('get_vocabulary_carryover_cards', { p_target_level: target, p_offset: 500, p_limit: 500 })
})

it('returns the candidate summary through the dedicated station read action', async () => {
  setup({ enabled: false })
  expect(await getVocabularyCarryover(target)).toMatchObject({ targetLevel: target, enabled: false, total: 2 })
})
