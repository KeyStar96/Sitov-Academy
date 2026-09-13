'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { hasTrainerAccess, getAllowedLessons } from '@/lib/access/levels'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { buildFillInBlankChips } from '@/lib/exercise-chips'
import {
  parseFillInBlankContent,
  parseMultipleChoiceContent,
  type RecordExerciseAttemptInput,
  type RecordExerciseAttemptResult,
  type StudentExercise,
} from '@/lib/types/exercise'
import type { Database } from '@/supabase/database.types'

type ExerciseRow = Database['public']['Tables']['exercises']['Row']

interface EmbeddedProgress {
  completed: boolean | null
  score: number | null
  attempts: number | null
}

type ExerciseWithProgress = ExerciseRow & {
  user_exercise_progress: EmbeddedProgress[] | null
}

interface VocabularyMatch {
  article: string | null
  audioUrl: string | null
}

function normalizeWord(value: string): string {
  return value.trim().toLocaleLowerCase('de-DE')
}

function asLocalizedText(value: unknown): Record<string, string> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const result: Record<string, string> = {}
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string') result[k] = v
    }
    return result
  }
  return null
}

function readProgress(progress: EmbeddedProgress[] | null): {
  completed: boolean
  score: number
  attempts: number
} {
  const entry = progress && progress.length > 0 ? progress[0] : null
  return {
    completed: entry?.completed ?? false,
    score: entry?.score ?? 0,
    attempts: entry?.attempts ?? 0,
  }
}

/**
 * Sucht Artikel und Audio-Spur zu den Lückentext-Lösungen in der Vokabelbank.
 * Der Artikel speist den Genus-Hinweis, die Audio-URL den Tap-to-Listen-Button.
 */
async function loadVocabularyMatches(
  supabase: Awaited<ReturnType<typeof createClient>>,
  words: readonly string[]
): Promise<Map<string, VocabularyMatch>> {
  const matches = new Map<string, VocabularyMatch>()
  if (words.length === 0) return matches

  const { data, error } = await supabase
    .from('vocabulary_cards')
    .select('word_de, article, audio_url')
    .in('word_de', [...words])

  if (error) {
    console.error('Fehler beim Abrufen der Vokabel-Metadaten für Übungen:', error.message)
    return matches
  }

  for (const card of data ?? []) {
    matches.set(normalizeWord(card.word_de), {
      article: card.article,
      audioUrl: card.audio_url,
    })
  }

  return matches
}

/**
 * Lädt alle Übungen eines Sprachniveaus und bereitet sie für die UI auf:
 * Tipp-Chips, kontrastive Hinweise, Audio-Spur und Fortschritt sind aufgelöst.
 * Nicht darstellbare oder fehlerhaft gepflegte Inhalte werden ausgefiltert,
 * damit dem Lernenden niemals eine leere Übungskarte gezeigt wird.
 */
