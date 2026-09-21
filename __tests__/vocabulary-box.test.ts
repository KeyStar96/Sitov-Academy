import { computeWordBoxState, summarizeBox, summarizeLessons, phaseIntervalInDays, type DirectionProgressRow } from '@/lib/vocabulary-box'

const NOW = Date.parse('2026-06-01T09:00:00.000Z')
const PAST = '2026-05-30T09:00:00.000Z'
const FUTURE = '2026-07-01T09:00:00.000Z'

function rows(deToNative: number, nativeToDe: number, due: 'none' | 'both' | 'de' = 'none'): DirectionProgressRow[] {
  return [
    { direction: 'de_to_native', box_number: deToNative, next_review_date: due === 'none' ? FUTURE : PAST },
    { direction: 'native_to_de', box_number: nativeToDe, next_review_date: due === 'both' ? PAST : FUTURE },
  ]
}

describe('computeWordBoxState', () => {
  it('legt eine Vokabel in die Phase ihrer schwächeren Richtung', () => {
    // Das ist die ganze Regel: Wer Deutsch → Russisch schon in Phase 4 kann,
    // aber umgekehrt erst in Phase 2, steht mit der Vokabel in Phase 2.
    expect(computeWordBoxState(rows(4, 2), NOW)?.phase).toBe(2)
    expect(computeWordBoxState(rows(2, 4), NOW)?.phase).toBe(2)
  })

  it('meldet „halb gewusst", solange erst eine Richtung weiter ist', () => {
    const half = computeWordBoxState(rows(3, 2), NOW)
    expect(half?.isHalfKnown).toBe(true)
    expect(half?.clearedDirections).toBe(1)

    const even = computeWordBoxState(rows(2, 2), NOW)
    expect(even?.isHalfKnown).toBe(false)
    expect(even?.clearedDirections).toBe(0)
  })

  it('gilt erst als gelernt, wenn beide Richtungen im Archiv sind', () => {
    // Box 7 ist der terminale Zustand. Eine Richtung allein genügt nicht.
    const onlyOne = computeWordBoxState(rows(7, 6), NOW)
    expect(onlyOne?.isLearned).toBe(false)
    expect(onlyOne?.phase).toBe(6)
    expect(onlyOne?.isHalfKnown).toBe(true)

    const both = computeWordBoxState(rows(7, 7), NOW)
    expect(both?.isLearned).toBe(true)
    expect(both?.isHalfKnown).toBe(false)
  })

  it('ist fällig, sobald eine der beiden Richtungen fällig ist', () => {
    expect(computeWordBoxState(rows(2, 2, 'de'), NOW)?.isDue).toBe(true)
    expect(computeWordBoxState(rows(2, 2), NOW)?.isDue).toBe(false)
  })

  it('gehört in kein Fach, solange nicht beide Richtungen angelegt sind', () => {
    // Genau dieser Fall trennt „noch nicht aufgenommen" von Phase 1.
    expect(computeWordBoxState([{ direction: 'de_to_native', box_number: 1, next_review_date: PAST }], NOW)).toBeNull()
    expect(computeWordBoxState([], NOW)).toBeNull()
  })

  it('verträgt kaputte Werte aus der Datenbank', () => {
    const state = computeWordBoxState([
      { direction: 'de_to_native', box_number: null, next_review_date: null },
      { direction: 'native_to_de', box_number: 99, next_review_date: null },
      { direction: 'unbekannt', box_number: 3, next_review_date: null },
    ], NOW)
    expect(state?.phase).toBe(1)
    expect(state?.isDue).toBe(false)
  })
})

describe('summarizeBox', () => {
  it('zählt Fächer, halb Gewusstes und Fälliges getrennt', () => {
    const summary = summarizeBox([
      computeWordBoxState(rows(1, 1, 'de'), NOW),
      computeWordBoxState(rows(2, 1), NOW),
      computeWordBoxState(rows(3, 3), NOW),
      computeWordBoxState(rows(7, 7), NOW),
      null,
    ])

    expect(summary.total).toBe(5)
    expect(summary.untouched).toBe(1)
    expect(summary.learned).toBe(1)
    expect(summary.inPhases).toBe(3)
    expect(summary.due).toBe(1)
    expect(summary.buckets.map(bucket => [bucket.key, bucket.count, bucket.halfKnown, bucket.due])).toEqual([
      [1, 2, 1, 1],
      [2, 0, 0, 0],
      [3, 1, 0, 0],
      [4, 0, 0, 0],
      [5, 0, 0, 0],
      [6, 0, 0, 0],
      ['learned', 1, 0, 0],
    ])
  })

  it('belohnt den halben Schritt im Gesamtfortschritt', () => {
    // Wer eine Richtung geschafft hat, ist weiter als jemand, der keine hat.
    const plain = summarizeBox([computeWordBoxState(rows(2, 2), NOW)])
    const half = summarizeBox([computeWordBoxState(rows(3, 2), NOW)])
    expect(half.percent).toBeGreaterThan(plain.percent)
    expect(summarizeBox([computeWordBoxState(rows(7, 7), NOW)]).percent).toBe(100)
    expect(summarizeBox([null]).percent).toBe(0)
    expect(summarizeBox([]).percent).toBe(0)
  })
})

describe('phaseIntervalInDays', () => {
  it('nennt die Ruhezeit jeder Phase und keine für das Archiv', () => {
    expect([1, 2, 3, 4, 5, 6].map(phase => phaseIntervalInDays(phase as 1))).toEqual([1, 1, 3, 9, 29, 90])
    expect(phaseIntervalInDays('learned')).toBe(0)
  })
})

describe('summarizeLessons', () => {
  it('zählt je Lektion mit denselben Begriffen wie die Fächer-Übersicht', () => {
    const stats = summarizeLessons([
      { lesson: 'Lektion 2', state: computeWordBoxState(rows(1, 1, 'de'), NOW) },
      { lesson: 'Lektion 2', state: computeWordBoxState(rows(7, 7), NOW) },
      { lesson: 'Lektion 2', state: null },
      { lesson: 'Lektion 10', state: computeWordBoxState(rows(3, 2), NOW) },
    ])

    // Numerisch sortiert: „Lektion 2" vor „Lektion 10".
    expect(stats.map(stat => stat.lesson)).toEqual(['Lektion 2', 'Lektion 10'])
    expect(stats[0]).toEqual({ lesson: 'Lektion 2', total: 3, active: 1, learned: 1, untouched: 1, due: 1 })
    expect(stats[1]).toEqual({ lesson: 'Lektion 10', total: 1, active: 1, learned: 0, untouched: 0, due: 0 })
  })

  it('bleibt bei leerer Eingabe leer', () => {
    expect(summarizeLessons([])).toEqual([])
  })
})
