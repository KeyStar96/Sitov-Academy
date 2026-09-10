'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { hasLevelAccess, isAccessLevel } from '@/lib/access/levels'
import { LEITNER_LEARNED_BOX, normalizeBox, pickWeightedRandomOrder, selectionWeightForBox, type LeitnerPhase } from '@/lib/leitner'
import { scheduleVocabularyCards } from '@/lib/vocabulary-scheduler'
import { readVocabularyProgress } from '@/lib/vocabulary-queries'
import { resolveVocabularySentenceSource, resolveVocabularyTranslation } from '@/lib/vocabulary-languages'
import {
  isHardForNativeLanguage, resolveTranslation,
  type AddCardsResult, type AssessmentDecision, type DueVocabularyCard,
  type InitializeLessonResult, type LessonCardView, type LessonStat,
  type SubmitAssessmentResult, type SubmitVocabularyAnswerInput, type SubmitVocabularyAnswerResult,
  type VocabularySession, type VocabularyAssessmentSession,
} from '@/lib/types/vocabulary'

const languageSchema = z.enum(['de', 'en', 'ru', 'uk', 'tr'])
const decisionSchema = z.array(z.object({ cardId: z.string().uuid(), alreadyKnown: z.boolean() })).max(1000)
const initializationResultSchema = z.object({ addedKnown: z.number().int().nonnegative(), addedNew: z.number().int().nonnegative() })
const reviewResultSchema = z.object({
  success: z.literal(true), isCorrect: z.boolean(), correctAnswer: z.string().optional(),
  previousPhase: z.number().int().min(1).max(6), newPhase: z.number().int().min(1).max(6),
  becameLearned: z.boolean(), movedBack: z.boolean(), intervalInDays: z.number().int().positive(),
})

async function loadLearner(expectedLearnerId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || (expectedLearnerId !== undefined &&
    (!z.string().uuid().safeParse(expectedLearnerId).success || user.id !== expectedLearnerId))) return null
  const { data: profile, error } = await supabase.from('profiles')
    .select('role, allowed_levels, native_language, ui_language').eq('id', user.id).single()
  if (error || !profile) return null
  return { supabase, user, profile }
}

function refreshVocabulary() {
  revalidatePath('/[lang]/dashboard', 'page')
  revalidatePath('/[lang]/dashboard/level/[level]', 'page')
  revalidatePath('/[lang]/dashboard/level/[level]/vocabulary', 'page')
  revalidatePath('/[lang]/dashboard/level/[level]/vocabulary/train', 'page')
}

