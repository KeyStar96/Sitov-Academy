'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { hasLevelAccess } from '@/lib/access/levels'
import { loadLevelAccessProfile } from '@/lib/access/server'
import {
  applyLeitnerAnswer,
  ASSESSMENT_KNOWN_PHASE,
  LEITNER_LEARNED_BOX,
  nextReviewDateForBox,
  normalizeBox,
  pickWeightedRandomOrder,
  selectionWeightForBox,
  type LeitnerPhase,
} from '@/lib/leitner'
import {
  isHardForNativeLanguage,
  resolveTranslation,
  type AddCardsResult,
  type AssessmentDecision,
  type DueVocabularyCard,
  type InitializeLessonResult,
  type LessonCardView,
  type LessonStat,
  type SubmitAssessmentResult,
  type SubmitVocabularyAnswerInput,
  type SubmitVocabularyAnswerResult,
} from '@/lib/types/vocabulary'

interface DueCardRow {
  id: string
  box_number: number | null
  vocabulary_cards: {
    id: string
    level: string
    lesson: string
    word_de: string
    article: string | null
    plural: string | null
    translation_ru: string | null
    translation_tr: string | null
    translation_en: string | null
    image_url: string | null
    audio_url: string | null
    is_hard_for_ru: boolean | null
    is_hard_for_tr: boolean | null
  }
}

async function loadNativeLanguage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('native_language')
    .eq('id', userId)
    .single()

  if (error) {
    console.error(`Muttersprache für Nutzer ${userId} nicht ladbar:`, error.message)
    return null
  }

  return data?.native_language ?? null
}

/**
 * Liefert alle fälligen Karten eines Sprachniveaus in gewichteter Zufallsreihenfolge.
 * Niedrige Phasen werden häufiger gezogen als hohe (siehe `PHASE_SELECTION_WEIGHTS`).
 * Karten im Zustand „gelernt" (Box 7) werden nicht mehr abgefragt.
 */
export async function getDueCards(level?: string): Promise<DueVocabularyCard[]> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return []

    // Defense-in-Depth: gesperrte Niveaus liefern keine Karten, auch wenn die
    // Action direkt (ohne Route-Guard) aufgerufen wird.
    if (level) {
      const profile = await loadLevelAccessProfile(supabase, user.id)
      if (!hasLevelAccess(profile, level)) return []
    }

    const nativeLanguage = await loadNativeLanguage(supabase, user.id)

    let query = supabase
      .from('user_vocabulary_progress')
      .select(`
        id,
        box_number,
        vocabulary_cards!inner (
          id,
          level,
          lesson,
          word_de,
          article,
          plural,
          translation_ru,
          translation_tr,
          translation_en,
          image_url,
          audio_url,
          is_hard_for_ru,
          is_hard_for_tr
        )
      `)
      .eq('user_id', user.id)
      .lte('next_review_date', new Date().toISOString())
      .lt('box_number', LEITNER_LEARNED_BOX)

    if (level) {
      query = query.eq('vocabulary_cards.level', level)
    }

    const { data, error } = await query

    if (error) {
      console.error('Fehler beim Abrufen fälliger Vokabeln:', error.message)
      return []
    }

    const rows = (data ?? []) as unknown as DueCardRow[]

    const mapped = rows.map((row) => {
      const box = normalizeBox(row.box_number)
      const phase = (box === LEITNER_LEARNED_BOX ? 6 : box) as LeitnerPhase

      return {
        progressId: row.id,
        box,
        phase,
        card: {
          id: row.vocabulary_cards.id,
          lesson: row.vocabulary_cards.lesson,
          level: row.vocabulary_cards.level,
          word_de: row.vocabulary_cards.word_de,
          article: row.vocabulary_cards.article,
          plural: row.vocabulary_cards.plural,
          image_url: row.vocabulary_cards.image_url,
          audio_url: row.vocabulary_cards.audio_url,
        },
        translation: resolveTranslation(row.vocabulary_cards, nativeLanguage),
        isHardForNativeLanguage: isHardForNativeLanguage(row.vocabulary_cards, nativeLanguage),
      }
    })

    return pickWeightedRandomOrder(mapped, (card) => selectionWeightForBox(card.box))
  } catch (err) {
    console.error('Unerwarteter Fehler in getDueCards:', err)
    return []
  }
}

