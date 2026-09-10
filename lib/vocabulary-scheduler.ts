/**
 * Interleave independently due directions by source word. A selection can make
 * a previously safe queue unsafe, so callers run this AFTER filtering lessons.
 * Unplaceable cards stay due; never invent filler reviews or consume progress.
 */
export function scheduleVocabularyCards<T extends { card: { id: string } }>(
  input: readonly T[],
  previousCardId: string | null = null,
): { cards: T[]; deferredCount: number } {
  const groups = new Map<string, T[]>()
  input.forEach(card => {
    const group = groups.get(card.card.id) ?? []
    group.push(card)
    groups.set(card.card.id, group)
  })
  const cards: T[] = []
  let previous = previousCardId
  while (cards.length < input.length) {
    let selected: string | null = null
    let largest = 0
    // Map insertion order retains the original due-order for equal groups.
    for (const [id, group] of groups) {
      if (id !== previous && group.length > largest) {
        selected = id
        largest = group.length
      }
    }
    if (selected === null) break
    const next = groups.get(selected)?.shift()
    if (!next) break
    cards.push(next)
    previous = selected
  }
  return { cards, deferredCount: input.length - cards.length }
}