/** Due dates remain intact when sibling directions have to wait for another word. */
export async function getVocabularySession(level?: string, uiLanguage?: string): Promise<VocabularySession> {
  try {
    const learner = await loadLearner()
    if (!learner || (level && !hasLevelAccess(learner.profile, level))) return { learnerId: null, cards: [], deferredCount: 0, previousCardId: null }
    const { supabase, user, profile } = learner
    const language = languageSchema.catch('de').parse(uiLanguage ?? profile.ui_language)
    let query = supabase.from('vocabulary_direction_progress').select('*, vocabulary_cards!inner(*)')
      .eq('user_id', user.id).lte('next_review_date', new Date().toISOString()).lt('box_number', LEITNER_LEARNED_BOX)
    if (level) query = query.eq('vocabulary_cards.level', level)
    query = query.order('id')
    const readDue = async () => {
      const rows: NonNullable<Awaited<typeof query>['data']> = []
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await query.range(offset, offset + 499)
        if (error) return { data: null, error }
        rows.push(...(data ?? []))
        if (!data || data.length < 500) return { data: rows, error: null }
      }
    }
    const [{ data, error }, { data: cursor, error: cursorError }] = await Promise.all([
      readDue(),
      supabase.from('vocabulary_learning_state').select('last_card_id').eq('user_id', user.id).maybeSingle(),
    ])
    // Fail closed if the previous word cannot be determined: never violate spacing.
    if (error || cursorError) {
      console.error('Vocabulary session could not be loaded:', error?.code ?? cursorError?.code)
      return { learnerId: null, cards: [], deferredCount: 0, previousCardId: null }
    }
    const cards: DueVocabularyCard[] = (data ?? []).filter(row => hasLevelAccess(profile, row.vocabulary_cards.level)).flatMap(row => {
      const card = row.vocabulary_cards
      const box = normalizeBox(row.box_number)
      const direction = row.direction === 'native_to_de' ? 'native_to_de' : 'de_to_native'
      const sentence = direction === 'native_to_de' && card.sentence_practice
      const source = sentence ? resolveVocabularySentenceSource(card, language, profile.native_language) : null
      const translatedWord = resolveVocabularyTranslation(card, profile.native_language)
      // Incomplete content must never downgrade a DB-enforced sentence to self-rating.
      if ((sentence && !source) || (!sentence && !translatedWord)) return []
      const translation = translatedWord?.text ?? ''
      return [{
        progressId: row.id, direction, format: sentence ? 'sentence' : 'word',
        prompt: source ? source.text : direction === 'native_to_de' ? translation : card.word_de,
        promptLanguage: source ? source.language : direction === 'native_to_de' ? translatedWord!.language : 'de',
        // Never send the exact German sentence before a typing answer is submitted.
        contextSentence: sentence ? null : card.context_sentence_de,
        box, phase: (box === LEITNER_LEARNED_BOX ? 6 : box) as LeitnerPhase,
        card: { id: card.id, level: card.level, lesson: card.lesson, word_de: card.word_de,
          article: card.article, plural: card.plural, image_url: card.image_url, audio_url: card.audio_url },
        translation, isHardForNativeLanguage: isHardForNativeLanguage(card, profile.native_language),
      } satisfies DueVocabularyCard]
    })
    const weighted = pickWeightedRandomOrder(cards, card => selectionWeightForBox(card.box))
    return { learnerId: user.id, ...scheduleVocabularyCards(weighted, cursor?.last_card_id), previousCardId: cursor?.last_card_id ?? null }
  } catch (error) {
    console.error('Vocabulary session failed:', error instanceof Error ? error.name : 'unknown')
    return { learnerId: null, cards: [], deferredCount: 0, previousCardId: null }
  }
}

export async function getDueCards(level?: string, uiLanguage?: string): Promise<DueVocabularyCard[]> {
  return (await getVocabularySession(level, uiLanguage)).cards
}

/** Minimal assessment payload plus the verified actor for queued decisions. */
export async function getVocabularyAssessment(lessonName: string, level: string): Promise<VocabularyAssessmentSession> {
  const learner = await loadLearner()
  if (!learner || !hasLevelAccess(learner.profile, level)) return { learnerId: null, cards: [] }
  const allCards = await getLessonCards(lessonName, level)
  return {
    learnerId: learner.user.id,
    cards: allCards.filter(card => card.phase === null).map(({ id, word_de, article }) => ({ id, word_de, article })),
  }
}

/** One decision initializes both directions, without changing any existing state. */
export async function submitLessonAssessment(decisions: AssessmentDecision[], expectedLearnerId?: string): Promise<SubmitAssessmentResult> {
  const failed: SubmitAssessmentResult = { success: false, addedKnown: 0, addedNew: 0 }
  const parsed = decisionSchema.safeParse(decisions)
  if (!parsed.success) return failed
  if (parsed.data.length === 0) return { success: true, addedKnown: 0, addedNew: 0 }
  try {
    const learner = await loadLearner(expectedLearnerId)
    if (!learner) return failed
    // Duplicate decisions are rejected rather than allowing contradictory grades.
    if (new Set(parsed.data.map(item => item.cardId)).size !== parsed.data.length) return failed
    const { data, error } = await learner.supabase.rpc('initialize_vocabulary_cards', { p_decisions: parsed.data })
    if (error) {
      console.error('Vocabulary assessment failed:', error.code)
      return failed
    }
    const result = initializationResultSchema.safeParse(data)
    if (!result.success) return failed
    refreshVocabulary()
    return { success: true, ...result.data }
  } catch (error) {
    console.error('Vocabulary assessment failed:', error instanceof Error ? error.name : 'unknown')
    return failed
  }
}

