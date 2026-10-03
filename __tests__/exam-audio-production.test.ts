/** @jest-environment node */
import { createHash } from 'node:crypto'
import type { ExamProductionRow } from '@/supabase/exam-preparation.types'
import { EXAM_AUDIO_ORDERS } from '@/lib/exam-preparation/content'

jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { changeExamProductionStatus, finishExamProductionUpload, getPublishedExamAudio, loadExamAudioProductionState, prepareExamProductionUpload } from '@/lib/exam-preparation/audio-production-server'

const staffId = '67c8b6d9-a879-441a-8650-109f492d31c7'
const order = EXAM_AUDIO_ORDERS[0]
const hash = createHash('sha256').update(order.spokenText).digest('hex')
const timings = order.spokenText.trim().split(/\s+/u).map((_, index) => ({ start: index * .3, end: (index + 1) * .3 }))
let row: ExamProductionRow | null
const write = jest.fn()
const sign = jest.fn(async (path: string) => ({ data: { signedUrl: `https://storage.invalid/${path}` }, error: null }))
const list = jest.fn(async () => ({ data: [{ name: 'take.mp3', metadata: { size: 1024, mimetype: 'audio/mpeg' } }], error: null }))
const uploadSign = jest.fn(async (path: string) => ({ data: { path, token: 'upload-token' }, error: null }))

function productionQuery() {
  let operation = 'read'
  const query = {
    select: jest.fn(() => query), eq: jest.fn(() => query), order: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({ data: row, error: null })),
    update: jest.fn((input: unknown) => { operation = 'write'; write(input); return query }),
    insert: jest.fn((input: unknown) => { operation = 'write'; write(input); return query }),
    then: (resolve: (result: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: operation === 'write' ? [{ audio_id: order.audioId }] : row ? [row] : [], error: null }).then(resolve),
  }
  return query
}

function authenticate(role: 'teacher' | 'student' = 'teacher', loggedIn = true) {
  const profiles = { select: jest.fn(() => profiles), eq: jest.fn(() => profiles), single: jest.fn(async () => ({ data: { role }, error: null })) }
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: jest.fn(async () => ({ data: { user: loggedIn ? { id: staffId } : null } })) }, from: jest.fn(() => profiles) } as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(createAdminClient).mockReturnValue({ from: jest.fn(() => productionQuery()), storage: { from: jest.fn(() => ({ createSignedUrl: sign, list, createSignedUploadUrl: uploadSign })) } } as unknown as ReturnType<typeof createAdminClient>)
}

beforeEach(() => {
  jest.clearAllMocks()
  authenticate()
  row = { audio_id: order.audioId, script_hash: hash, raw_path: `${staffId}/${order.audioId}/raw/take.mp3`, prepared_path: `${staffId}/${order.audioId}/prepared/take.mp3`, raw_filename: 'raw.mp3', prepared_filename: 'final.mp3', status: 'uploaded', created_by: staffId, reviewed_by: null, word_timings: timings, review_note: null, reviewed_at: null, published_at: null, updated_at: '2026-10-03T10:00:00Z' }
})

test('learner and logged-out requests cannot access the recording plan or mint upload credentials', async () => {
  authenticate('student')
  expect(await loadExamAudioProductionState()).toMatchObject({ success: false, productions: [] })
  expect(await prepareExamProductionUpload({ audioId: order.audioId, kind: 'raw', size: 1024, contentType: 'audio/mpeg' })).toMatchObject({ success: false })
  expect(uploadSign).not.toHaveBeenCalled()
  authenticate('teacher', false)
  expect(await loadExamAudioProductionState()).toMatchObject({ success: false })
})

test('upload credentials are restricted to a known human order, a private owner path and 20 MB', async () => {
  expect(await prepareExamProductionUpload({ audioId: 'not-an-order', kind: 'raw', size: 100, contentType: 'audio/mpeg' })).toMatchObject({ success: false })
  expect(await prepareExamProductionUpload({ audioId: order.audioId, kind: 'raw', size: 21 * 1024 * 1024, contentType: 'audio/mpeg' })).toMatchObject({ success: false })
  const ticket = await prepareExamProductionUpload({ audioId: order.audioId, kind: 'raw', size: 1024, contentType: 'audio/mpeg' })
  expect(ticket.success).toBe(true)
  expect(ticket.path).toMatch(new RegExp(`^${staffId}/${order.audioId}/raw/[0-9a-f-]+\\.mp3$`))
  expect(uploadSign).toHaveBeenCalledWith(ticket.path, { upsert: false })
})

