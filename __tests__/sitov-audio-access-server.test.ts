/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/access/server', () => ({ loadLevelAccessProfile: jest.fn() }))

import { createHash } from 'node:crypto'
import { createClient } from '@/utils/supabase/server'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { resolveSitovAuthoredAudio } from '@/lib/audio/sitov-audio-access-server'

const id = '00000000-0000-4000-8000-000000000001'
const attemptId = '00000000-0000-4000-8000-000000000002'
const proofId = '00000000-0000-4000-8000-000000000003'
const sentence = 'Paul  öffnet die Tür.\n'
const textVersion = createHash('sha256').update(sentence).digest('hex')
const testVersion = 'b'.repeat(64)
const time = '2026-10-08T21:00:00Z'
const reference = { kind: 'reading_text' as const, id, part: 'reference' as const }
const available = { textId: id, unitId: id, level: 'A1.1', title: 'Die Tür', focus: null, kind: 'regular',
  textVersion, testVersion, status: 'available', lockedReason: null, attempt: null, proof: null, target: 'pretest' }
const passed = { ...available, status: 'passed', target: 'pronunciation',
  attempt: { id: attemptId, textId: id, textVersion, testVersion, status: 'passed', revision: 1,
    startedAt: time, updatedAt: time, questionIds: ['sitov.q1', 'sitov.q2', 'sitov.q3'],
    answers: { 'sitov.q1': 'sitov.a1', 'sitov.q2': 'sitov.a1', 'sitov.q3': 'sitov.a1' }, answeredCount: 3, totalCount: 3 },
  proof: { id: proofId, textId: id, textVersion, testVersion, passedAttemptId: attemptId, passedAt: time, compatibilityId: null } }

function client(catalog: unknown = passed, readable = true) {
  const row = { id, sentence_de: sentence, audio_url: `storage://pronunciation_audio/${id}/original.webm`, unit: { level: 'A1.1' } }
  const chain = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: readable ? row : null, error: null }) }
  const rpc = jest.fn().mockResolvedValue({ data: { ok: true, data: [catalog] }, error: null })
  return { raw: { from: jest.fn().mockReturnValue(chain), rpc,
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id } }, error: null }) } }, row, rpc }
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(loadLevelAccessProfile).mockResolvedValue({ role: 'student' } as Awaited<ReturnType<typeof loadLevelAccessProfile>>)
})
const session = (raw: ReturnType<typeof client>['raw']) => raw as unknown as Awaited<ReturnType<typeof createClient>>

test('an individual current proof authorizes the exact authored body and preserves a real recording', async () => {
  const { raw, row, rpc } = client()
  const audio = await resolveSitovAuthoredAudio(session(raw), reference, 'de')
  expect(audio).toMatchObject({ text: 'Paul öffnet die Tür.', recording: row.audio_url })
  expect(rpc).toHaveBeenCalledWith('sitov_get_pronunciation_pretests', { p_level: 'A1.1' })
})
test.each([available, { ...passed, textVersion: 'a'.repeat(64), proof: { ...passed.proof, textVersion: 'a'.repeat(64) },
  attempt: { ...passed.attempt, textVersion: 'a'.repeat(64) } }, { ...passed, hardOverride: true }])(
  'a missing proof, old body proof or legacy override cannot authorize target audio', async catalog => {
    const { raw } = client(catalog)
    expect(await resolveSitovAuthoredAudio(session(raw), reference, 'de')).toBeNull()
  })
test('direct RLS denial and a changed exact raw body remain closed despite a previously passed catalog', async () => {
  const denied = client(passed, false)
  expect(await resolveSitovAuthoredAudio(session(denied.raw), reference, 'de')).toBeNull()
  expect(denied.rpc).not.toHaveBeenCalled()
  const changed = client()
  changed.row.sentence_de = sentence.trim()
  expect(await resolveSitovAuthoredAudio(session(changed.raw), reference, 'de')).toBeNull()
})
