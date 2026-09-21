/**
 * Clientseitig gespeicherte „Lernkasten"-Auswahl: Welche Lektionen eines
 * Sprachniveaus der Lernende aktuell in seiner aktiven Lerneinheit hat.
 *
 * Persistiert je Niveau im `localStorage`, damit die Zusammenstellung einen
 * Reload und die Wiederkehr übersteht (gerätegebunden, bewusst kein
 * Server-State – die Auswahl ist eine reine UI-Vorliebe, kein Lernfortschritt).
 */

const STORAGE_PREFIX = 'sitov_lernkasten'
const AUTOSTART_KEY = 'sitov_vocab_autostart'
const STUDY_MODE_KEY = 'sitov_vocab_study_mode'

function storageKey(level: string): string {
  return `${STORAGE_PREFIX}:${level}`
}

function isBrowser(): boolean {
  // Accessing the storage property itself can throw (blocked storage/sandbox).
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  } catch {
    return false
  }
}

function isSessionBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

/**
 * Lädt die gespeicherte Lektions-Auswahl eines Niveaus.
 *
 * Gibt `null` zurück, wenn noch nie etwas gespeichert wurde (Erstbesuch →
 * der Aufrufer kann dann einen sinnvollen Standard setzen), und ein (ggf.
 * leeres) Array, wenn eine Auswahl – auch bewusst geleert – vorliegt.
 * Ungültige Daten führen niemals zu einem Absturz, sondern zu `null`.
 */
export function loadLernkastenSelection(level: string): string[] | null {
  if (!isBrowser()) return null

  try {
    const raw = window.localStorage.getItem(storageKey(level))
    if (raw === null) return null

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null

    return parsed.filter((entry): entry is string => typeof entry === 'string')
  } catch (err) {
    console.error("Lernkasten-Auswahl für Niveau konnte nicht geladen werden:")
    return null
  }
}

/** Speichert die Lektions-Auswahl. Fehler werden geloggt, aber nie geworfen. */
export function saveLernkastenSelection(level: string, lessons: string[]): void {
  if (!isBrowser()) return

  try {
    window.localStorage.setItem(storageKey(level), JSON.stringify(lessons))
  } catch (err) {
    console.error("Lernkasten-Auswahl für Niveau konnte nicht gespeichert werden:")
  }
}

/**
 * Merkt sich, dass nach der Ersteinstufung sofort die Lernsession starten soll.
 * `sessionStorage`, damit ein Reload der Übersichtsseite den Start nicht doppelt auslöst.
 */
export function markVocabularyAutostart(level: string): void {
  if (!isSessionBrowser()) return

  try {
    window.sessionStorage.setItem(AUTOSTART_KEY, level)
  } catch (err) {
    console.error("Autostart-Marke für Niveau konnte nicht gesetzt werden:")
  }
}

export function hasVocabularyAutostart(level: string): boolean {
  if (!isSessionBrowser()) return false

  try {
    return window.sessionStorage.getItem(AUTOSTART_KEY) === level
  } catch (err) {
    console.error("Autostart-Marke für Niveau konnte nicht gelesen werden:")
    return false
  }
}

/** Löscht die Autostart-Marke, nachdem die Session tatsächlich gestartet wurde. */
export function consumeVocabularyAutostart(level: string): void {
  if (!isSessionBrowser()) return

  try {
    if (window.sessionStorage.getItem(AUTOSTART_KEY) === level) {
      window.sessionStorage.removeItem(AUTOSTART_KEY)
    }
  } catch (err) {
    console.error("Autostart-Marke für Niveau konnte nicht gelöscht werden:")
  }
}

/**
 * Bevorzugter Abfrageweg für Karten, bei denen der Lernende die Wahl hat
 * (eigene Sprache → Deutsch, Wortkarten).
 *
 * Bewusst gerätegebunden im `localStorage` und nicht auf dem Server: Der Weg
 * durch eine Karte ist eine Vorliebe, kein Lernstand. Wer am Telefon lieber
 * aufdeckt und am Rechner tippt, soll das dürfen.
 *
 * Standard ist die Karteikarte: Sie ist der niedrigschwellige Einstieg, und
 * der Umschalter macht den aktiven Abruf jederzeit erreichbar.
 */
export function loadStudyMode(): 'flashcard' | 'typed' {
  if (!isBrowser()) return 'flashcard'

  try {
    return window.localStorage.getItem(STUDY_MODE_KEY) === 'typed' ? 'typed' : 'flashcard'
  } catch (err) {
    console.error('Abfragemodus konnte nicht geladen werden:')
    return 'flashcard'
  }
}

export function saveStudyMode(mode: 'flashcard' | 'typed'): void {
  if (!isBrowser()) return

  try {
    window.localStorage.setItem(STUDY_MODE_KEY, mode)
  } catch (err) {
    console.error('Abfragemodus konnte nicht gespeichert werden:')
  }
}
