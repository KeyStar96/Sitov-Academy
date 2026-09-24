'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { SOFT_ERROR_REASONS } from '@/lib/answer-grading'
import { getRpcError } from '@/lib/rpc-errors'
import { createClient } from '@/utils/supabase/server'
import { requestSession } from '@/lib/request-session'
import { hasTrainerAccess, isAccessLevel, getAllowedLessons } from '@/lib/access/levels'
import { LEITNER_LEARNED_BOX, normalizeBox, pickWeightedRandomOrder, selectionWeightForBox, vocabularyReviewMode, type LeitnerPhase } from '@/lib/leitner'
import { computeWordBoxState, isLessonInBox, summarizeBox, summarizeLessons, PHASE_INSPECTOR_LIMIT, type BoxBucketKey, type WordBoxState } from '@/lib/vocabulary-box'
import { scheduleVocabularyCards } from '@/lib/vocabulary-scheduler'
import { readVocabularyProgress } from '@/lib/vocabulary-queries'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { readAllRows } from '@/lib/supabase-read'
import { vocabularyQuery, mapVocabularyCard } from '@/lib/learning-catalog'
import { resolveVocabularySentenceSource, resolveVocabularyInterfaceTranslation, resolveCardInterfaceTranslation } from '@/lib/vocabulary-languages'
import { isOwnWordsLesson, parseGermanHeadword } from '@/lib/vocabulary-own-words'
import {
  isHardForNativeLanguage,
  type AddCardsResult, type AddOwnWordInput, type AddOwnWordResult, type AssessmentDecision, type DueVocabularyCard,
  type InitializeLessonResult, type LessonCardView, type LessonStat,
  type SubmitAssessmentResult, type SubmitVocabularyAnswerInput, type SubmitVocabularyAnswerResult,
  type SubmitVocabularySelfRatingInput, type CheckVocabularyRetryInput, type CheckVocabularyRetryResult,
  type PhaseCardView, type PhaseCardsResult, type VocabularyBoxSummary,
  type VocabularySession, type VocabularyAssessmentSession,
} from '@/lib/types/vocabulary'

const languageSchema = z.enum(['de', 'en', 'ru', 'uk', 'tr'])
const decisionSchema = z.array(z.object({ cardId: z.string().uuid(), alreadyKnown: z.boolean(), direction: z.enum(['de_to_native', 'native_to_de']).optional() })).max(1000)
const initializationResultSchema = z.object({ addedKnown: z.number().int().nonnegative(), addedNew: z.number().int().nonnegative() })
const reviewResultSchema = z.object({
  success: z.literal(true), isCorrect: z.boolean(), correctAnswer: z.string(), isAlternative: z.boolean(),
  softError: z.enum(SOFT_ERROR_REASONS).nullable(),
  previousPhase: z.number().int().min(1).max(6), newPhase: z.number().int().min(1).max(6),
  becameLearned: z.boolean(), movedBack: z.boolean(), intervalInDays: z.number().int().positive(),
})

async function loadLearner(expectedLearnerId?: string) {
  const { supabase, user } = await requestSession()
  if (!user || (expectedLearnerId !== undefined &&
    (!z.string().uuid().safeParse(expectedLearnerId).success || user.id !== expectedLearnerId))) return null
  const access = await loadLevelAccessProfile(supabase, user.id)
  if (!access) return null
  return { supabase, user, profile: { ...access, native_language: access.native_language ?? null } }
}

function refreshVocabulary() {
  revalidatePath('/[lang]/dashboard', 'page')
  revalidatePath('/[lang]/dashboard/level/[level]', 'page')
  revalidatePath('/[lang]/dashboard/level/[level]/vocabulary', 'page')
  revalidatePath('/[lang]/dashboard/level/[level]/vocabulary/train', 'page')
}

type Learner = NonNullable<Awaited<ReturnType<typeof loadLearner>>>

/**
 * Im Lernweg ausgeschaltete Lektionen (Migration 25) als Unit-IDs.
 *
 * Bewusst fehlertolerant: Fehlt die Tabelle noch (App vor der Migration
 * ausgerollt) oder scheitert das Lesen, gilt jede begonnene Lektion als
 * eingeschaltet. Das zeigt schlimmstenfalls zu viele Karten — nie zu wenige,
 * und nie einen Ausfall als „nichts zu tun".
 */
async function readPausedUnits(learner: Learner): Promise<Set<string>> {
  const { data, error } = await learner.supabase.from('vocabulary_lesson_pauses').select('unit_id').eq('auth_user_id', learner.user.id)
  if (error) {
    console.error('[vocabulary] lesson_pauses_unavailable')
    return new Set()
  }
  return new Set((data ?? []).map(row => row.unit_id))
}

