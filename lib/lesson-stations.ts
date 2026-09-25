import type { LessonStation } from '@/lib/learning-status-server'

export type StationState = 'done' | 'current' | 'open'

export interface PathStation extends LessonStation {
  /** Übersetzte Anzeige („Lektion 1", „Урок 1"). */
  label: string
  number: number
  state: StationState
}

/**
 * Stationen unter „Lektionen" (Modus Vokabeln): „geschafft" ist eine Lektion, sobald
 * alle ihre Wörter im Karteikasten liegen — das Festigen läuft danach in der
 * Lernbox weiter. „Jetzt dran" ist die erste Lektion mit neuen Wörtern.
 */
export function toStations(lessons: readonly LessonStation[], label: (lesson: string) => string): PathStation[] {
  let currentAssigned = false
  return lessons.map((lesson, index) => {
    const number = Number(lesson.lesson.match(/(\d+)/)?.[1] ?? index + 1)
    const done = lesson.total > 0 && lesson.untouched === 0
    const state: StationState = done ? 'done' : currentAssigned ? 'open' : 'current'
    if (state === 'current') currentAssigned = true
    return { ...lesson, label: label(lesson.lesson), number, state }
  })
}
