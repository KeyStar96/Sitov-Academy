/** Grundlage für die Dashboard-Benachrichtigung. */
export interface UnseenFeedbackSummary {
  count: number
  /** Sprachniveau der jüngsten ungelesenen Rückmeldung, für die Verlinkung. */
  latestLevel: string | null
}
