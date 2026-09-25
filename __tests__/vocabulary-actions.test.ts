import { vocabularyDatabaseRow } from './fixtures/learning-catalog'
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))

import { createClient } from '@/utils/supabase/server'
import { getVocabularySession, submitVocabularyAnswer, submitLessonAssessment, skipVocabularyAssessment } from '@/app/actions/vocabulary'
import type { SubmitVocabularyAnswerInput, VocabularyCardRow } from '@/lib/types/vocabulary'

const userId = '00000000-0000-4000-8000-000000000001'
const progressId = '10000000-0000-4000-8000-000000000001'
const requestId = '20000000-0000-4000-8000-000000000001'
const card: VocabularyCardRow = {
  unit_id: '00000000-0000-4000-8000-000000000099',
  id: '30000000-0000-4000-8000-000000000001', word_de: 'Tür', lesson: 'Lektion 1', level: 'A1.1',
  article: 'die', plural: 'Türen', created_at: null, image_url: null, audio_url: null,
  is_hard_for_ru: false, is_hard_for_tr: false, sentence_practice: true, alternative_answers_de: [],
  translation_en: 'door', translation_ru: 'дверь', translation_uk: 'двері', translation_tr: 'kapı',
  context_sentence_de: 'Ich öffne die Tür.', context_sentence_en: 'I open the door.',
  context_sentence_ru: 'Я открываю дверь.', context_sentence_uk: 'Я відчиняю двері.', context_sentence_tr: 'Kapıyı açıyorum.',
}
const review = {
  success: true, isCorrect: true, correctAnswer: card.context_sentence_de, isAlternative: false, softError: null,
  previousPhase: 1, newPhase: 2, becameLearned: false, movedBack: false, intervalInDays: 1,
}

function session(options: {
  card?: VocabularyCardRow; nativeLanguage?: string; uiLanguage?: string;
  direction?: string; signedIn?: boolean; previousCardId?: string | null; actorId?: string
  pausedUnits?: string[] | 'missing'
} = {}) {
  const profile = {
    role: 'student', level_access: [{ level: 'A1.1' }], native_language: options.nativeLanguage ?? 'ru',
    ui_language: options.uiLanguage ?? 'ru',
  }
  const rows = [{
    id: progressId, auth_user_id: userId, card_id: (options.card ?? card).id,
    direction: options.direction ?? 'native_to_de', box_number: 1,
  }]
  const progress = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), lte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), range: jest.fn().mockResolvedValue({ data: rows, error: null }),
  }
  const profileChain = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: profile, error: null }),
  }
  const cursor = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { last_card_id: options.previousCardId ?? null }, error: null }),
  }
  let locales: string[] | undefined
  const cards = { select: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), range: jest.fn(async () => {
    const row = vocabularyDatabaseRow(options.card ?? card)
    return { data: [{ ...row, translations: row.translations.filter(item => !locales || locales.includes(item.locale)) }], error: null }
  }) }
  cards.in.mockImplementation((_column: string, values: string[]) => { locales = values; return cards })
  const rulesResult = Promise.resolve({ data: [], error: null })
  const rules = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: rulesResult.then.bind(rulesResult) }
  // Migration 25: im Lernweg ausgeschaltete Lektionen. „missing" spielt eine App
  // vor der Migration nach (Tabelle unbekannt).
  const pausesResult = Promise.resolve(options.pausedUnits === 'missing'
    ? { data: null, error: { code: 'PGRST205', message: 'missing' } }
    : { data: (options.pausedUnits ?? []).map(unit_id => ({ unit_id })), error: null })
  const pauses = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: pausesResult.then.bind(pausesResult) }
  const from = jest.fn((table: string) => table === 'profiles' ? profileChain : table === 'learning_trainer_grants' ? rules : table === 'learning_vocabulary_cards' ? cards : table === 'vocabulary_learning_state' ? cursor : table === 'vocabulary_lesson_pauses' ? pauses : progress)
  const rpc = jest.fn().mockResolvedValue({ data: review, error: null })
  const client = {
    from, rpc, auth: { getUser: jest.fn().mockResolvedValue({ data: { user: options.signedIn === false ? null : { id: options.actorId ?? userId } }, error: null }) },
  }
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  return { from, rpc, progress, cursor, cards }
}

beforeEach(() => jest.clearAllMocks())