/**
 * Legt den Lernstand für eine Lektion an. Neue Karten starten in Phase 1 und
 * sind sofort fällig, damit der erste Kontakt noch heute möglich ist.
 *
 * Das Sprachniveau muss mitgegeben werden: Lektionsnamen wie „Lektion 1"
 * kommen in mehreren Niveaus vor.
 */
export async function initializeLesson(
  lessonName: string,
  level?: string
): Promise<InitializeLessonResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { success: false, added: 0 }

    if (level) {
      const profile = await loadLevelAccessProfile(supabase, user.id)
      if (!hasLevelAccess(profile, level)) return { success: false, added: 0 }
    }

    let cardsQuery = supabase.from('vocabulary_cards').select('id').eq('lesson', lessonName)
    if (level) {
      cardsQuery = cardsQuery.eq('level', level)
    }

    const { data: cards, error: cardsError } = await cardsQuery

    if (cardsError) {
      console.error(`Karten der Lektion "${lessonName}" nicht ladbar:`, cardsError.message)
      return { success: false, added: 0 }
    }

    if (!cards || cards.length === 0) return { success: false, added: 0 }

    const { data: existingProgress, error: progressError } = await supabase
      .from('user_vocabulary_progress')
      .select('card_id')
      .eq('user_id', user.id)

    if (progressError) {
      console.error('Bestehender Lernfortschritt nicht ladbar:', progressError.message)
      return { success: false, added: 0 }
    }

    const existingCardIds = new Set((existingProgress ?? []).map((entry) => entry.card_id))
    const now = new Date().toISOString()

    const newProgress = cards
      .filter((card) => !existingCardIds.has(card.id))
      .map((card) => ({
        user_id: user.id,
        card_id: card.id,
        box_number: 1,
        next_review_date: now,
      }))

    if (newProgress.length > 0) {
      const { error: insertError } = await supabase
        .from('user_vocabulary_progress')
        .insert(newProgress)

      if (insertError) {
        console.error(`Lernstand für "${lessonName}" nicht anlegbar:`, insertError.message)
        return { success: false, added: 0 }
      }
    }

    revalidatePath('/[lang]/dashboard/level/[level]/vocabulary', 'page')
    return { success: true, added: newProgress.length }
  } catch (err) {
    console.error('Unerwarteter Fehler in initializeLesson:', err)
    return { success: false, added: 0 }
  }
}

/**
 * Liefert alle Vokabeln einer Lektion inklusive persönlichem Lernstand –
 * Grundlage für die Lektions-Detailansicht und den Einstufungs-Durchlauf.
 * Karten ohne Lernstand (`phase: null`) wurden noch nicht in den
 * Karteikasten übernommen.
 */
export async function getLessonCards(lessonName: string, level?: string): Promise<LessonCardView[]> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return []

    if (level) {
      const profile = await loadLevelAccessProfile(supabase, user.id)
      if (!hasLevelAccess(profile, level)) return []
    }

    const nativeLanguage = await loadNativeLanguage(supabase, user.id)

    let cardsQuery = supabase
      .from('vocabulary_cards')
      .select(
        'id, word_de, article, plural, translation_ru, translation_tr, translation_en, is_hard_for_ru, is_hard_for_tr'
      )
      .eq('lesson', lessonName)

    if (level) {
      cardsQuery = cardsQuery.eq('level', level)
    }

    const [{ data: cards, error: cardsError }, { data: progress, error: progressError }] = await Promise.all([
      cardsQuery,
      supabase.from('user_vocabulary_progress').select('card_id, box_number').eq('user_id', user.id),
    ])

    if (cardsError) {
      console.error(`Karten der Lektion "${lessonName}" nicht ladbar:`, cardsError.message)
      return []
    }

    if (progressError) {
      console.error('Lernfortschritt für die Detailansicht nicht ladbar:', progressError.message)
    }

    const progressByCard = new Map(
      (progress ?? []).map((entry) => [entry.card_id, normalizeBox(entry.box_number)])
    )

    return (cards ?? [])
      .map((card) => {
        const box = progressByCard.get(card.id)
        const isLearned = box === LEITNER_LEARNED_BOX
        const phase: LeitnerPhase | null = box === undefined ? null : isLearned ? 6 : box

        return {
          id: card.id,
          word_de: card.word_de,
          article: card.article,
          plural: card.plural,
          translation: resolveTranslation(card, nativeLanguage),
          phase,
          isLearned,
        }
      })
      .sort((a, b) => a.word_de.localeCompare(b.word_de, 'de-DE'))
  } catch (err) {
    console.error('Unerwarteter Fehler in getLessonCards:', err)
    return []
  }
}

