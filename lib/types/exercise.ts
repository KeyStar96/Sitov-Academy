import type { Json } from '@/supabase/database.types'
import type { AnswerGrade } from '@/lib/answer-grading'

export const EXERCISE_TYPES = ['fill_in_blank', 'multiple_choice', 'sentence_building'] as const
export type ExerciseType = (typeof EXERCISE_TYPES)[number]

export const GERMAN_ARTICLES = ['der', 'die', 'das'] as const
export type GermanArticle = (typeof GERMAN_ARTICLES)[number]

/**
 * Anzahl der Fehlversuche, ab der ein Smart Hint eingeblendet wird.
 * Geragogik: Lernende sollen nie im Blindflug raten müssen.
 */
export const SMART_HINT_THRESHOLD = 2

/** Ab hier wird der konkretere Buchstaben-Hinweis gezeigt. */
export const SMART_HINT_LETTER_THRESHOLD = 3

export type LocalizedText = Partial<Record<string, string>>

export interface FillInBlankContent {
  /** Missing only in legacy content, which remains editable in the CMS. */
  target_form?: string[]
  instruction?: string
  text_before: string
  text_after: string
  correct_answer: string
  /** Von der Lehrkraft gepflegte Auswahl-Chips. Fehlt sie, werden Chips generiert. */
  options?: string[]
  /** Liste aller als korrekt gewerteten Antworten. */
  accepted_answers?: string[]
  /** Optionaler Hinweis (z.B. Stammformen), der direkt bei der Lücke angezeigt wird. */
  gap_hint?: string
  /** Überschreibt den automatisch abgeleiteten Smart Hint. */
  smart_hint?: LocalizedText | string
}

export interface MultipleChoiceContent {
  target_form?: string[]
  instruction?: string
  question: string
  options: string[]
  correct_answer: string
  explanation?: LocalizedText | string
}

export interface SentenceBuildingContent {
  parts: string[]
}

export type ExerciseContent =
  | FillInBlankContent
  | MultipleChoiceContent
  | SentenceBuildingContent

interface StudentExerciseBase {
  id: string
  lesson: string
  topic: string
  level: string
  translationPrompt?: string
  promptLanguage?: string
  /** Kontrastiver Hinweis als lokalisierbares JSON. */
  hint: LocalizedText | null
  completed: boolean
  score: number
  /** Persistierte Fehlversuche, damit Smart Hints einen Reload überleben. */
  attempts: number
}

export interface FillInBlankExercise extends StudentExerciseBase {
  type: 'fill_in_blank'
  content: FillInBlankContent
  /** Serverseitig aufgelöste Tipp-Chips – enthält immer die richtige Lösung. */
  chips: string[]
  /** Native Audio-Spur der Lösung, sonst greift die Web-Speech-API im Client. */
  solutionAudioUrl: string | null
  /** Artikel der Lösung aus der Vokabelbank – Grundlage des Genus-Hinweises. */
  solutionArticle: string | null
}

export interface MultipleChoiceExercise extends StudentExerciseBase {
  type: 'multiple_choice'
  content: MultipleChoiceContent
}

export type StudentExercise = FillInBlankExercise | MultipleChoiceExercise

/** Zusätzliche Metadaten, die der Client bei jedem Antwortversuch mitliefert. */
export interface RecordExerciseAttemptInput {
  exerciseId: string
  answer: string
  /** True, wenn vor diesem Versuch ein Smart Hint sichtbar war. */
  hintShown: boolean
}

export type RecordExerciseAttemptResult = ({
  success: true
  isCorrect: boolean
  score: number
  /** Gesamtzahl der Versuche nach dieser Antwort. */
  attempts: number
} & AnswerGrade) | { success: false; attempts: number }

export interface ConfirmedExerciseAttempt {
  answer: string
  result: Extract<RecordExerciseAttemptResult, { success: true }>
}

/**
 * Strukturierter Hinweis statt fertigem Text: Die Übersetzung passiert erst in
 * der UI über die Dictionaries, damit keine Strings im Code festhängen.
 */
export type SmartHintDescriptor =
  | { kind: 'custom'; text: string }
  | { kind: 'gender'; article: GermanArticle }
  | { kind: 'noun'; length: number }
  | { kind: 'verb'; length: number }
  | { kind: 'first_letter'; letter: string; length: number }

function isRecord(value: Json | undefined): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: Json | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function asLocalizedText(value: Json | undefined): LocalizedText | string | undefined {
  if (typeof value === 'string') return value
  if (isRecord(value)) {
    const result: LocalizedText = {}
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string') result[k] = v
    }
    return result
  }
  return undefined
}

function asStringArray(value: Json | undefined): string[] | null {
  if (!Array.isArray(value)) return null
  const strings = value.filter((entry): entry is string => typeof entry === 'string')
  return strings.length === value.length ? strings : null
}

/** No inferred targets: legacy/invalid authored values remain incomplete. */
export function readTargetForms(content: Json): string[] | null {
  if (!isRecord(content)) return null
  const targets = asStringArray(content.target_form)
  return targets?.length && targets.every(value => value.trim().length > 0) ? targets.map(value => value.trim()) : null
}

export function parseFillInBlankContent(value: Json): FillInBlankContent | null {
  if (!isRecord(value)) return null

  const correctAnswer = asString(value.correct_answer)
  if (!correctAnswer || correctAnswer.trim().length === 0) return null

  const options = asStringArray(value.options)
  const smartHint = asLocalizedText(value.smart_hint)
  const instruction = asString(value.instruction)

  return {
    ...(readTargetForms(value) ? { target_form: readTargetForms(value)! } : {}),
    ...(instruction ? { instruction } : {}),
    text_before: asString(value.text_before) ?? '',
    text_after: asString(value.text_after) ?? '',
    correct_answer: correctAnswer,
    ...(options && options.length > 0 ? { options } : {}),
    ...(value.accepted_answers && asStringArray(value.accepted_answers) ? { accepted_answers: asStringArray(value.accepted_answers)! } : {}),
    ...(asString(value.gap_hint) ? { gap_hint: asString(value.gap_hint)! } : {}),
    ...(smartHint ? { smart_hint: smartHint } : {}),
  }
}

/** Nutzlast für das Anlegen einer Übung im CMS. */
export interface AddExerciseInput {
  level: string
  lesson: string
  topic: string
  type: ExerciseType
  hint: LocalizedText | null
  solution_audio_url: string | null
  content: ExerciseContent
}

/**
 * Überführt einen typisierten Übungsinhalt in die JSONB-Darstellung der
 * Datenbank. Der Round-Trip über JSON entfernt `undefined`-Felder und stellt
 * sicher, dass nur serialisierbare Werte in der Spalte landen.
 */
export function toJsonContent(content: ExerciseContent): Json {
  return JSON.parse(JSON.stringify(content)) as Json
}

export function parseMultipleChoiceContent(value: Json): MultipleChoiceContent | null {
  if (!isRecord(value)) return null

  const question = asString(value.question)
  const correctAnswer = asString(value.correct_answer)
  const options = asStringArray(value.options)

  if (!question || !correctAnswer || !options || options.length < 2) return null

  const explanation = asLocalizedText(value.explanation)
  const instruction = asString(value.instruction)
  return { question, options, correct_answer: correctAnswer, ...(readTargetForms(value) ? { target_form: readTargetForms(value)! } : {}),
    ...(explanation ? { explanation } : {}), ...(instruction ? { instruction } : {}) }
}
