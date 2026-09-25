/**
 * Gerätegebundene Vorlieben des Vokabeltrainers im Browser-Speicher.
 *
 * Welche Lektionen in der Lernbox liegen, steht seit Migration 25 auf dem
 * Server (Schalter unter „Lektionen") und gilt so auf jedem Gerät.
 */

import { DEFAULT_ROUND_SIZE, parseRoundSize, type RoundSize } from './vocabulary-rounds'

const AUTOSTART_KEY = 'sitov_vocab_autostart'
const STUDY_MODE_KEY = 'sitov_vocab_study_mode'
const ROUND_SIZE_KEY = 'sitov_vocab_round_size'

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

/**
 * Karten pro Lernrunde. Wie der Abfrageweg eine Vorliebe dieses Geräts und
 * kein Lernstand; ohne gespeicherte Wahl gilt die kleine Standardrunde.
 */
export function loadRoundSize(): RoundSize {
  if (!isBrowser()) return DEFAULT_ROUND_SIZE

  try {
    return parseRoundSize(window.localStorage.getItem(ROUND_SIZE_KEY))
  } catch (err) {
    console.error('Rundengröße konnte nicht geladen werden:')
    return DEFAULT_ROUND_SIZE
  }
}

export function saveRoundSize(size: RoundSize): void {
  if (!isBrowser()) return

  try {
    window.localStorage.setItem(ROUND_SIZE_KEY, String(size))
  } catch (err) {
    console.error('Rundengröße konnte nicht gespeichert werden:')
  }
}