describe('session DTO source language', () => {
  it('keeps native-language difficulty and UI sentences after limiting embedded translations', async () => {
    const { cards } = session({ nativeLanguage: 'tr', uiLanguage: 'ru', card: { ...card, is_hard_for_tr: true } })
    const result = await getVocabularySession('A1.1', 'ru')
    expect(cards.in).toHaveBeenCalledWith('translations.locale', ['de', 'ru', 'tr'])
    expect(result.cards[0]).toMatchObject({ promptLanguage: 'ru', prompt: card.context_sentence_ru, isHardForNativeLanguage: true })
  })
  it('blocks German UI instead of silently substituting the native language', async () => {
    const { progress } = session({ nativeLanguage: 'tr', uiLanguage: 'de' })
    expect((await getVocabularySession('A1.1', 'de')).cards).toEqual([])
    expect(progress.range).not.toHaveBeenCalled()
    expect((await getVocabularySession('A1.1', 'tr')).cards).toEqual([])
  })
  it.each(['en', 'ru', 'uk', 'tr'] as const)('returns the exact %s UI sentence regardless of profile preferences', async language => {
    session({ nativeLanguage: 'tr', uiLanguage: language })
    const result = await getVocabularySession('A1.1', language)
    expect(result.cards[0]).toMatchObject({ prompt: card[`context_sentence_${language}`], promptLanguage: language, format: 'sentence' })
  })
  it('does not turn an incomplete sentence into a self-rated word card', async () => {
    session({ card: { ...card, context_sentence_ru: null } })
    expect((await getVocabularySession('A1.1', 'ru')).cards).toEqual([])
    session({ card: { ...card, context_sentence_de: null } })
    expect((await getVocabularySession('A1.1', 'en')).cards).toEqual([])
  })
  it('requires the selected UI translation and keeps forward word prompts German', async () => {
    session({ card: { ...card, sentence_practice: false, translation_tr: null }, nativeLanguage: 'tr', uiLanguage: 'tr' })
    expect((await getVocabularySession('A1.1', 'tr')).cards).toEqual([])
    session({ direction: 'de_to_native', uiLanguage: 'tr' })
    expect((await getVocabularySession('A1.1', 'tr')).cards[0]).toMatchObject({ format: 'word', prompt: 'Tür', promptLanguage: 'de', translation: 'kapı' })
  })
  it('leaves out lessons that are switched off in the learning path', async () => {
    session({ pausedUnits: [card.unit_id] })
    expect((await getVocabularySession('A1.1', 'ru')).cards).toEqual([])
    session({ pausedUnits: ['00000000-0000-4000-8000-000000000098'] })
    expect((await getVocabularySession('A1.1', 'ru')).cards).toHaveLength(1)
  })
  it('keeps practising every lesson while the switch table does not exist yet', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    session({ pausedUnits: 'missing' })
    expect((await getVocabularySession('A1.1', 'ru')).cards).toHaveLength(1)
    expect(error).toHaveBeenCalledWith('[vocabulary] lesson_pauses_unavailable')
    error.mockRestore()
  })
  it('continues respecting the persisted spacing boundary after source resolution', async () => {
    session({ previousCardId: card.id })
    expect(await getVocabularySession('A1.1', 'ru')).toEqual({ learnerId: userId, cards: [], deferredCount: 1, previousCardId: card.id })
  })
})