/** Units einer Lektion, die die lernende Person nutzen darf (Kurslektion oder „Eigene Wörter"). */
async function lessonUnitIds(learner: Learner, lessonName: string, level: string): Promise<string[]> {
  const { data, error } = await vocabularyQuery(learner.supabase).eq('unit.label', lessonName).eq('unit.level', level)
  if (error) throw new Error(`vocabulary_lesson_unavailable: ${error.code ?? 'unknown'}`)
  const allowedLessons = getAllowedLessons(learner.profile, level, 'vocabulary')
  return [...new Set((data ?? []).map(row => mapVocabularyCard(row))
    .filter(card => card.level === level && hasTrainerAccess(learner.profile, card.level, 'vocabulary')
      && (card.is_own || !allowedLessons || allowedLessons.includes(card.unit_id)))
    .map(card => card.unit_id))]
}

async function setUnitsPaused(learner: Learner, unitIds: readonly string[], paused: boolean): Promise<boolean> {
  for (const unitId of unitIds) {
    const { data, error } = await learner.supabase.rpc('set_vocabulary_lesson_paused', { p_unit_id: unitId, p_paused: paused })
    if (error || getRpcError(data)) return false
  }
  return true
}

/** Due dates remain intact when sibling directions have to wait for another word. */
export async function getVocabularySession(level?: string, uiLanguage?: string): Promise<VocabularySession> {
  try {
    const learner = await loadLearner()
    if (!learner || (level && !hasTrainerAccess(learner.profile, level, 'vocabulary'))) return { learnerId: null, cards: [], deferredCount: 0, previousCardId: null }
    const { supabase, user, profile } = learner
    const language = languageSchema.catch('de').parse(uiLanguage ?? profile.ui_language)
    if (language === 'de') return { learnerId: null, cards: [], deferredCount: 0, previousCardId: null }
    // Session display needs only the interface/native sentence sources and German.
    // Keep the complete catalog shape for other callers; filter this embedded read.
    const locales = [...new Set(['de', language, profile.native_language].filter((value): value is string => !!value))]
    let catalogQuery = vocabularyQuery(supabase).in('translations.locale', locales).order('id')
    if (level) catalogQuery = catalogQuery.eq('unit.level', level)
    const [catalog, progress, { data: cursor, error: cursorError }, paused] = await Promise.all([
      readAllRows((from, to) => catalogQuery.range(from, to)),
      readAllRows((from, to) => supabase.from('vocabulary_direction_progress').select('id,card_id,direction,box_number')
        .eq('auth_user_id', user.id).lte('next_review_date', new Date().toISOString()).lt('box_number', LEITNER_LEARNED_BOX)
        .order('id').range(from, to)),
      supabase.from('vocabulary_learning_state').select('last_card_id').eq('auth_user_id', user.id).maybeSingle(),
      readPausedUnits(learner),
    ])
    // R10: Nur fehlender Zugriff liefert eine leere Session. Ein Lesefehler wird
    // codiert geworfen, sonst ist "Datenbank weg" von "nichts fällig" für den
    // Lernenden nicht unterscheidbar.
    if (cursorError) throw new Error(`vocabulary_session_unavailable: ${cursorError.code ?? 'unknown'}`)
    const catalogById = new Map(catalog.map(row => mapVocabularyCard(row)).map(card => [card.id, card]))
    // Reuse one display object per card in both directions (Flight can reference it).
    const displayCards = new Map([...catalogById].map(([id, card]) => [id, {
      id: card.id, level: card.level, lesson: card.lesson, word_de: card.word_de,
      article: card.article, plural: card.plural, image_url: card.image_url, audio_url: card.audio_url,
    }]))
    const cards: DueVocabularyCard[] = progress.flatMap(row => {
      const card = catalogById.get(row.card_id)
      if (!card || !hasTrainerAccess(profile, card.level, 'vocabulary')) return []
      // Im Lernweg ausgeschaltet: Lernstand bleibt, geübt wird die Lektion nicht.
      if (paused.has(card.unit_id)) return []
      const allowedLessons = getAllowedLessons(profile, card.level, 'vocabulary')
      if (allowedLessons !== null && !allowedLessons.includes(card.unit_id)) return []
      const box = normalizeBox(row.box_number)
      const direction = row.direction === 'native_to_de' ? 'native_to_de' : 'de_to_native'
      const sentence = direction === 'native_to_de' && card.sentence_practice
      const source = sentence ? resolveVocabularySentenceSource(card, language, profile.native_language) : null
      const translatedWord = resolveCardInterfaceTranslation(card, language)
      // Incomplete content must never downgrade a DB-enforced sentence to self-rating.
      if ((sentence && !source) || (!sentence && !translatedWord)) return []
      const translation = translatedWord?.text ?? ''
      return [{
        progressId: row.id, direction, format: sentence ? 'sentence' : 'word',
        // Der Server legt fest, welche Wege erlaubt sind; `learner_choice`
        // schaltet den Umschalter in der Lern-UI frei. Die Bewertungs-RPC
        // leitet dieselbe Regel erneut ab und lehnt eine Fehlnutzung ab (R5).
        mode: vocabularyReviewMode(sentence ? 'sentence' : 'word', direction),
        prompt: source ? source.text : direction === 'native_to_de' ? translation : card.word_de,
        promptLanguage: source ? source.language : direction === 'native_to_de' ? translatedWord!.language : 'de',
        // Der getippte Satz zeigt seinen Kontext erst nach dem Absenden; die
        // deutsche Musterlösung reist getrennt als `solution` mit, damit die
        // Karteikarten-Rückseite sie aufdecken kann (wie bei Wortkarten).
        contextSentence: sentence ? null : card.context_sentence_de,
        solution: sentence ? card.context_sentence_de : null,
        box, phase: (box === LEITNER_LEARNED_BOX ? 6 : box) as LeitnerPhase,
        card: displayCards.get(card.id)!,
        translation, isHardForNativeLanguage: isHardForNativeLanguage(card, profile.native_language),
      } satisfies DueVocabularyCard]
    })
    const weighted = pickWeightedRandomOrder(cards, card => selectionWeightForBox(card.box))
    return { learnerId: user.id, ...scheduleVocabularyCards(weighted, cursor?.last_card_id), previousCardId: cursor?.last_card_id ?? null }
  } catch (error) {
    // Weiterwerfen: die Trainer-Route hat eine error.tsx-Boundary. Eine leere
    // Session hier hätte einen Ausfall als "du bist fertig" dargestellt (R10).
    console.error("[vocabulary] session_unavailable")
    throw error instanceof Error ? error : new Error('vocabulary_session_unavailable')
  }
}

