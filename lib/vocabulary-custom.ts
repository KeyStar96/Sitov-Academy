/**
 * Clientseitig gespeicherte, selbst hinzugefügte Vokabeln je Lektion.
 *
 * Bewusst getrennt von der echten Leitner-Datenbank (`vocabulary_direction_progress`):
 * Diese Wörter haben keine `learning_vocabulary_cards`-Zeile und keinen Server-seitigen
 * Fälligkeits-Mechanismus. Sie dienen als schnelle, private Merkliste direkt im
 * Lektions-Modal (Wörterliste + Phasen-Verteilung) und überleben einen Reload
 * über `localStorage` – aber nicht den Wechsel des Browsers/Geräts.
 */

export interface CustomVocabularyCard {
  id: string
  word_de: string
  article: string | null
  translation: string
  /** Eigene Vokabeln starten immer in Phase 1 und sind nie "gelernt". */
  phase: 1
  isLearned: false
  isCustom: true
  createdAt: string
}

const STORAGE_PREFIX = 'sitov_custom_vocab'

function storageKey(level: string, lesson: string): string {
  return `${STORAGE_PREFIX}:${level}:${lesson}`
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/**
 * Trennt ein führendes deutsches Artikelwort (`der`/`die`/`das`) vom Rest,
 * damit eigene Einträge wie "das Haus" dieselben Artikelfarben nutzen wie
 * die Kursvokabeln. Ein bloßer Artikel ohne Folgewort bleibt unverändert.
 */
export function parseGermanHeadword(raw: string): { article: string | null; word_de: string } {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  const match = trimmed.match(/^(der|die|das)\s+(.+)$/i)
  if (match?.[1] && match[2]) {
    return {
      article: match[1].toLowerCase(),
      word_de: match[2].trim(),
    }
  }
  return { article: null, word_de: trimmed }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseStoredCard(entry: unknown): CustomVocabularyCard | null {
  if (!isRecord(entry)) return null
  if (typeof entry.id !== 'string' || typeof entry.word_de !== 'string') return null
  if (typeof entry.translation !== 'string') return null

  const parsedHeadword = parseGermanHeadword(entry.word_de)
  const storedArticle = typeof entry.article === 'string' && entry.article.length > 0 ? entry.article : null

  return {
    id: entry.id,
    word_de: storedArticle ? entry.word_de : parsedHeadword.word_de,
    article: storedArticle ?? parsedHeadword.article,
    translation: entry.translation,
    phase: 1,
    isLearned: false,
    isCustom: true,
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
  }
}

/**
 * Lädt die eigenen Vokabeln einer Lektion aus dem `localStorage`.
 * Gibt bei fehlendem/ungültigem Eintrag still ein leeres Array zurück –
 * eine kaputte Merkliste darf den Vokabeltrainer niemals blockieren.
 */
export function loadCustomVocabulary(level: string, lesson: string): CustomVocabularyCard[] {
  if (!isBrowser()) return []

  try {
    const raw = window.localStorage.getItem(storageKey(level, lesson))
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.flatMap((entry) => {
      const card = parseStoredCard(entry)
      return card ? [card] : []
    })
  } catch (err) {
    console.error(`Eigene Vokabeln für Lektion "${lesson}" konnten nicht geladen werden:`, err)
    return []
  }
}

function saveCustomVocabulary(level: string, lesson: string, cards: CustomVocabularyCard[]): void {
  if (!isBrowser()) return

  try {
    window.localStorage.setItem(storageKey(level, lesson), JSON.stringify(cards))
  } catch (err) {
    console.error(`Eigene Vokabeln für Lektion "${lesson}" konnten nicht gespeichert werden:`, err)
  }
}

/** Fügt eine neue eigene Vokabel hinzu und persistiert die aktualisierte Liste. */
export function addCustomVocabulary(
  level: string,
  lesson: string,
  wordDe: string,
  translation: string
): CustomVocabularyCard[] {
  const existing = loadCustomVocabulary(level, lesson)
  const headword = parseGermanHeadword(wordDe)
  const newCard: CustomVocabularyCard = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    word_de: headword.word_de,
    article: headword.article,
    translation: translation.trim(),
    phase: 1,
    isLearned: false,
    isCustom: true,
    createdAt: new Date().toISOString(),
  }

  const updated = [newCard, ...existing]
  saveCustomVocabulary(level, lesson, updated)
  return updated
}

/** Entfernt eine eigene Vokabel (z.B. bei Tippfehlern) und persistiert die Liste. */
export function removeCustomVocabulary(level: string, lesson: string, cardId: string): CustomVocabularyCard[] {
  const updated = loadCustomVocabulary(level, lesson).filter((card) => card.id !== cardId)
  saveCustomVocabulary(level, lesson, updated)
  return updated
}