describe('answer request routing', () => {
  it.each([undefined, '', ' \n '])('requires a nonempty typed answer, rejecting self-rating alone (%s)', async typedAnswer => {
    const { rpc } = session()
    expect(await submitVocabularyAnswer({ progressId, isCorrect: true, typedAnswer } as unknown as SubmitVocabularyAnswerInput)).toEqual({ success: false, error: 'invalid_input' })
    expect(rpc).not.toHaveBeenCalled()
  })
  it('ignores forged correctness and returns only the server grade', async () => {
    const { rpc } = session()
    rpc.mockResolvedValue({ data: { ...review, isCorrect: false }, error: null })
    expect(await submitVocabularyAnswer({ progressId, typedAnswer: 'wrong', isCorrect: true } as SubmitVocabularyAnswerInput)).toMatchObject({ success: true, isCorrect: false })
    expect(rpc).toHaveBeenCalledWith('submit_vocabulary_answer', expect.objectContaining({ p_is_correct: null, p_typed_answer: 'wrong' }))
  })
  it.each(['umlaut', 'typo'])('preserves the authoritative soft-error reason %s', async softError => {
    const { rpc } = session()
    rpc.mockResolvedValue({ data: { ...review, softError }, error: null })
    expect(await submitVocabularyAnswer({ progressId, typedAnswer: 'die Tur' })).toMatchObject({ success: true, softError })
  })
  it.each(['punctuation', 'capitalization'])('presents a historical %s receipt neutrally without changing earned progress', async softError => {
    const { rpc } = session()
    const legacy = { ...review, softError, previousPhase: 3, newPhase: 4, intervalInDays: 3 }
    rpc.mockResolvedValue({ data: legacy, error: null })
    expect(await submitVocabularyAnswer({ requestId, progressId, typedAnswer: 'ich öffne die tür' })).toEqual({
      ...legacy, softError: null, hint: softError,
    })
    expect(legacy.softError).toBe(softError)
    expect(legacy).not.toHaveProperty('hint')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('submit_vocabulary_answer_once', expect.objectContaining({ p_request_id: requestId }))
  })
  it.each(['punctuation', 'capitalization'])('rejects obsolete %s warnings from a current non-receipt grade', async softError => {
    const { rpc } = session()
    rpc.mockResolvedValue({ data: { ...review, softError }, error: null })
    expect(await submitVocabularyAnswer({ progressId, typedAnswer: 'ich öffne die tür' })).toEqual({ success: false, error: 'save_failed' })
  })
  it.each([
    { softError: 'capitalization', hint: null },
    { softError: 'punctuation', isCorrect: false },
  ])('rejects a contradictory legacy receipt without inventing a verdict %j', async invalid => {
    const { rpc } = session()
    rpc.mockResolvedValue({ data: { ...review, ...invalid }, error: null })
    expect(await submitVocabularyAnswer({ requestId, progressId, typedAnswer: 'ich öffne die tür' })).toEqual({ success: false, error: 'save_failed' })
  })
  it.each([
    { softError: 'unknown' }, { softError: undefined }, { isAlternative: undefined }, { correctAnswer: undefined },
  ])('rejects an incomplete or invalid server grade %j', async invalid => {
    const { rpc } = session()
    rpc.mockResolvedValue({ data: { ...review, ...invalid }, error: null })
    expect(await submitVocabularyAnswer({ progressId, typedAnswer: 'die Tür' })).toEqual({ success: false, error: 'save_failed' })
  })
  it.each([
    ['vocabulary_spacing_required','spacing_required'],
    ['review_not_due','save_failed'],
  ])('handles JSONB domain failure %s without retrying a write', async (error, expected) => {
    const { rpc } = session()
    rpc.mockResolvedValue({ data: { error, message: 'Review could not be saved.', sqlstate: 'PT409' }, error: null })
    expect(await submitVocabularyAnswer({ requestId, progressId, typedAnswer: 'die Tür' })).toEqual({ success: false, error: expected })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it.each([
    ['vocabulary_spacing_required','spacing_required'],
    ['review_not_due','save_failed'],
  ])('preserves the application mapping for PT409 %s without retrying a write', async (message, expected) => {
    const { rpc } = session()
    rpc.mockResolvedValue({data:null,error:{code:'PT409',message}})
    expect(await submitVocabularyAnswer({requestId,progressId,typedAnswer:'die Tür'})).toEqual({success:false,error:expected})
    expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('uses the receipt RPC and sends every answer byte unchanged', async () => {
    const { rpc } = session()
    const typedAnswer = ` ${card.context_sentence_de.normalize('NFD')}\n`
    expect(await submitVocabularyAnswer({ requestId, progressId, typedAnswer, uiLanguage: 'tr' })).toMatchObject({ success: true })
    expect(rpc).toHaveBeenCalledWith('submit_vocabulary_answer_once', {
      p_request_id: requestId, p_progress_id: progressId, p_is_correct: null, p_typed_answer: typedAnswer, p_ui_language: 'tr',
    })
  })
  it('routes typed answers through the non-receipt RPC for clients without request IDs', async () => {
    const { rpc } = session({ uiLanguage: 'uk' })
    await submitVocabularyAnswer({ progressId, typedAnswer: 'die Tür' })
    expect(rpc).toHaveBeenCalledWith('submit_vocabulary_answer', {
      p_progress_id: progressId, p_is_correct: null, p_typed_answer: 'die Tür', p_ui_language: 'uk',
    })
  })
  it('rejects invalid request IDs and anonymous writes before invoking either RPC', async () => {
    const { rpc } = session()
    expect(await submitVocabularyAnswer({ requestId: 'not-a-uuid', progressId, typedAnswer: 'die Tür' })).toEqual({ success: false, error: 'invalid_input' })
    expect(rpc).not.toHaveBeenCalled()
    const anonymous = session({ signedIn: false })
    expect(await submitVocabularyAnswer({ requestId, progressId, typedAnswer: 'die Tür' })).toEqual({ success: false, error: 'save_failed' })
    expect(anonymous.rpc).not.toHaveBeenCalled()
  })
  it('never falls back to non-idempotent grading when the receipt RPC fails', async () => {
    const { rpc } = session()
    rpc.mockResolvedValue({ data: null, error: { message: 'transport error' } })
    expect(await submitVocabularyAnswer({ requestId, progressId, typedAnswer: 'die Tür' })).toEqual({ success: false, error: 'save_failed' })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe('submit_vocabulary_answer_once')
  })
})

describe('queued action actor binding', () => {
  const otherId = '00000000-0000-4000-8000-000000000002'
  const decisions = [{ cardId: card.id, alreadyKnown: false }]
  it('returns the verified learner with the session cards', async () => {
    session()
    expect((await getVocabularySession('A1.1', 'ru')).learnerId).toBe(userId)
  })
  it('refuses a buffered review after logout/login as another user before invoking any RPC', async () => {
    const { rpc, from } = session({ actorId: otherId })
    expect(await submitVocabularyAnswer({ progressId, requestId, typedAnswer: 'die Tür', expectedLearnerId: userId })).toMatchObject({ success: false })
    expect(rpc).not.toHaveBeenCalled()
    expect(from).not.toHaveBeenCalled()
  })
  it('refuses buffered assessment decisions and skip when the authenticated actor changed', async () => {
    const { rpc } = session({ actorId: otherId })
    expect(await submitLessonAssessment(decisions, userId)).toMatchObject({ success: false })
    expect(await skipVocabularyAssessment('A1.1', userId)).toMatchObject({ success: false })
    expect(rpc).not.toHaveBeenCalled()
  })
  it('refuses signed-out and malformed assessment bindings without creating progress', async () => {
    const { rpc } = session({ signedIn: false })
    expect(await submitLessonAssessment(decisions, userId)).toMatchObject({ success: false })
    expect(await skipVocabularyAssessment('A1.1', userId)).toMatchObject({ success: false })
    expect(rpc).not.toHaveBeenCalled()
    const signedIn = session()
    expect(await submitLessonAssessment(decisions, 'invalid-uuid')).toMatchObject({ success: false })
    expect(await skipVocabularyAssessment('A1.1', 'invalid-uuid')).toMatchObject({ success: false })
    expect(signedIn.rpc).not.toHaveBeenCalled()
  })
  it('allows same-actor assessment and skip while keeping the bound UUID out of trusted RPC actor inputs', async () => {
    const { rpc } = session()
    rpc.mockResolvedValueOnce({ data: { addedKnown: 0, addedNew: 1 }, error: null })
      .mockResolvedValueOnce({ data: { addedKnown: 0, addedNew: 1, lesson: 'Lektion 1' }, error: null })
    expect(await submitLessonAssessment(decisions, userId)).toMatchObject({ success: true })
    expect(await skipVocabularyAssessment('A1.1', userId)).toMatchObject({ success: true, lesson: 'Lektion 1' })
    expect(rpc).toHaveBeenNthCalledWith(1, 'initialize_vocabulary_cards', { p_decisions: decisions })
    expect(rpc).toHaveBeenNthCalledWith(2, 'skip_vocabulary_assessment', { p_level: 'A1.1' })
  })
  it('allows a same-actor idempotent review, with the actor still derived from the authenticated RPC session', async () => {
    const { rpc } = session()
    expect(await submitVocabularyAnswer({ progressId, requestId, typedAnswer: 'die Tür', expectedLearnerId: userId })).toMatchObject({ success: true })
    expect(rpc).toHaveBeenCalledWith('submit_vocabulary_answer_once', expect.not.objectContaining({ p_user_id: userId }))
  })
})

it('accepts separate directional decisions but rejects duplicate or overlapping grades', async () => {
 const {rpc}=session()
 rpc.mockResolvedValue({data:{addedKnown:1,addedNew:1},error:null})
 const decisions=[{cardId:card.id,alreadyKnown:true,direction:'de_to_native' as const},{cardId:card.id,alreadyKnown:false,direction:'native_to_de' as const}]
 expect(await submitLessonAssessment(decisions,userId)).toMatchObject({success:true})
 rpc.mockClear()
 expect(await submitLessonAssessment([decisions[0],decisions[0]],userId)).toMatchObject({success:false})
 expect(await submitLessonAssessment([decisions[0],{cardId:card.id,alreadyKnown:false}],userId)).toMatchObject({success:false})
 expect(rpc).not.toHaveBeenCalled()
})