export async function getDueCards(level?: string, uiLanguage?: string): Promise<DueVocabularyCard[]> {
  return (await getVocabularySession(level, uiLanguage)).cards
}

/** Minimal assessment payload plus the verified actor for queued decisions. */
export async function getVocabularyAssessment(lessonName: string, level: string, uiLanguage?: string): Promise<VocabularyAssessmentSession> {
  try {
    // Eigene Wörter starten ohne Einstufung direkt in Phase 1.
    if (isOwnWordsLesson(lessonName)) return { learnerId: null, cards: [] }
    const learner = await loadLearner()
    if (!learner || !hasTrainerAccess(learner.profile, level, 'vocabulary')) return { learnerId: null, cards: [] }
    const language = languageSchema.catch('de').parse(uiLanguage ?? learner.profile.ui_language)
    const allowed = getAllowedLessons(learner.profile, level, 'vocabulary')
    if (language === 'de') return { learnerId: null, cards: [] }
    const [{ data, error }, progress] = await Promise.all([
      vocabularyQuery(learner.supabase).eq('unit.level', level).eq('unit.label', lessonName).order('id'),
      readVocabularyProgress(learner.supabase, learner.user.id),
    ])
    // R10: leere Karten nur bei fehlendem Zugriff, nie bei einem Lesefehler.
    if (error) throw new Error(`vocabulary_assessment_unavailable: ${error.code ?? 'unknown'}`)
    const assessed = new Set(progress.map(row => `${row.card_id}:${row.direction}`))
    return {
      learnerId: learner.user.id,
      cards: (['de_to_native', 'native_to_de'] as const).flatMap(direction => (data ?? []).map(row => mapVocabularyCard(row)).flatMap(card => {
        if (allowed !== null && !allowed.includes(card.unit_id)) return []
        const translation = resolveVocabularyInterfaceTranslation(card, language)
        if (!translation || assessed.has(`${card.id}:${direction}`)) return []
        return [{ id: card.id, word_de: card.word_de, article: card.article, plural: card.plural,
          translation: translation.text, translationLanguage: translation.language, direction }]
      })),
    }
  } catch (error) {
    console.error("[vocabulary] assessment_unavailable")
    throw error instanceof Error ? error : new Error('vocabulary_assessment_unavailable')
  }
}