export async function getExercises(level?: string): Promise<StudentExercise[]> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return []

    const accessProfile = await loadLevelAccessProfile(supabase, user.id)
    if (level && !hasTrainerAccess(accessProfile, level, 'exercises')) return []

    let query = supabase
      .from('exercises')
      .select('*, user_exercise_progress (completed, score, attempts)')
      .eq('user_exercise_progress.user_id', user.id)
      .order('lesson', { ascending: true })
      .order('id', { ascending: true })

    if (level) {
      query = query.eq('level', level)
    } else if (accessProfile?.role !== 'admin' && accessProfile?.role !== 'teacher') {
      query = query.in('level', (accessProfile?.allowed_levels ?? []).filter(item => hasTrainerAccess(accessProfile, item, 'exercises')))
    }

    const { data, error } = await query

    if (error) {
      console.error('Fehler beim Abrufen der Übungen:', error.message)
      return []
    }

    const rows = ((data ?? []) as ExerciseWithProgress[]).filter(row => {
      const allowedLessons = getAllowedLessons(accessProfile, row.level, 'exercises')
      return !allowedLessons || allowedLessons.includes(row.lesson)
    })

    // Lösungen der Lückentexte vorab sammeln: für Geschwister-Distraktoren
    // und für den Abgleich mit der Vokabelbank.
    const answersByTopic = new Map<string, string[]>()
    const allAnswers: string[] = []

    for (const row of rows) {
      if (row.type !== 'fill_in_blank') continue
      const content = parseFillInBlankContent(row.content)
      if (!content) continue

      const answer = content.correct_answer.trim()
      allAnswers.push(answer)
      const bucket = answersByTopic.get(row.topic)
      if (bucket) {
        bucket.push(answer)
      } else {
        answersByTopic.set(row.topic, [answer])
      }
    }

    const vocabularyMatches = await loadVocabularyMatches(supabase, allAnswers)

    const exercises: StudentExercise[] = []

    for (const row of rows) {
      const progress = readProgress(row.user_exercise_progress)
      const hint = asLocalizedText(row.hint)

      if (row.type === 'fill_in_blank') {
        const content = parseFillInBlankContent(row.content)
        if (!content) {
          console.error(`Übung ${row.id} hat einen ungültigen Lückentext-Inhalt und wird übersprungen.`)
          continue
        }

        const siblingAnswers = (answersByTopic.get(row.topic) ?? []).filter(
          (answer) => normalizeWord(answer) !== normalizeWord(content.correct_answer)
        )

        const chips = buildFillInBlankChips({
          exerciseId: row.id,
          correctAnswer: content.correct_answer,
          authoredOptions: content.options,
          siblingAnswers,
        })

        if (chips.length === 0) {
          console.error(`Übung ${row.id} liefert keine Auswahl-Chips und wird übersprungen.`)
          continue
        }

        const match = vocabularyMatches.get(normalizeWord(content.correct_answer))

        exercises.push({
          id: row.id,
          lesson: row.lesson,
          topic: row.topic,
          level: row.level,
          type: 'fill_in_blank',
          content,
          chips,
          solutionAudioUrl: row.solution_audio_url ?? match?.audioUrl ?? null,
          solutionArticle: match?.article ?? null,
          hint,
          completed: progress.completed,
          score: progress.score,
          attempts: progress.attempts,
        })
        continue
      }

      if (row.type === 'multiple_choice') {
        const content = parseMultipleChoiceContent(row.content)
        if (!content) {
          console.error(`Übung ${row.id} hat einen ungültigen Multiple-Choice-Inhalt und wird übersprungen.`)
          continue
        }

        exercises.push({
          id: row.id,
          lesson: row.lesson,
          topic: row.topic,
          level: row.level,
          type: 'multiple_choice',
          content,
          hint,
          completed: progress.completed,
          score: progress.score,
          attempts: progress.attempts,
        })
        continue
      }

      // sentence_building ist im Schema angelegt, aber noch nicht als UI umgesetzt.
      console.warn(`Übungstyp "${row.type}" wird derzeit nicht dargestellt (Übung ${row.id}).`)
    }

    return exercises
  } catch (err) {
    console.error('Unerwarteter Fehler in getExercises:', err)
    return []
  }
}

/**
 * Schreibt einen Antwortversuch fort. Eine Übung gilt erst als abgeschlossen,
 * wenn sie richtig gelöst wurde – falsche Versuche erhöhen nur den Zähler und
 * schalten dadurch die Smart Hints frei.
 *
 * Bewusst ohne revalidatePath: Ein Refresh mitten im Übungsdurchlauf würde die
 * Übungsliste neu filtern und den Lernenden aus dem Kontext reißen.
 */
export async function recordExerciseAttempt(
  input: RecordExerciseAttemptInput
): Promise<RecordExerciseAttemptResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return { success: false, attempts: 0 }

    const parsed = z.object({
      exerciseId: z.uuid(), answer: z.string().trim().min(1).max(1000), hintShown: z.boolean(),
    }).safeParse(input)
    if (!parsed.success) return { success: false, attempts: 0 }
    const { data, error } = await supabase.rpc('record_grammar_attempt', {
      p_exercise_id: parsed.data.exerciseId,
      p_answer: parsed.data.answer,
      p_hint_shown: parsed.data.hintShown,
    })
    if (error) {
      console.error('Grammar attempt could not be saved:', { userId: user.id, exerciseId: input.exerciseId, code: error.code })
      return { success: false, attempts: 0 }
    }
    const result = z.object({ success: z.boolean(), attempts: z.number().int(), isCorrect: z.boolean() }).safeParse(data)
    return result.success ? result.data : { success: false, attempts: 0 }
  } catch (err) {
    console.error('Unerwarteter Fehler in recordExerciseAttempt:', err)
    return { success: false, attempts: 0 }
  }
}

/**
 * Wird aufgerufen, sobald ein Übungsdurchlauf beendet ist. Erst hier werden die
 * Fortschrittsanzeigen neu berechnet, damit während des Übens nichts umspringt.
 */
export async function finishExerciseSession(level: string): Promise<{ success: boolean }> {
  try {
    revalidatePath('/[lang]/dashboard', 'page')
    revalidatePath('/[lang]/dashboard/level/[level]', 'page')
    revalidatePath('/[lang]/dashboard/level/[level]/exercises', 'page')
    return { success: true }
  } catch (err) {
    console.error(`Unerwarteter Fehler in finishExerciseSession (Level ${level}):`, err)
    return { success: false }
  }
}

/** Nur noch als Kompatibilitätsschicht – neue Aufrufer nutzen recordExerciseAttempt. */
export async function saveExerciseProgress(
  exerciseId: string,
  answer: string
): Promise<{ success: boolean }> {
  const result = await recordExerciseAttempt({ exerciseId, answer, hintShown: false })
  return { success: result.success }
}