/**
 * Manuelle Übernahme einzelner, gezielt ausgewählter Vokabeln in den
 * Karteikasten. Startet immer in Phase 1, unabhängig vom Lektionsstatus.
 * Karten mit bereits bestehendem Lernstand werden übersprungen.
 */
export async function addCardsToTrainer(cardIds: string[]): Promise<AddCardsResult> {
  try {
    if (cardIds.length === 0) return { success: true, added: 0 }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { success: false, added: 0 }

    const { data: existingProgress, error: progressError } = await supabase
      .from('user_vocabulary_progress')
      .select('card_id')
      .eq('user_id', user.id)
      .in('card_id', cardIds)

    if (progressError) {
      console.error('Bestehender Lernfortschritt nicht ladbar:', progressError.message)
      return { success: false, added: 0 }
    }

    const existingCardIds = new Set((existingProgress ?? []).map((entry) => entry.card_id))
    const now = new Date().toISOString()

    const newProgress = cardIds
      .filter((cardId) => !existingCardIds.has(cardId))
      .map((cardId) => ({
        user_id: user.id,
        card_id: cardId,
        box_number: 1,
        next_review_date: now,
      }))

    if (newProgress.length > 0) {
      const { error: insertError } = await supabase.from('user_vocabulary_progress').insert(newProgress)

      if (insertError) {
        console.error('Manuelle Vokabel-Übernahme nicht speicherbar:', insertError.message)
        return { success: false, added: 0 }
      }
    }

    revalidatePath('/[lang]/dashboard', 'page')
    revalidatePath('/[lang]/dashboard/level/[level]', 'page')
    revalidatePath('/[lang]/dashboard/level/[level]/vocabulary', 'page')
    return { success: true, added: newProgress.length }
  } catch (err) {
    console.error('Unerwarteter Fehler in addCardsToTrainer:', err)
    return { success: false, added: 0 }
  }
}

/**
 * Übernimmt das Ergebnis des „Vokabeln einstufen"-Durchlaufs (Pre-Assessment):
 * Bereits bekannte Vokabeln landen in Phase 6, unbekannte sofort fällig in
 * Phase 1 und damit ohne Umweg im aktiven Lernen. Karten mit bereits
 * bestehendem Lernstand werden übersprungen, damit ein Doppelklick nichts
 * überschreibt.
 */
export async function submitLessonAssessment(decisions: AssessmentDecision[]): Promise<SubmitAssessmentResult> {
  try {
    if (decisions.length === 0) return { success: true, addedKnown: 0, addedNew: 0 }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { success: false, addedKnown: 0, addedNew: 0 }

    const cardIds = decisions.map((decision) => decision.cardId)
    const { data: existingProgress, error: progressError } = await supabase
      .from('user_vocabulary_progress')
      .select('card_id')
      .eq('user_id', user.id)
      .in('card_id', cardIds)

    if (progressError) {
      console.error('Bestehender Lernfortschritt nicht ladbar:', progressError.message)
      return { success: false, addedKnown: 0, addedNew: 0 }
    }

    const existingCardIds = new Set((existingProgress ?? []).map((entry) => entry.card_id))
    const now = new Date()
    const nowIso = now.toISOString()

    const rows = decisions
      .filter((decision) => !existingCardIds.has(decision.cardId))
      .map((decision) => ({
        user_id: user.id,
        card_id: decision.cardId,
        box_number: decision.alreadyKnown ? ASSESSMENT_KNOWN_PHASE : 1,
        next_review_date: decision.alreadyKnown
          ? nextReviewDateForBox(ASSESSMENT_KNOWN_PHASE, false, now).toISOString()
          : nowIso,
      }))

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('user_vocabulary_progress').insert(rows)

      if (insertError) {
        console.error('Einstufung nicht speicherbar:', insertError.message)
        return { success: false, addedKnown: 0, addedNew: 0 }
      }
    }

    const addedKnown = rows.filter((row) => row.box_number === ASSESSMENT_KNOWN_PHASE).length
    const addedNew = rows.length - addedKnown

    revalidatePath('/[lang]/dashboard', 'page')
    revalidatePath('/[lang]/dashboard/level/[level]', 'page')
    revalidatePath('/[lang]/dashboard/level/[level]/vocabulary', 'page')

    return { success: true, addedKnown, addedNew }
  } catch (err) {
    console.error('Unerwarteter Fehler in submitLessonAssessment:', err)
    return { success: false, addedKnown: 0, addedNew: 0 }
  }
}