/** A word-level decision initializes missing directions; existing progress is preserved. */
export async function submitLessonAssessment(decisions: AssessmentDecision[], expectedLearnerId?: string): Promise<SubmitAssessmentResult> {
  const failed: SubmitAssessmentResult = { success: false, addedKnown: 0, addedNew: 0 }
  const parsed = decisionSchema.safeParse(decisions)
  if (!parsed.success) return failed
  if (parsed.data.length === 0) return { success: true, addedKnown: 0, addedNew: 0 }
  try {
    const learner = await loadLearner(expectedLearnerId)
    if (!learner) return failed
    // Duplicate decisions are rejected rather than allowing contradictory grades.
    const directions = new Set<string>()
    for (const item of parsed.data) {
      for (const direction of item.direction ? [item.direction] : ['de_to_native', 'native_to_de']) {
        const key = `${item.cardId}:${direction}`
        if (directions.has(key)) return failed
        directions.add(key)
      }
    }
    const { data, error } = await learner.supabase.rpc('initialize_vocabulary_cards', { p_decisions: parsed.data })
    if (error || getRpcError(data)) {
      console.error("Vocabulary assessment failed:")
      return failed
    }
    const result = initializationResultSchema.safeParse(data)
    if (!result.success) return failed
    refreshVocabulary()
    return { success: true, ...result.data }
  } catch (error) {
    console.error("Vocabulary assessment failed:")
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
    if (!learner || (level && !hasTrainerAccess(learner.profile, level, 'vocabulary'))) return { success: false, added: 0 }
    let query = vocabularyQuery(learner.supabase).eq('unit.label', lessonName)
    if (level) query = query.eq('unit.level', level)
    const { data, error } = await query
    if (error || !data?.length) return { success: false, added: 0 }
    const allowed = data.map(mapVocabularyCard).filter(card => typeof card.id === 'string' && typeof card.level === 'string' && hasTrainerAccess(learner.profile, card.level, 'vocabulary'))
    if (!allowed.length) return { success: false, added: 0 }
    const result = await addCardsToTrainer(allowed.map(card => card.id), learner.user.id)
    // Wer eine Lektion aufnimmt, will sie auch üben: eine alte Pause fällt weg.
    // Scheitert das, sind die Wörter trotzdem aufgenommen — der Schalter im
    // Lernweg zeigt dann ehrlich „aus".
    if (result.success && !await setUnitsPaused(learner, [...new Set(allowed.map(card => card.unit_id))], false)) {
      console.error('[vocabulary] lesson_resume_failed')
    }
    return result
  } catch {
    return { success: false, added: 0 }
  }
}

/** Atomic skip + first actual lesson initialization; never a guessed lesson label. */
export async function skipVocabularyAssessment(level: string, expectedLearnerId?: string): Promise<InitializeLessonResult & { lesson?: string }> {
  if (!isAccessLevel(level)) return { success: false, added: 0 }
  try {
    const learner = await loadLearner(expectedLearnerId)
    if (!learner || !hasTrainerAccess(learner.profile, level, 'vocabulary')) return { success: false, added: 0 }
    const { data, error } = await learner.supabase.rpc('skip_vocabulary_assessment', { p_level: level })
    const result = initializationResultSchema.extend({ lesson: z.string().min(1) }).safeParse(data)
    if (error || getRpcError(data) || !result.success) return { success: false, added: 0 }
    refreshVocabulary()
    return { success: true, added: result.data.addedNew, lesson: result.data.lesson }
  } catch {
    return { success: false, added: 0 }
  }
}

const lessonSwitchSchema = z.object({ lesson: z.string().trim().min(1).max(200), level: z.string().min(1).max(40), inBox: z.boolean() })

/**
 * Schalter im Lernweg: Lektion in die Lernbox legen oder herausnehmen.
 * Herausnehmen löscht keinen Lernstand; die Karten ruhen nur. Das erste
 * Einschalten (Einstufung oder „alle in Phase 1") läuft über
 * submitLessonAssessment bzw. initializeLesson.
 */
export async function setLessonInBox(lesson: string, level: string, inBox: boolean): Promise<{ success: boolean }> {
  const parsed = lessonSwitchSchema.safeParse({ lesson, level, inBox })
  if (!parsed.success) return { success: false }
  try {
    const learner = await loadLearner()
    if (!learner || !hasTrainerAccess(learner.profile, parsed.data.level, 'vocabulary')) return { success: false }
    const units = await lessonUnitIds(learner, parsed.data.lesson, parsed.data.level)
    if (!units.length || !await setUnitsPaused(learner, units, !parsed.data.inBox)) return { success: false }
    refreshVocabulary()
    return { success: true }
  } catch {
    console.error('[vocabulary] lesson_switch_failed')
    return { success: false }
  }
}

export async function getVocabularyOnboarding(level: string): Promise<{ status: 'skipped' | 'completed'; lesson: string } | null> {
  const learner = await loadLearner()
  if (!learner || !hasTrainerAccess(learner.profile, level, 'vocabulary')) return null
  const { data, error } = await learner.supabase.from('vocabulary_onboarding').select('status,unit:learning_units!inner(label)')
    .eq('auth_user_id', learner.user.id).eq('level', level).maybeSingle()
  if (error || !data || (data.status !== 'skipped' && data.status !== 'completed')) return null
  return { status: data.status, lesson: data.unit.label }
}

