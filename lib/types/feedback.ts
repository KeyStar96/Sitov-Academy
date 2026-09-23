/** Grundlage der Briefkasten-Karte auf der Startseite. */
export interface UnseenFeedbackSummary {
  count: number
  /** Sprachniveau der jüngsten ungelesenen Rückmeldung, für die Verlinkung. */
  latestLevel: string | null
  /** Die jüngste ungelesene Nachricht, direkt auf der Karte abspielbar. */
  latest: LatestTeacherReply | null
}

export interface LatestTeacherReply {
  submissionId: string
  level: string
  /** Titel des vorgelesenen Textes. */
  title: string | null
  text: string
  audioUrl: string | null
  createdAt: string
  /** Anzeigename der Lehrkraft (Migration 24); fehlt er, sagt die UI „deine Lehrkraft". */
  senderName: string | null
}
