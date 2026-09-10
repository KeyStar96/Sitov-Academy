jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))

import { createClient } from '@/utils/supabase/server'
import { getVocabularySession, submitVocabularyAnswer, submitLessonAssessment, skipVocabularyAssessment } from '@/app/actions/vocabulary'
import type { VocabularyCardRow } from '@/lib/types/vocabulary'

const userId = '00000000-0000-4000-8000-000000000001'
const progressId = '10000000-0000-4000-8000-000000000001'
const requestId = '20000000-0000-4000-8000-000000000001'
const card: VocabularyCardRow = {
  id: '30000000-0000-4000-8000-000000000001', word_de: 'Tür', lesson: 'Lektion 1', level: 'A1.1',
  article: 'die', plural: 'Türen', created_at: null, image_url: null, audio_url: null,
  is_hard_for_ru: false, is_hard_for_tr: false, sentence_practice: true,
  translation_en: 'door', translation_ru: 'дверь', translation_uk: 'двері', translation_tr: 'kapı',
  context_sentence_de: 'Ich öffne die Tür.', context_sentence_en: 'I open the door.',
  context_sentence_ru: 'Я открываю дверь.', context_sentence_uk: 'Я відчиняю двері.', context_sentence_tr: 'Kapıyı açıyorum.',
}
const review = {
  success: true, isCorrect: true, correctAnswer: card.context_sentence_de,
  previousPhase: 1, newPhase: 2, becameLearned: false, movedBack: false, intervalInDays: 1,
}

function session(options: {
  card?: VocabularyCardRow; nativeLanguage?: string; uiLanguage?: string;
  direction?: string; signedIn?: boolean; previousCardId?: string | null; actorId?: string
} = {}) {
  const profile = {
    role: 'student', allowed_levels: ['A1.1'], native_language: options.nativeLanguage ?? 'Russisch',
    ui_language: options.uiLanguage ?? 'de',
  }
  const rows = [{
    id: progressId, user_id: userId, vocabulary_cards: options.card ?? card,
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
  const from = jest.fn((table: string) => table === 'profiles' ? profileChain : table === 'vocabulary_learning_state' ? cursor : progress)
  const rpc = jest.fn().mockResolvedValue({ data: review, error: null })
  const client = {
    from, rpc, auth: { getUser: jest.fn().mockResolvedValue({ data: { user: options.signedIn === false ? null : { id: options.actorId ?? userId } }, error: null }) },
  }
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  return { from, rpc, progress, cursor }
}

beforeEach(() => jest.clearAllMocks())

describe('session DTO source language', () => {
  it('uses the foreign native sentence for German UI without leaking its German answer', async () => {
    const { progress, cursor } = session({ nativeLanguage: 'Türkisch' })
    const result = await getVocabularySession('A1.1', 'de')
    expect(result.cards).toHaveLength(1)
    expect(result.cards[0]).toMatchObject({ format: 'sentence', prompt: card.context_sentence_tr, promptLanguage: 'tr', contextSentence: null })
    expect(JSON.stringify(result.cards[0])).not.toContain(card.context_sentence_de)
    expect(progress.eq).toHaveBeenCalledWith('user_id', userId)
    expect(cursor.eq).toHaveBeenCalledWith('user_id', userId)
  })
  it.each(['en', 'ru', 'uk', 'tr'] as const)('returns the exact %s UI sentence regardless of profile preferences', async language => {
    session({ nativeLanguage: 'Türkisch', uiLanguage: 'de' })
    const result = await getVocabularySession('A1.1', language)
    expect(result.cards[0]).toMatchObject({ prompt: card[`context_sentence_${language}`], promptLanguage: language, format: 'sentence' })
  })
  it('does not turn an incomplete sentence into a self-rated word card', async () => {
    session({ card: { ...card, context_sentence_ru: null } })
    expect((await getVocabularySession('A1.1', 'ru')).cards).toEqual([])
    session({ card: { ...card, context_sentence_de: null } })
    expect((await getVocabularySession('A1.1', 'en')).cards).toEqual([])
  })
  it('reports the actual foreign fallback while keeping forward word prompts German', async () => {
    session({ card: { ...card, sentence_practice: false, translation_tr: null }, nativeLanguage: 'Türkisch' })
    expect((await getVocabularySession('A1.1', 'de')).cards[0]).toMatchObject({ format: 'word', prompt: 'door', promptLanguage: 'en' })
    session({ direction: 'de_to_native' })
    expect((await getVocabularySession('A1.1', 'tr')).cards[0]).toMatchObject({ format: 'word', prompt: 'Tür', promptLanguage: 'de' })
  })
  it('continues respecting the persisted spacing boundary after source resolution', async () => {
    session({ previousCardId: card.id })
    expect(await getVocabularySession('A1.1', 'de')).toEqual({ learnerId: userId, cards: [], deferredCount: 1, previousCardId: card.id })
  })
})

describe('answer request routing', () => {
  it('uses the receipt RPC and sends every answer byte unchanged', async () => {
    const { rpc } = session()
    const typedAnswer = ` ${card.context_sentence_de.normalize('NFD')}\n`
    expect(await submitVocabularyAnswer({ requestId, progressId, typedAnswer, uiLanguage: 'tr' })).toMatchObject({ success: true })
    expect(rpc).toHaveBeenCalledWith('submit_vocabulary_answer_once', {
      p_request_id: requestId, p_progress_id: progressId, p_is_correct: null, p_typed_answer: typedAnswer, p_ui_language: 'tr',
    })
  })
  it('preserves the old RPC contract for clients without request IDs', async () => {
    const { rpc } = session({ uiLanguage: 'uk' })
    await submitVocabularyAnswer({ progressId, isCorrect: false })
    expect(rpc).toHaveBeenCalledWith('submit_vocabulary_answer', {
      p_progress_id: progressId, p_is_correct: false, p_typed_answer: null, p_ui_language: 'uk',
    })
  })
  it('rejects invalid request IDs and anonymous writes before invoking either RPC', async () => {
    const { rpc } = session()
    expect(await submitVocabularyAnswer({ requestId: 'not-a-uuid', progressId, isCorrect: true })).toEqual({ success: false, error: 'invalid_input' })
    expect(rpc).not.toHaveBeenCalled()
    const anonymous = session({ signedIn: false })
    expect(await submitVocabularyAnswer({ requestId, progressId, isCorrect: true })).toEqual({ success: false, error: 'save_failed' })
    expect(anonymous.rpc).not.toHaveBeenCalled()
  })
  it('never falls back to non-idempotent grading when the receipt RPC fails', async () => {
    const { rpc } = session()
    rpc.mockResolvedValue({ data: null, error: { message: 'transport error' } })
    expect(await submitVocabularyAnswer({ requestId, progressId, isCorrect: true })).toEqual({ success: false, error: 'save_failed' })
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
    expect(await submitVocabularyAnswer({ progressId, requestId, isCorrect: true, expectedLearnerId: userId })).toMatchObject({ success: false })
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
    expect(await submitVocabularyAnswer({ progressId, requestId, isCorrect: true, expectedLearnerId: userId })).toMatchObject({ success: true })
    expect(rpc).toHaveBeenCalledWith('submit_vocabulary_answer_once', expect.not.objectContaining({ p_user_id: userId }))
  })
})