const ownWordSchema = z.object({
  level: z.string().min(1).max(40),
  word: z.string().max(160).refine(value => value.trim().length > 0),
  translation: z.string().max(200).refine(value => value.trim().length > 0),
  uiLanguage: z.enum(['en', 'ru', 'uk', 'tr']),
})

/**
 * Trägt ein Wort in „Eigene Wörter" ein. Die Datenbank legt die private
 * Lektion beim ersten Wort an und entscheidet, ob das Wort sofort in Phase 1
 * startet (Lektion lernt schon) oder auf die erste Aktivierung wartet.
 * Die Übersetzung gilt für die Sprache der Oberfläche — aus ihr wird die
 * Richtung Deutsch → eigene Sprache abgefragt.
 */
export async function addOwnWord(input: AddOwnWordInput): Promise<AddOwnWordResult> {
  const parsed = ownWordSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'invalid' }
  try {
    const learner = await loadLearner()
    if (!learner || !hasTrainerAccess(learner.profile, parsed.data.level, 'vocabulary')) return { success: false, error: 'failed' }
    const headword = parseGermanHeadword(parsed.data.word)
    const { data, error } = await learner.supabase.rpc('add_own_vocabulary', {
      p_level: parsed.data.level, p_word_de: headword.word_de, p_article: headword.article,
      p_translation: parsed.data.translation.trim(), p_locale: parsed.data.uiLanguage,
    })
    if (error) return { success: false, error: 'failed' }
    const failure = getRpcError(data)
    if (failure) return { success: false, error: failure.error === 'own_word_exists' ? 'exists' : failure.error === 'own_word_limit' ? 'limit' : failure.error === 'invalid_input' ? 'invalid' : 'failed' }
    const result = z.object({ cardId: z.string().uuid(), activated: z.boolean() }).safeParse(data)
    if (!result.success) return { success: false, error: 'failed' }
    refreshVocabulary()
    return { success: true, ...result.data }
  } catch {
    return { success: false, error: 'failed' }
  }
}

/** Löscht ein eigenes Wort samt Lernstand. Fremde oder Kurs-Karten findet die Datenbank gar nicht erst. */
export async function deleteOwnWord(cardId: string): Promise<{ success: boolean }> {
  const parsed = z.string().uuid().safeParse(cardId)
  if (!parsed.success) return { success: false }
  try {
    const learner = await loadLearner()
    if (!learner) return { success: false }
    const { data, error } = await learner.supabase.rpc('delete_own_vocabulary', { p_card_id: parsed.data })
    if (error || getRpcError(data)) return { success: false }
    refreshVocabulary()
    return { success: true }
  } catch {
    return { success: false }
  }
}

/** Every review is graded from the learner's typed answer inside PostgreSQL. */
export async function submitVocabularyAnswer(input: SubmitVocabularyAnswerInput): Promise<SubmitVocabularyAnswerResult> {
  const parsed = z.object({ progressId: z.string().uuid(), expectedLearnerId: z.string().uuid().optional(), requestId: z.string().uuid().optional(),
    typedAnswer: z.string().min(1).max(4000).refine(value => value.trim().length > 0), uiLanguage: languageSchema.optional() }).safeParse(input)
  if (!parsed.success) return { success: false, error: 'invalid_input' }
  try {
    const learner = await loadLearner(parsed.data.expectedLearnerId)
    if (!learner) return { success: false, error: 'save_failed' }
    const payload = {
      p_progress_id: parsed.data.progressId, p_is_correct: null,
      p_typed_answer: parsed.data.typedAnswer,
      p_ui_language: parsed.data.uiLanguage ?? languageSchema.catch('de').parse(learner.profile.ui_language),
    }
    const { data, error } = parsed.data.requestId
      ? await learner.supabase.rpc('submit_vocabulary_answer_once', { ...payload, p_request_id: parsed.data.requestId })
      : await learner.supabase.rpc('submit_vocabulary_answer', payload)
    if (error) return { success: false, error: error.message.includes('vocabulary_spacing_required') ? 'spacing_required' : 'save_failed' }
    const failure = getRpcError(data)
    if (failure) return { success: false, error: failure.error === 'vocabulary_spacing_required' ? 'spacing_required' : 'save_failed' }
    const result = reviewResultSchema.safeParse(data)
    if (!result.success) return { success: false, error: 'save_failed' }
    return { ...result.data, previousPhase: result.data.previousPhase as LeitnerPhase, newPhase: result.data.newPhase as LeitnerPhase }
  } catch {
    return { success: false, error: 'save_failed' }
  }
}

