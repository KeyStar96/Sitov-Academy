/** Ein Feedback-Eintrag der Lehrkraft zu einer Einreichung. */
export interface TeacherFeedbackEntry {
  feedback_text: string
  feedback_audio_url: string | null
  created_at: string | null
  /** NULL = der Schüler hat das Feedback noch nicht geöffnet. */
  seen_at: string | null
}

/** Kurzprofil des Schülers, wie es die Lehrer-Ansicht benötigt. */
export interface SubmissionStudent {
  name: string | null
  email: string
  native_language: string | null
}

/** Die vorherige Einreichung, auf die sich ein zweiter Versuch bezieht. */
export interface SubmissionParent {
  id: string
  content_url: string | null
  created_at: string | null
  attempt_number: number | null
  teacher_feedback: TeacherFeedbackEntry[]
}

/**
 * Einreichung in der Lehrer-Ansicht.
 *
 * Wird bewusst als eigener Typ geführt statt aus dem Supabase-Select
 * abgeleitet: Die Typ-Inferenz kann `teacher_feedback` innerhalb des
 * selbstreferenzierenden `parent`-Embeds nicht auflösen. Die Daten werden
 * deshalb in `app/actions/feedback.ts` mit einer zweiten Abfrage gezielt
 * zusammengesetzt.
 */
export interface TeacherSubmission {
  id: string
  user_id: string
  type: string
  content_url: string | null
  text_content: string | null
  status: string | null
  created_at: string | null
  level: string
  parent_id: string | null
  attempt_number: number | null
  profiles: SubmissionStudent | null
  teacher_feedback: TeacherFeedbackEntry[]
  parent: SubmissionParent | null
}

/** Einreichung in der Schüler-Ansicht (Aussprache-Training). */
export interface StudentSubmission {
  id: string
  content_url: string | null
  text_content: string | null
  status: string | null
  created_at: string | null
  level: string
  attempt_number: number
  teacher_feedback: TeacherFeedbackEntry[]
  /** True, wenn zu dieser Einreichung schon ein zweiter Versuch existiert. */
  hasResubmission: boolean
  /** True, solange mindestens ein Feedback noch nicht geöffnet wurde. */
  hasUnseenFeedback: boolean
}

/** Grundlage für die Dashboard-Benachrichtigung. */
export interface UnseenFeedbackSummary {
  count: number
  /** Sprachniveau der jüngsten ungelesenen Rückmeldung, für die Verlinkung. */
  latestLevel: string | null
}

export interface SubmitAudioInput {
  url: string
  parentId?: string
  promptId?: string
  attemptNumber?: number
  level?: string
}

export interface SubmitTeacherFeedbackInput {
  submissionId: string
  feedbackText: string
  feedbackAudioUrl?: string | null
}

export interface FeedbackActionResult {
  success: boolean
  /** Nutzerfreundliche Kennung, nie eine rohe Datenbank-Meldung. */
  reason?: 'not_authenticated' | 'save_failed' | 'invalid_input'
}
