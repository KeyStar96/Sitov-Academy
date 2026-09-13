/** Stable identifiers for selecting lessons or individual reading texts. */
export interface AccessUnit { id: string; label: string }
export type AvailableLessonsResult = { success: true; lessons: AccessUnit[] } | { success: false }

export function grammarLessonLabel(lesson: string, topics: readonly string[]): string {
  const number = lesson.match(/(?:·\s*|Lektion\s+)(\d+)$/i)?.[1]
  const prefix = number ? `${Number(number).toString().padStart(2, '0')}` : lesson
  return topics.length ? `${prefix} · ${[...new Set(topics)].join(' / ')}` : prefix
}