/**
 * Karteikarten-Selbsteinschätzung. Die Bewertung bleibt in PostgreSQL: Der
 * Server leitet den erlaubten Modus aus der aktuellen Box neu ab und lehnt eine
 * Selbsteinschätzung für Tipp-Karten ab (R5). Der `requestId` macht den Schritt
 * idempotent – ein wiederholter Versuch liefert dieselbe Quittung.
 */
export async function submitVocabularySelfRating(input: SubmitVocabularySelfRatingInput): Promise<SubmitVocabularyAnswerResult> {
  const parsed = z.object({ progressId: z.string().uuid(), expectedLearnerId: z.string().uuid().optional(),
    requestId: z.string().uuid(), known: z.boolean(), uiLanguage: languageSchema.optional() }).safeParse(input)
  if (!parsed.success) return { success: false, error: 'invalid_input' }
  try {
    const learner = await loadLearner(parsed.data.expectedLearnerId)
    if (!learner) return { success: false, error: 'save_failed' }
    const { data, error } = await learner.supabase.rpc('submit_vocabulary_self_rating_once', {
      p_request_id: parsed.data.requestId, p_progress_id: parsed.data.progressId, p_known: parsed.data.known,
      p_ui_language: parsed.data.uiLanguage ?? languageSchema.catch('de').parse(learner.profile.ui_language),
    })
    if (error) return { success: false, error: 'save_failed' }
    const failure = getRpcError(data)
    if (failure) return { success: false, error: failure.error === 'vocabulary_spacing_required' ? 'spacing_required' : 'save_failed' }
    const result = reviewResultSchema.safeParse(data)
    if (!result.success) return { success: false, error: 'save_failed' }
    return { ...result.data, previousPhase: result.data.previousPhase as LeitnerPhase, newPhase: result.data.newPhase as LeitnerPhase }
  } catch {
    return { success: false, error: 'save_failed' }
  }
}

const retryResultSchema = z.object({
  success: z.literal(true), isCorrect: z.boolean(), correctAnswer: z.string(), isAlternative: z.boolean(),
  softError: z.enum(SOFT_ERROR_REASONS).nullable(),
})

/**
 * Wiederholung in derselben Sitzung (Phase-6-Regel): PostgreSQL bewertet die
 * getippte Antwort wie beim ersten Versuch, schreibt aber nichts — Phase und
 * Termin hat schon der erste Versuch des Tages festgelegt.
 */
export async function checkVocabularyRetry(input: CheckVocabularyRetryInput): Promise<CheckVocabularyRetryResult> {
  const parsed = z.object({ progressId: z.string().uuid(), expectedLearnerId: z.string().uuid().optional(),
    typedAnswer: z.string().min(1).max(4000).refine(value => value.trim().length > 0), uiLanguage: languageSchema.optional() }).safeParse(input)
  if (!parsed.success) return { success: false, error: 'invalid_input' }
  try {
    const learner = await loadLearner(parsed.data.expectedLearnerId)
    if (!learner) return { success: false, error: 'check_failed' }
    const { data, error } = await learner.supabase.rpc('check_vocabulary_retry', {
      p_progress_id: parsed.data.progressId, p_typed_answer: parsed.data.typedAnswer,
      p_ui_language: parsed.data.uiLanguage ?? languageSchema.catch('de').parse(learner.profile.ui_language),
    })
    if (error || getRpcError(data)) return { success: false, error: 'check_failed' }
    const result = retryResultSchema.safeParse(data)
    return result.success ? result.data : { success: false, error: 'check_failed' }
  } catch {
    return { success: false, error: 'check_failed' }
  }
}

export async function finishVocabularySession(): Promise<{ success: boolean }> {
  refreshVocabulary()
  return { success: true }
}

/** A word is learned only after both independently scheduled directions are learned. */
export async function getLessonCards(lessonName: string, level?: string, uiLanguage?: string): Promise<LessonCardView[]> {
  const learner = await loadLearner()
  if (!learner || (level && !hasTrainerAccess(learner.profile, level, 'vocabulary'))) return []
  const language = languageSchema.catch('de').parse(uiLanguage ?? learner.profile.ui_language)
  if (language === 'de') return []
  let query = vocabularyQuery(learner.supabase).eq('unit.label', lessonName)
  if (level) query = query.eq('unit.level', level)
  // R10: readVocabularyProgress wirft mit Fehlercode. Ein `.catch(() => null)`
  // hätte diesen Code verworfen und den Ausfall als "leere Lektion" gezeigt.
  const [{ data: cards, error }, progress] = await Promise.all([
    query, readVocabularyProgress(learner.supabase, learner.user.id),
  ])
  if (error) throw new Error(`vocabulary_lesson_unavailable: ${error.code ?? 'unknown'}`)
  return (cards ?? []).map(row => mapVocabularyCard(row)).filter(card => {
    if (!card.id || !card.lesson || !card.level || !hasTrainerAccess(learner.profile, card.level, 'vocabulary')) return false
    const allowedLessons = getAllowedLessons(learner.profile, card.level, 'vocabulary')
    if (allowedLessons && !allowedLessons.includes(card.unit_id)) return false
    return true
  }).map(card => {
    const states = (progress ?? []).filter(row => row.card_id === card.id)
    const learned = states.length === 2 && states.every(row => normalizeBox(row.box_number) === LEITNER_LEARNED_BOX)
    const phase = states.length ? Math.min(...states.map(row => Math.min(6, normalizeBox(row.box_number)))) as LeitnerPhase : null
    return { id: card.id, word_de: card.word_de, article: card.article, plural: card.plural,
      translation: resolveCardInterfaceTranslation(card, language)?.text ?? '', image_url: card.image_url, audio_url: card.audio_url,
      phase, isLearned: learned, contextSentence: card.context_sentence_de }
  }).sort((a, b) => a.word_de.localeCompare(b.word_de, 'de-DE'))
}