test('finalization rejects another owner and prepared audio without matching real timings', async () => {
  expect(await finishExamProductionUpload({ audioId: order.audioId, kind: 'raw', path: `another-user/${order.audioId}/raw/67c8b6d9-a879-441a-8650-109f492d31c7.mp3`, filename: 'raw.mp3' })).toMatchObject({ success: false })
  expect(await finishExamProductionUpload({ audioId: order.audioId, kind: 'prepared', path: `${staffId}/${order.audioId}/prepared/67c8b6d9-a879-441a-8650-109f492d31c7.mp3`, filename: 'final.mp3', wordTimings: [{ start: 0, end: 1 }] })).toMatchObject({ success: false })
  expect(await finishExamProductionUpload({ audioId: order.audioId, kind: 'prepared', path: `${staffId}/${order.audioId}/prepared/67c8b6d9-a879-441a-8650-109f492d31c7.mp3`, filename: 'final.mp3', wordTimings: timings.map(() => ({ start: 0, end: 0 })) })).toMatchObject({ success: false })
  expect(write).not.toHaveBeenCalled()
})

test('replacing the original audio clears approval, publication and the previous final timing binding', async () => {
  const filename = '67c8b6d9-a879-441a-8650-109f492d31c7.mp3'
  list.mockResolvedValueOnce({ data: [{ name: filename, metadata: { size: 1024, mimetype: 'audio/mpeg' } }], error: null })
  const path = `${staffId}/${order.audioId}/raw/${filename}`
  expect(await finishExamProductionUpload({ audioId: order.audioId, kind: 'raw', path, filename: 'next-take.mp3' })).toEqual({ success: true })
  expect(write).toHaveBeenCalledWith(expect.objectContaining({ raw_path: path, status: 'uploaded', prepared_path: null, word_timings: null, reviewed_by: null, reviewed_at: null, review_note: null, published_at: null }))
})

test('publication requires an existing, current-script audio review with measured timing', async () => {
  expect(await changeExamProductionStatus({ audioId: order.audioId, status: 'published' })).toMatchObject({ success: false })
  expect(write).not.toHaveBeenCalled()
  row = { ...row!, status: 'reviewed', reviewed_by: staffId, reviewed_at: '2026-10-03T11:00:00Z', review_note: 'Wortlaut, Zeitmarken und Nutzungsfreigabe geprüft.' }
  expect(await changeExamProductionStatus({ audioId: order.audioId, status: 'published' })).toEqual({ success: true })
  expect(write).toHaveBeenCalledWith(expect.objectContaining({ status: 'published', reviewed_by: staffId, review_note: row.review_note }))
  write.mockClear()
  row.script_hash = 'an-older-script'
  expect(await changeExamProductionStatus({ audioId: order.audioId, status: 'published' })).toMatchObject({ success: false })
  expect(write).not.toHaveBeenCalled()
})

test('review requires all concrete checks and a saved review note', async () => {
  expect(await changeExamProductionStatus({ audioId: order.audioId, status: 'reviewed', checks: [true, true, true, true, true, false], reviewNote: 'Wortlaut geprüft.' })).toMatchObject({ success: false })
  expect(write).not.toHaveBeenCalled()
  expect(await changeExamProductionStatus({ audioId: order.audioId, status: 'reviewed', checks: Array(6).fill(true), reviewNote: 'Wortlaut, Aufgaben und Stimmfreigabe geprüft.' })).toEqual({ success: true })
  expect(write).toHaveBeenCalledWith(expect.objectContaining({ status: 'reviewed', reviewed_by: staffId, published_at: null }))
})

test('student resolver serves only the published final file, including versioned audio IDs', async () => {
  row = { ...row!, status: 'published', reviewed_by: staffId, reviewed_at: '2026-10-03T11:00:00Z', published_at: '2026-10-03T12:00:00Z', review_note: 'Freigegeben.' }
  const assets = await getPublishedExamAudio()
  expect(assets[order.audioId]).toMatchObject({ src: expect.stringContaining('/prepared/'), wordTimings: timings })
  expect(assets[order.tasks[0].audio!.id]).toEqual(assets[order.audioId])
  expect(sign).not.toHaveBeenCalledWith(row.raw_path, expect.anything())
  row.script_hash = 'old'
  expect(await getPublishedExamAudio()).toEqual({})
})