/**
 * Verbucht eine Antwort im Phase-6-Modell.
 *
 * Richtig → eine Phase weiter, aus Phase 6 heraus gilt die Vokabel als gelernt.
 * Falsch  → exakt eine Phase zurück, mindestens bis Phase 1. Der bisherige
 *           Lernfortschritt bleibt erhalten und wird nicht zurückgesetzt.
 *
 * Muttersprache und Schwierigkeitsmarker werden serverseitig aus Profil und
 * Karte gelesen – der Client kann die Intervalle damit nicht beeinflussen.
 *
 * Bewusst ohne revalidatePath: Ein Refresh mitten in der Lernsession würde die
 * Kartenliste neu filtern. Die Übersichten aktualisiert `finishVocabularySession`.
 */
export async function submitVocabularyAnswer(
  input: SubmitVocabularyAnswerInput
): Promise<SubmitVocabularyAnswerResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { success: false }

    const { data: progress, error: readError } = await supabase
      .from('user_vocabulary_progress')
      .select('box_number, lapses, vocabulary_cards!inner (is_hard_for_ru, is_hard_for_tr)')
      .eq('id', input.progressId)
      .eq('user_id', user.id)
      .single()

    if (readError || !progress) {
      console.error(
        `Lernstand ${input.progressId} für Nutzer ${user.id} nicht ladbar:`,
        readError?.message ?? 'kein Datensatz'
      )
      return { success: false }
    }

    const nativeLanguage = await loadNativeLanguage(supabase, user.id)
    const card = progress.vocabulary_cards as unknown as {
      is_hard_for_ru: boolean | null
      is_hard_for_tr: boolean | null
    }

    const result = applyLeitnerAnswer({
      currentBox: progress.box_number,
      isCorrect: input.isCorrect,
      isHardForNativeLanguage: isHardForNativeLanguage(card, nativeLanguage),
    })

    const now = new Date().toISOString()
    const { error: writeError } = await supabase
      .from('user_vocabulary_progress')
      .update({
        box_number: result.newBox,
        next_review_date: result.nextReviewDate.toISOString(),
        lapses: (progress.lapses ?? 0) + (result.movedBack ? 1 : 0),
        last_answered_at: now,
        updated_at: now,
      })
      .eq('id', input.progressId)
      .eq('user_id', user.id)

    if (writeError) {
      console.error(`Lernstand ${input.progressId} nicht speicherbar:`, writeError.message)
      return { success: false }
    }

    return {
      success: true,
      previousPhase: result.previousPhase,
      newPhase: result.newPhase,
      becameLearned: result.becameLearned,
      movedBack: result.movedBack,
      intervalInDays: result.intervalInDays,
    }
  } catch (err) {
    console.error('Unerwarteter Fehler in submitVocabularyAnswer:', err)
    return { success: false }
  }
}

