/**
 * Lernrunden der Lernbox.
 *
 * Alle heute fälligen Karten auf einmal zu lernen hieße bei 300 Karten: Ein
 * Wort, das man nicht wusste, kommt erst nach 299 anderen wieder dran. Darum
 * wird der geplante Stapel in Runden fester Größe geteilt. Falsch beantwortete
 * Karten wiederholen sich innerhalb ihrer Runde — also nach höchstens so vielen
 * Karten, wie die Runde groß ist. Nach jeder Runde entscheidet der Lernende,
 * ob er weitermacht, bis alles für heute geschafft ist.
 */

export const ROUND_SIZES = [10, 20, 30, 40, 50] as const
export type RoundSize = (typeof ROUND_SIZES)[number] | 'all'
export const ROUND_SIZE_OPTIONS: readonly RoundSize[] = [...ROUND_SIZES, 'all']
export const DEFAULT_ROUND_SIZE: RoundSize = 20

export function parseRoundSize(value: unknown): RoundSize {
  if (value === 'all') return 'all'
  const number = typeof value === 'string' ? Number(value) : value
  return (ROUND_SIZES as readonly unknown[]).includes(number) ? number as RoundSize : DEFAULT_ROUND_SIZE
}

/** Wie viele Karten eine Runde bei `total` fälligen Karten höchstens hat. */
export function roundLimit(size: RoundSize, total: number): number {
  return size === 'all' ? Math.max(total, 0) : Math.min(size, Math.max(total, 0))
}

/** Anzahl der Runden für `total` Karten; 0 Karten ergeben 0 Runden. */
export function countRounds(total: number, size: RoundSize): number {
  if (total <= 0) return 0
  return size === 'all' ? 1 : Math.ceil(total / size)
}

/**
 * Die nächste Runde aus dem bereits abwechselnd geplanten Stapel. Sie beginnt
 * nicht mit dem Wort, das gerade zuletzt dran war (z. B. dessen Gegenrichtung),
 * solange ein anderes Wort in der Runde steht.
 */
export function takeRound<T extends { card: { id: string } }>(plan: readonly T[], start: number, size: RoundSize, previousCardId: string | null): T[] {
  const round = plan.slice(start, start + roundLimit(size, plan.length - start))
  if (!previousCardId || round[0]?.card.id !== previousCardId) return round
  const swap = round.findIndex(item => item.card.id !== previousCardId)
  if (swap <= 0) return round
  const [first] = round.splice(swap, 1)
  return [first, ...round]
}
