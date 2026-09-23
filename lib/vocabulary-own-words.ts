import type { VocabularyTranslator } from '@/lib/vocabulary-i18n'
import { stripLessonPrefix } from '@/lib/utils'

/**
 * „Eigene Wörter": die private Lektion je Person und Niveau (Migration 23).
 *
 * Der Name ist in der Datenbank fest vergeben — eine CHECK-Regel verbietet ihn
 * für Kursinhalt und schreibt ihn für private Units vor. Deshalb erkennt die
 * App die Lektion sicher am Namen, auch in der Lernbox-Auswahl, die sich
 * Lektionen per Name merkt. Angezeigt wird er übersetzt.
 */
export const OWN_WORDS_LESSON = 'Eigene Wörter'

export function isOwnWordsLesson(lesson: string): boolean {
  return lesson === OWN_WORDS_LESSON
}

/** Überschrift einer Lektion: „Lektion 1 – Begrüßung" bleibt, eigene Wörter werden übersetzt. */
export function lessonTitle(lesson: string, t: VocabularyTranslator): string {
  return isOwnWordsLesson(lesson) ? t('own_words_title') : lesson
}

/** Kurzform für Untertitel und Karten: „Lektion 1 – Begrüßung" → „Lektion {1 – Begrüßung}". */
export function lessonLabel(lesson: string, t: VocabularyTranslator): string {
  return isOwnWordsLesson(lesson) ? t('own_words_title') : t('lesson_label', { lesson: stripLessonPrefix(lesson) })
}

/**
 * Trennt ein führendes deutsches Artikelwort (`der`/`die`/`das`) vom Rest,
 * damit eigene Einträge wie „das Haus" dieselben Artikelfarben und dieselbe
 * Bewertung („das Haus" als Musterlösung) bekommen wie Kursvokabeln. Ein
 * bloßer Artikel ohne Folgewort bleibt unverändert.
 */
export function parseGermanHeadword(raw: string): { article: 'der' | 'die' | 'das' | null; word_de: string } {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  const match = trimmed.match(/^(der|die|das)\s+(.+)$/i)
  if (match?.[1] && match[2]) {
    return {
      article: match[1].toLowerCase() as 'der' | 'die' | 'das',
      word_de: match[2].trim(),
    }
  }
  return { article: null, word_de: trimmed }
}
