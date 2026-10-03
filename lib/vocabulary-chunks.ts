export type SitovVocabularyContentKind = 'vocabulary' | 'chunk'
export type SitovVocabularyKindFilter = 'all' | SitovVocabularyContentKind

/** Old and private word cards keep their established behavior. */
export function sitovVocabularyCardKind(card: { contentKind?: SitovVocabularyContentKind }): SitovVocabularyContentKind {
  return card.contentKind === 'chunk' ? 'chunk' : 'vocabulary'
}

export function sitovFilterVocabularyCards<T extends { contentKind?: SitovVocabularyContentKind }>(cards: T[], filter: SitovVocabularyKindFilter): T[] {
  return filter === 'all' ? cards : cards.filter(card => sitovVocabularyCardKind(card) === filter)
}

/** An attached usage chunk stays on its word card; it is never counted separately. */
export function sitovVocabularyKindCounts(cards: Array<{ contentKind?: SitovVocabularyContentKind }>) {
  const chunks = cards.filter(card => sitovVocabularyCardKind(card) === 'chunk').length
  return { all: cards.length, vocabulary: cards.length - chunks, chunk: chunks }
}

/** Avoid showing a standalone chunk's headword twice in the same card. */
export function sitovVisibleUsageChunk(word: string, chunk?: string | null): string | null {
  const value = chunk?.trim()
  if (!value) return null
  const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de')
  return normalize(value) === normalize(word) ? null : value
}