/**
 * Lernstand je Lektion für die Auswahl-Liste.
 *
 * Leitet aus demselben Wort-Lernstand ab wie die Fächer-Übersicht: Eine Vokabel
 * zählt als „gelernt", wenn beide Richtungen im Archiv sind, und als fällig,
 * sobald eine Richtung wartet. Beide Ansichten können so nie widersprechen.
 */
export async function getLessonStats(level?: string): Promise<LessonStat[]> {
  return lessonStats(await readWordBox(level, null))
}

/**
 * Lektionsliste und Fächer-Verteilung aus **einem** Lesevorgang.
 *
 * Beides braucht denselben vollständigen Katalog samt Lernstand. Zwei
 * getrennte Aufrufe auf derselben Seite hätten Katalog und Lernstand doppelt
 * gelesen — bei tausenden Vokabeln pro Niveau lohnt sich der gemeinsame Pass.
 */
export async function getVocabularyOverview(level?: string): Promise<{ stats: LessonStat[]; box: VocabularyBoxSummary; dueCards: number }> {
  const words = await readWordBox(level, null)
  const stats = lessonStats(words)
  // Die Lernbox enthält nur eingeschaltete Lektionen; der Lernweg zeigt alle.
  const inBox = wordsInBox(words, stats)
  // Fällige *Karten* (Richtungen) wie der Start-Knopf der Lernbox zählt; die
  // Fächer zählen fällige Wörter. Die Startseite spricht von Karten.
  const dueCards = inBox.reduce((sum, { state }) => sum
    + (state ? Number(state.directions.de_to_native.isDue) + Number(state.directions.native_to_de.isDue) : 0), 0)
  return { stats, box: summarizeBox(inBox.map(word => word.state)), dueCards }
}

/** Lektionsstand samt Schalterstellung aus dem Lernweg. */
function lessonStats(words: WordBoxEntry[] | null): LessonStat[] {
  const paused = new Set((words ?? []).filter(word => word.paused).map(word => word.card.lesson))
  return summarizeLessons(lessonEntries(words)).map(stat => paused.has(stat.lesson) ? { ...stat, paused: true } : stat)
}

/** Nur die Wörter eingeschalteter Lektionen — der Inhalt der Lernbox. */
function wordsInBox(words: WordBoxEntry[] | null, stats: readonly LessonStat[] = lessonStats(words)): WordBoxEntry[] {
  const lessons = new Set(stats.filter(isLessonInBox).map(stat => stat.lesson))
  return (words ?? []).filter(word => lessons.has(word.card.lesson))
}

const bucketKeySchema = z.union([z.literal('learned'), z.number().int().min(1).max(6)])

/**
 * Liest die Vokabeln eines Niveaus samt Lernstand beider Richtungen und
 * reduziert sie auf den Wort-Lernstand. Gemeinsame Grundlage der
 * Fächer-Übersicht und des Inspektors, damit beide nie auseinanderlaufen.
 */
interface WordBoxEntry {
  card: ReturnType<typeof mapVocabularyCard>
  /** `null`, solange nicht beide Richtungen angelegt sind — dann in keinem Fach. */
  state: WordBoxState | null
  /** Leer, wenn der Aufrufer keine Sprache braucht (reines Zählen). */
  translation: string
  /** Die Lektion ist im Lernweg ausgeschaltet. */
  paused: boolean
}

function lessonEntries(words: WordBoxEntry[] | null) {
  return (words ?? []).map(({ card, state }) => ({ lesson: card.lesson, state }))
}