/** Aktualisiert die Fortschrittsanzeigen nach dem Ende einer Lernsession. */
export async function finishVocabularySession(): Promise<{ success: boolean }> {
  try {
    revalidatePath('/[lang]/dashboard', 'page')
    revalidatePath('/[lang]/dashboard/level/[level]', 'page')
    revalidatePath('/[lang]/dashboard/level/[level]/vocabulary', 'page')
    return { success: true }
  } catch (err) {
    console.error('Unerwarteter Fehler in finishVocabularySession:', err)
    return { success: false }
  }
}

/** Lernstand je Lektion für die Übersichtsseite. */
export async function getLessonStats(level?: string): Promise<LessonStat[]> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return []

    if (level) {
      const profile = await loadLevelAccessProfile(supabase, user.id)
      if (!hasLevelAccess(profile, level)) return []
    }

    let cardsQuery = supabase.from('vocabulary_cards').select('id, lesson')
    if (level) {
      cardsQuery = cardsQuery.eq('level', level)
    }

    const [{ data: cards, error: cardsError }, { data: progress, error: progressError }] =
      await Promise.all([
        cardsQuery,
        supabase
          .from('user_vocabulary_progress')
          .select('card_id, box_number, next_review_date')
          .eq('user_id', user.id),
      ])

    if (cardsError) {
      console.error('Vokabelkarten für die Statistik nicht ladbar:', cardsError.message)
      return []
    }

    if (progressError) {
      console.error('Lernfortschritt für die Statistik nicht ladbar:', progressError.message)
    }

    const progressByCard = new Map(
      (progress ?? []).map((entry) => [
        entry.card_id,
        { box: normalizeBox(entry.box_number), nextReviewDate: entry.next_review_date },
      ])
    )

    const now = Date.now()
    const stats = new Map<string, LessonStat>()

    for (const card of cards ?? []) {
      const stat = stats.get(card.lesson) ?? {
        lesson: card.lesson,
        total: 0,
        active: 0,
        learned: 0,
        untouched: 0,
        due: 0,
      }

      stat.total += 1
      const entry = progressByCard.get(card.id)

      if (!entry) {
        stat.untouched += 1
      } else if (entry.box === LEITNER_LEARNED_BOX) {
        stat.learned += 1
      } else {
        stat.active += 1
        if (entry.nextReviewDate && new Date(entry.nextReviewDate).getTime() <= now) {
          stat.due += 1
        }
      }

      stats.set(card.lesson, stat)
    }

    return [...stats.values()].sort((left, right) => left.lesson.localeCompare(right.lesson, 'de-DE'))
  } catch (err) {
    console.error('Unerwarteter Fehler in getLessonStats:', err)
    return []
  }
}

/**
 * Setzt den Lernfortschritt für eine bestimmte Lektion zurück.
 * Löscht alle zugehörigen Einträge aus `user_vocabulary_progress`.
 */
export async function resetLessonProgress(lessonName: string, level?: string): Promise<{ success: boolean }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { success: false }

    if (level) {
      const profile = await loadLevelAccessProfile(supabase, user.id)
      if (!hasLevelAccess(profile, level)) return { success: false }
    }

    // Finde zuerst alle card_ids für diese Lektion
    let cardsQuery = supabase.from('vocabulary_cards').select('id').eq('lesson', lessonName)
    if (level) {
      cardsQuery = cardsQuery.eq('level', level)
    }

    const { data: cards, error: cardsError } = await cardsQuery

    if (cardsError || !cards || cards.length === 0) {
      console.error(`Karten der Lektion "${lessonName}" nicht ladbar:`, cardsError?.message)
      return { success: false }
    }

    const cardIds = cards.map(c => c.id)

    const { error: deleteError } = await supabase
      .from('user_vocabulary_progress')
      .delete()
      .eq('user_id', user.id)
      .in('card_id', cardIds)

    if (deleteError) {
      console.error('Fehler beim Zurücksetzen des Fortschritts:', deleteError.message)
      return { success: false }
    }

    revalidatePath('/[lang]/dashboard', 'page')
    revalidatePath('/[lang]/dashboard/level/[level]', 'page')
    revalidatePath('/[lang]/dashboard/level/[level]/vocabulary', 'page')

    return { success: true }
  } catch (err) {
    console.error('Unerwarteter Fehler in resetLessonProgress:', err)
    return { success: false }
  }
}