export async function addCardsToTrainer(cardIds: string[], expectedLearnerId?: string): Promise<AddCardsResult> {
  if (!Array.isArray(cardIds)) return { success: false, added: 0 }
  const result = await submitLessonAssessment([...new Set(cardIds)].map(cardId => ({ cardId, alreadyKnown: false })), expectedLearnerId)
  return { success: result.success, added: result.addedNew }
}

export async function initializeLesson(lessonName: string, level?: string, expectedLearnerId?: string): Promise<InitializeLessonResult> {
  try {
    if (typeof lessonName !== 'string' || !lessonName.trim() || lessonName.length > 200) return { success: false, added: 0 }
    const learner = await loadLearner(expectedLearnerId)
    if (!learner || (level && !hasLevelAccess(learner.profile, level))) return { success: false, added: 0 }
    let query = learner.supabase.from('vocabulary_cards').select('id,level').eq('lesson', lessonName)
    if (level) query = query.eq('level', level)
    const { data, error } = await query
    if (error || !data?.length) return { success: false, added: 0 }
    const allowed = data.filter(card => hasLevelAccess(learner.profile, card.level))
    if (!allowed.length) return { success: false, added: 0 }
    return addCardsToTrainer(allowed.map(card => card.id), learner.user.id)
  } catch {
    return { success: false, added: 0 }
  }
}

/** Atomic skip + first actual lesson initialization; never a guessed lesson label. */
export async function skipVocabularyAssessment(level: string, expectedLearnerId?: string): Promise<InitializeLessonResult & { lesson?: string }> {
  if (!isAccessLevel(level)) return { success: false, added: 0 }
  try {
    const learner = await loadLearner(expectedLearnerId)
    if (!learner || !hasLevelAccess(learner.profile, level)) return { success: false, added: 0 }
    const { data, error } = await learner.supabase.rpc('skip_vocabulary_assessment', { p_level: level })
    const result = initializationResultSchema.extend({ lesson: z.string().min(1) }).safeParse(data)
    if (error || !result.success) return { success: false, added: 0 }
    refreshVocabulary()
    return { success: true, added: result.data.addedNew, lesson: result.data.lesson }
  } catch {
    return { success: false, added: 0 }
  }
}

export async function getVocabularyOnboarding(level: string): Promise<{ status: 'skipped' | 'completed'; lesson: string } | null> {
  const learner = await loadLearner()
  if (!learner || !hasLevelAccess(learner.profile, level)) return null
  const { data, error } = await learner.supabase.from('vocabulary_onboarding').select('status,started_lesson')
    .eq('user_id', learner.user.id).eq('level', level).maybeSingle()
  if (error || !data || (data.status !== 'skipped' && data.status !== 'completed')) return null
  return { status: data.status, lesson: data.started_lesson }
}

/** Word self-rating is accepted; sentence correctness is computed inside PostgreSQL. */
export async function submitVocabularyAnswer(input: SubmitVocabularyAnswerInput): Promise<SubmitVocabularyAnswerResult> {
  const parsed = z.object({ progressId: z.string().uuid(), expectedLearnerId: z.string().uuid().optional(), requestId: z.string().uuid().optional(), isCorrect: z.boolean().optional(),
    typedAnswer: z.string().max(4000).optional(), uiLanguage: languageSchema.optional() }).safeParse(input)
  if (!parsed.success) return { success: false, error: 'invalid_input' }
  try {
    const learner = await loadLearner(parsed.data.expectedLearnerId)
    if (!learner) return { success: false, error: 'save_failed' }
    const payload = {
      p_progress_id: parsed.data.progressId, p_is_correct: parsed.data.isCorrect ?? null,
      p_typed_answer: parsed.data.typedAnswer ?? null,
      p_ui_language: parsed.data.uiLanguage ?? languageSchema.catch('de').parse(learner.profile.ui_language),
    }
    const { data, error } = parsed.data.requestId
      ? await learner.supabase.rpc('submit_vocabulary_answer_once', { ...payload, p_request_id: parsed.data.requestId })
      : await learner.supabase.rpc('submit_vocabulary_answer', payload)
    if (error) return { success: false, error: error.message.includes('vocabulary_spacing_required') ? 'spacing_required' : 'save_failed' }
    const result = reviewResultSchema.safeParse(data)
    if (!result.success) return { success: false, error: 'save_failed' }
    return { ...result.data, previousPhase: result.data.previousPhase as LeitnerPhase, newPhase: result.data.newPhase as LeitnerPhase }
  } catch {
    return { success: false, error: 'save_failed' }
  }
}

