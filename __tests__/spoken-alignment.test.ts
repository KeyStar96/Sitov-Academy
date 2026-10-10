import { validPreparedAlignment, validSpokenAlignment } from '@/lib/audio/spoken-alignment'
const alignment = { version: 1, displayText: 'Es ist 5:30 Uhr.', spokenText: 'Es ist fünf Uhr dreißig.', groups: [{ display: [0, 2], spoken: [0, 2] }, { display: [2, 4], spoken: [2, 5] }] }
const timings = Array.from({ length: 5 }, (_, i) => ({ start: i, end: i + 0.5 }))
it('accepts real reordered Uhr timings without exporting display timings', () => {
  expect(validSpokenAlignment(alignment, timings, alignment.displayText)).toEqual(alignment)
  expect(validPreparedAlignment({ spokenAlignment: alignment as never, spokenWordTimings: timings }, alignment.displayText)).toBe(true)
  expect(validPreparedAlignment({ spokenAlignment: alignment as never, spokenWordTimings: timings, wordTimings: timings }, alignment.displayText)).toBe(false)
})
it('accepts 8:59 expansion', () => {
  const v = { version: 1, displayText: '8:59', spokenText: 'acht Uhr neunundfünfzig', groups: [{ display: [0, 1], spoken: [0, 3] }] }
  expect(validSpokenAlignment(v, timings.slice(0, 3), v.displayText)).toEqual(v)
})
it.each([
  { ...alignment, spokenText: 'Es ist fünf Uhr vierzig.' },
  { ...alignment, spokenText: 'Es war fünf Uhr dreißig.' },
  { ...alignment, groups: alignment.groups.slice(1) },
  { ...alignment, groups: [alignment.groups[0], { display: [1, 4], spoken: [2, 5] }] },
  { ...alignment, groups: [alignment.groups[0], { display: [2, 8], spoken: [2, 5] }] },
  { ...alignment, version: '1' },
])('rejects wrong time/word, gaps, overlaps, bounds and type drift', v => {
  expect(validSpokenAlignment(v, timings, alignment.displayText)).toBeUndefined()
})
it.each([0, NaN, '0'])('rejects invalid lexical intervals %s', start => {
  const t = timings.map(x => ({ ...x })); t[0] = { start: start as number, end: 0 }
  expect(validSpokenAlignment(alignment, t, alignment.displayText)).toBeUndefined()
})
it('leaves legacy validation unchanged', () => {
  expect(validPreparedAlignment({ wordTimings: timings.slice(0, 2) }, 'Guten Tag')).toBe(true)
  expect(validPreparedAlignment({ wordTimings: timings }, 'Guten Tag')).toBe(false)
})
