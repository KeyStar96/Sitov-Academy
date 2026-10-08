/**
 * Gerätegebundene Vorlieben des Vokabeltrainers im Browser-Speicher.
 *
 * Welche Lektionen in der Lernbox liegen, steht seit Migration 25 auf dem
 * Server (Schalter unter „Lektionen") und gilt so auf jedem Gerät.
 */

import { parseRoundSize, type RoundSize } from './vocabulary-rounds'

const AUTOSTART_KEY = 'sitov_vocab_autostart'
const STUDY_MODE_KEY = 'sitov_vocab_study_mode'
const ROUND_SIZE_KEY = 'sitov_vocab_round_size'
const SITOV_PREFERENCE_EVENT = 'sitov:vocabulary:preferences-changed'
const sitovUnavailableChoices = new Map<string, string>()
const sitovFailedWrites = new Map<string, { value: string; previous: string | null }>()

function isSessionBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

/**
 * Merkt sich, dass nach der Ersteinstufung sofort die Lernsession starten soll.
 * `sessionStorage`, damit ein Reload der Übersichtsseite den Start nicht doppelt auslöst.
 */
export function markVocabularyAutostart(level: string): void {
  if (!isSessionBrowser()) return

  try {
    window.sessionStorage.setItem(AUTOSTART_KEY, level)
  } catch {
    console.error("Autostart-Marke für Niveau konnte nicht gesetzt werden:")
  }
}

export function hasVocabularyAutostart(level: string): boolean {
  if (!isSessionBrowser()) return false

  try {
    return window.sessionStorage.getItem(AUTOSTART_KEY) === level
  } catch {
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
  } catch {
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
  return sitovReadChoice(STUDY_MODE_KEY) === 'typed' ? 'typed' : 'flashcard'
}

export function saveStudyMode(mode: 'flashcard' | 'typed'): void {
  if (mode === 'flashcard' || mode === 'typed') sitovSaveChoice(STUDY_MODE_KEY, mode)
}

/**
 * Karten pro Lernrunde. Wie der Abfrageweg eine Vorliebe dieses Geräts und
 * kein Lernstand; ohne gespeicherte Wahl gilt die kleine Standardrunde.
 */
export function loadRoundSize(): RoundSize {
  return parseRoundSize(sitovReadChoice(ROUND_SIZE_KEY))
}

export function saveRoundSize(size: RoundSize): void {
  if (parseRoundSize(size) === size) sitovSaveChoice(ROUND_SIZE_KEY, String(size))
}

function sitovReadChoice(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(key)
    const pending = sitovFailedWrites.get(key)
    if (pending?.previous === stored) return pending.value
    sitovFailedWrites.delete(key)
    return stored
  } catch {
    return sitovUnavailableChoices.get(key) ?? null
  }
}

function sitovSaveChoice(key: string, value: string): void {
  if (typeof window === 'undefined') return
  sitovUnavailableChoices.set(key, value)
  let previous: string | null = null
  try {
    previous = window.localStorage.getItem(key)
    window.localStorage.setItem(key, value)
    sitovFailedWrites.delete(key)
  } catch {
    // Apply the choice in this page even when private browsing or quota blocks storage.
    sitovFailedWrites.set(key, { value, previous })
  }
  window.dispatchEvent(new Event(SITOV_PREFERENCE_EVENT))
}

/** Profile controls and mounted trainers share changes in this tab and other tabs. */
export function subscribeVocabularyPreferences(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STUDY_MODE_KEY && event.key !== ROUND_SIZE_KEY && event.key !== null) return
    if (event.key === null) sitovFailedWrites.clear()
    else sitovFailedWrites.delete(event.key)
    onChange()
  }
  window.addEventListener(SITOV_PREFERENCE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(SITOV_PREFERENCE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}
