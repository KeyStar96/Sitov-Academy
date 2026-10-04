import { requiresSitovRecordingConsent } from '@/lib/sitov-recording-consent'

it.each(['german', 'speaking', 'online', undefined, null])('records online groups without a private category: %s', category => {
  expect(requiresSitovRecordingConsent({ type: 'online', category })).toBe(true)
})

it('excludes online private instruction', () => {
  expect(requiresSitovRecordingConsent({ type: 'online', category: 'private' })).toBe(false)
})

it.each(['german', 'speaking', 'online', 'private', undefined, null])('excludes every presence course: %s', category => {
  expect(requiresSitovRecordingConsent({ type: 'presence', category })).toBe(false)
})