async function readWordBox(level: string | undefined, language: z.infer<typeof languageSchema> | null): Promise<WordBoxEntry[] | null> {
  const learner = await loadLearner()
  if (!learner || (level && !hasTrainerAccess(learner.profile, level, 'vocabulary'))) return null
  let query = vocabularyQuery(learner.supabase)
  if (level) query = query.eq('unit.level', level)
  const [{ data: cards, error }, progress, paused] = await Promise.all([
    query, readVocabularyProgress(learner.supabase, learner.user.id), readPausedUnits(learner),
  ])
  // R10: Ein Lesefehler wird geworfen. Eine leere Box hier hätte einen Ausfall
  // als „du hast noch nichts gelernt" dargestellt.
  if (error) throw new Error(`vocabulary_box_unavailable: ${error.code ?? 'unknown'}`)
  const byCard = new Map<string, typeof progress>()
  for (const row of progress) {
    const list = byCard.get(row.card_id)
    if (list) list.push(row)
    else byCard.set(row.card_id, [row])
  }
  const now = Date.now()
  return (cards ?? []).map(row => mapVocabularyCard(row)).filter(card => {
    if (!card.id || !card.lesson || !card.level || !hasTrainerAccess(learner.profile, card.level, 'vocabulary')) return false
    const allowedLessons = getAllowedLessons(learner.profile, card.level, 'vocabulary')
    return !allowedLessons || allowedLessons.includes(card.unit_id)
  }).map(card => ({
    card,
    state: computeWordBoxState(byCard.get(card.id) ?? [], now),
    translation: language ? resolveCardInterfaceTranslation(card, language)?.text ?? '' : '',
    paused: paused.has(card.unit_id),
  }))
}

/**
 * Inhalt eines einzelnen Fachs für die „Hineinschauen"-Ansicht.
 *
 * Sortiert fällige und halb gewusste Wörter nach vorn: Das sind die, wegen
 * derer man überhaupt in ein Fach schaut.
 */
export async function getPhaseCards(key: BoxBucketKey, level?: string, uiLanguage?: string): Promise<PhaseCardsResult> {
  const parsedKey = bucketKeySchema.safeParse(key)
  if (!parsedKey.success) return { key: 1, cards: [], total: 0, truncated: false }
  const bucket = parsedKey.data as BoxBucketKey
  const learner = await loadLearner()
  if (!learner) return { key: bucket, cards: [], total: 0, truncated: false }
  const language = languageSchema.catch('de').parse(uiLanguage ?? learner.profile.ui_language)
  if (language === 'de') return { key: bucket, cards: [], total: 0, truncated: false }
  const words = await readWordBox(level, language)
  if (!words) return { key: bucket, cards: [], total: 0, truncated: false }

  const matching = wordsInBox(words).filter((word): word is typeof word & { state: WordBoxState } =>
    !!word.state && (bucket === 'learned' ? word.state.isLearned : !word.state.isLearned && word.state.phase === bucket))
  const sorted = matching.sort((a, b) => {
    if (a.state.isDue !== b.state.isDue) return a.state.isDue ? -1 : 1
    if (a.state.isHalfKnown !== b.state.isHalfKnown) return a.state.isHalfKnown ? -1 : 1
    return a.card.word_de.localeCompare(b.card.word_de, 'de-DE')
  })

  return {
    key: bucket,
    total: sorted.length,
    truncated: sorted.length > PHASE_INSPECTOR_LIMIT,
    cards: sorted.slice(0, PHASE_INSPECTOR_LIMIT).map(word => ({
      id: word.card.id, word_de: word.card.word_de, article: word.card.article,
      translation: word.translation, lesson: word.card.lesson, ...word.state,
    } satisfies PhaseCardView)),
  }
}

export async function resetLessonProgress(lessonName: string, level?: string): Promise<{ success: boolean }> {
  const learner = await loadLearner()
  if (!learner || (level && !hasTrainerAccess(learner.profile, level, 'vocabulary'))) return { success: false }
  let query = vocabularyQuery(learner.supabase).eq('unit.label', lessonName)
  if (level) query = query.eq('unit.level', level)
  const { data: cards, error } = await query
  const allowed = (cards ?? []).map(mapVocabularyCard).filter(card => {
    if (!card.id || !card.lesson || !card.level || !hasTrainerAccess(learner.profile, card.level, 'vocabulary')) return false
    const allowedLessons = getAllowedLessons(learner.profile, card.level, 'vocabulary')
    if (allowedLessons && !allowedLessons.includes(card.unit_id)) return false
    return true
  })
  if (error || !allowed.length) return { success: false }
  for (const unitId of new Set(allowed.map(card => card.unit_id))) {
    const { data: resetResult, error: deleteError } = await learner.supabase.rpc('reset_vocabulary_lesson_progress', { p_unit_id: z.string().uuid().parse(unitId) })
    if (deleteError || getRpcError(resetResult)) return { success: false }
  }
  refreshVocabulary()
  return { success: true }
}
