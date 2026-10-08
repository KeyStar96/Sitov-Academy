import { sitovAudioByteRange, sitovAudioGatewayUrl, sitovAudioReferenceSchema } from '@/lib/audio/sitov-audio-reference'

const id = '00000000-0000-4000-8000-000000000001'
test('authored reference rejects arbitrary text, paths, foreign fields and unsupported kinds', () => {
  for (const reference of [
    { kind: 'reading_text', id, part: 'reference', text: 'secret' },
    { kind: 'reading_text', id, part: 'answer_key' },
    { kind: 'vocabulary_card', id: '../private.mp3', part: 'headword' },
    { kind: 'storage', id, part: 'reference' },
    { kind: 'daily_quest_preview', id: 'untrusted', level: 'A1', part: 'scene' },
  ]) expect(sitovAudioReferenceSchema.safeParse(reference).success).toBe(false)
})

test('gateway URL carries a canonical identity and text version without a storage path or bearer token', () => {
  const url = new URL(sitovAudioGatewayUrl({ kind: 'reading_text', id, part: 'reference' }, 'de', 'a'.repeat(64)), 'https://example.test')
  expect(url.pathname).toBe('/api/sitov-audio')
  expect(JSON.parse(url.searchParams.get('reference')!)).toEqual({ kind: 'reading_text', id, part: 'reference' })
  expect([...url.searchParams.keys()].sort()).toEqual(['language', 'reference', 'textSha256'])
})

test.each([
  [null, null], ['bytes=0-9', { start: 0, end: 9 }], ['bytes=95-', { start: 95, end: 99 }],
  ['bytes=-4', { start: 96, end: 99 }], ['bytes=-200', { start: 0, end: 99 }], ['bytes=0-999', { start: 0, end: 99 }],
  ['bytes=100-', 'unsatisfiable'], ['bytes=4-3', 'unsatisfiable'], ['bytes=-0', 'unsatisfiable'],
  ['bytes=0-1,4-5', 'unsatisfiable'], ['bytes=-', 'unsatisfiable'], ['items=0-3', 'unsatisfiable'],
  ['bytes=9007199254740992-', 'unsatisfiable'],
])('handles byte range %s', (input, expected) => expect(sitovAudioByteRange(input as string | null, 100)).toEqual(expected))