export async function finishVocabularySession(): Promise<{ success: boolean }> {
  refreshVocabulary()
  return { success: true }
}

/** A word is learned only after both independently scheduled directions are learned. */
export async function getLessonCards(lessonName: string, level?: string): Promise<LessonCardView[]> {
  const learner = await loadLearner()
  if (!learner || (level && !hasLevelAccess(learner.profile, level))) return []
  let query = learner.supabase.from('vocabulary_cards').select('*').eq('lesson', lessonName)
  if (level) query = query.eq('level', level)
  const [{ data: cards, error }, progress] = await Promise.all([
    query, readVocabularyProgress(learner.supabase, learner.user.id).catch(() => null),
  ])
  if (error || !progress) return []
  return (cards ?? []).filter(card => hasLevelAccess(learner.profile, card.level)).map(card => {
    const states = (progress ?? []).filter(row => row.card_id === card.id)
    const learned = states.length === 2 && states.every(row => normalizeBox(row.box_number) === LEITNER_LEARNED_BOX)
    const phase = states.length ? Math.min(...states.map(row => Math.min(6, normalizeBox(row.box_number)))) as LeitnerPhase : null
    return { id: card.id, word_de: card.word_de, article: card.article, plural: card.plural,
      translation: resolveTranslation(card, learner.profile.native_language), image_url: card.image_url, audio_url: card.audio_url,
      phase, isLearned: learned, contextSentence: card.context_sentence_de }
  }).sort((a, b) => a.word_de.localeCompare(b.word_de, 'de-DE'))
}

export async function getLessonStats(level?: string): Promise<LessonStat[]> {
  const learner = await loadLearner()
  if (!learner || (level && !hasLevelAccess(learner.profile, level))) return []
  let query = learner.supabase.from('vocabulary_cards').select('id,lesson,level')
  if (level) query = query.eq('level', level)
  const [{ data: cards, error }, progress] = await Promise.all([
    query, readVocabularyProgress(learner.supabase, learner.user.id).catch(() => null),
  ])
  if (error || !progress) return []
  const stats = new Map<string, LessonStat>()
  const now = Date.now()
  for (const card of cards ?? []) {
    if (!hasLevelAccess(learner.profile, card.level)) continue
    const stat = stats.get(card.lesson) ?? { lesson: card.lesson, total: 0, active: 0, learned: 0, untouched: 0, due: 0 }
    const states = (progress ?? []).filter(row => row.card_id === card.id)
    stat.total += 1
    if (!states.length) stat.untouched += 1
    else if (states.length === 2 && states.every(row => normalizeBox(row.box_number) === LEITNER_LEARNED_BOX)) stat.learned += 1
    else {
      stat.active += 1
      if (states.some(row => normalizeBox(row.box_number) < LEITNER_LEARNED_BOX && row.next_review_date && Date.parse(row.next_review_date) <= now)) stat.due += 1
    }
    stats.set(card.lesson, stat)
  }
  return [...stats.values()].sort((a, b) => a.lesson.localeCompare(b.lesson, 'de-DE', { numeric: true }))
}

export async function resetLessonProgress(lessonName: string, level?: string): Promise<{ success: boolean }> {
  const learner = await loadLearner()
  if (!learner || (level && !hasLevelAccess(learner.profile, level))) return { success: false }
  let query = learner.supabase.from('vocabulary_cards').select('id,level').eq('lesson', lessonName)
  if (level) query = query.eq('level', level)
  const { data: cards, error } = await query
  const allowed = (cards ?? []).filter(card => hasLevelAccess(learner.profile, card.level))
  if (error || !allowed.length) return { success: false }
  // The legacy delete trigger removes both directions in the same transaction.
  const { error: deleteError } = await learner.supabase.from('user_vocabulary_progress').delete()
    .eq('user_id', learner.user.id).in('card_id', allowed.map(card => card.id))
  if (deleteError) return { success: false }
  refreshVocabulary()
  return { success: true }
}
