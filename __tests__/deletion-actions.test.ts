/** @jest-environment node */
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getPronunciationConversations, setPronunciationMessageHidden, setPronunciationSubmissionHidden } from '@/app/actions/pronunciation-conversations'
import { staffConversationStatus } from '@/lib/pronunciation-conversations'
import { deleteStudentProfile, getAdminNavCounts } from '@/app/actions/admin'
import { deleteOwnProfile } from '@/app/actions/profile'

const staff = '6aab2f11-3456-4234-8234-123456789012'
const student = '7aab2f11-3456-4234-8234-123456789012'
const thread = '3aab2f11-3456-4234-8234-123456789012'
const recording = `${student}/2aab2f11-3456-4234-8234-123456789012.webm`
const reply = `${staff}/1aab2f11-3456-4234-8234-123456789012.webm`
const mockGetUser = jest.fn()
const mockRpc = jest.fn()
const mockSignOut = jest.fn()
const mockRemove = jest.fn()
const mockBucket = jest.fn(() => ({ remove: mockRemove }))
const mockFrom = jest.fn()
const mockSignedUrl = jest.fn(async (path: string) => ({ data: { signedUrl: `https://files.test/${path}` }, error: null }))
const mockSignedUrls = jest.fn(async (paths: string[]) => ({ data: paths.map(path => ({ path, signedUrl: `https://files.test/${path}`, error: null })), error: null }))
const mockClient = { auth: { getUser: mockGetUser, signOut: mockSignOut }, rpc: mockRpc, from: mockFrom, storage: { from: jest.fn(() => ({ createSignedUrl: mockSignedUrl, createSignedUrls: mockSignedUrls })) } }
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn(async () => mockClient) }))
const mockAdminFrom = jest.fn()
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn(() => ({ storage: { from: mockBucket }, from: mockAdminFrom })) }))
jest.mock('@/lib/admin-new-students', () => ({ loadUnassignedStudents: jest.fn(async () => []) }))
jest.mock('@/lib/storage-public-url', () => ({ publicStorageUrl: (url: string) => url }))
jest.mock('@/lib/mail', () => ({ queueTransactionalEmail: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: jest.fn(() => { throw new Error('NEXT_REDIRECT') }) }))

const deleted = { data: { success: true, deleted: true }, error: null }
const pending = (...names: string[]) => ({ data: { success: true, deleted: false, pendingAudio: names }, error: null })
const failure = (error: string) => ({ data: { error, message: 'Denied.' }, error: null })
const staffInput = { studentId: student, confirmation: 'DELETE_STUDENT_PROFILE' } as const
const ownInput = { confirmation: 'DELETE_LEARNING_PROFILE' } as const

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  jest.mocked(revalidatePath).mockImplementation(() => {})
  mockGetUser.mockResolvedValue({ data: { user: { id: staff } }, error: null })
  mockRpc.mockResolvedValue(deleted)
  mockRemove.mockResolvedValue({ data: [], error: null })
  mockSignOut.mockResolvedValue({ error: null })
})
afterEach(() => { jest.restoreAllMocks() })

/** Chainable PostgREST query double: every filter returns the builder, awaiting it yields `result`. */
function query(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'in', 'is', 'order']) builder[method] = jest.fn(() => builder)
  builder.single = jest.fn(async () => result)
  builder.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject)
  return builder
}
const view = (hiddenSubmissions: string[] = [], hiddenMessages: string[] = [], pendingCount = 0) => ({ data: { success: true, hiddenSubmissions, hiddenMessages, pendingCount }, error: null })

describe('staff remove pronunciation content from their own view', () => {
  const hidden = (value: boolean) => ({ data: { success: true, hidden: value }, error: null })
  it('rejects malformed input before touching the database', async () => {
    expect(await setPronunciationSubmissionHidden('recording-1', true)).toEqual({ success: false, reason: 'invalid_input' })
    expect(await setPronunciationMessageHidden('', true)).toEqual({ success: false, reason: 'invalid_input' })
    expect(await setPronunciationMessageHidden(thread, 'yes' as unknown as boolean)).toEqual({ success: false, reason: 'invalid_input' })
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })
  it('requires a verified server session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await setPronunciationSubmissionHidden(thread, true)).toEqual({ success: false, reason: 'not_authenticated' })
    expect(mockRpc).not.toHaveBeenCalled()
  })
  it('only marks the conversation for staff: no file is removed and nothing is deleted', async () => {
    mockRpc.mockResolvedValueOnce(hidden(true)).mockResolvedValueOnce(hidden(false))
    expect(await setPronunciationSubmissionHidden(thread, true)).toEqual({ success: true })
    expect(mockRpc).toHaveBeenLastCalledWith('set_pronunciation_submission_hidden', { p_submission_id: thread, p_hidden: true })
    expect(await setPronunciationSubmissionHidden(thread, false)).toEqual({ success: true })
    expect(mockRpc).toHaveBeenLastCalledWith('set_pronunciation_submission_hidden', { p_submission_id: thread, p_hidden: false })
    expect(mockRpc).toHaveBeenCalledTimes(2)
    expect(mockRemove).not.toHaveBeenCalled()
    expect(mockBucket).not.toHaveBeenCalled()
    // Only staff pages are refreshed; the learner's pages do not change.
    expect(jest.mocked(revalidatePath).mock.calls).toEqual([['/[lang]/admin', 'layout'], ['/[lang]/admin', 'layout']])
  })
  it('marks and restores a single learner message', async () => {
    mockRpc.mockResolvedValueOnce(hidden(true)).mockResolvedValueOnce(hidden(false))
    expect(await setPronunciationMessageHidden(thread, true)).toEqual({ success: true })
    expect(mockRpc).toHaveBeenLastCalledWith('set_pronunciation_message_hidden', { p_message_id: thread, p_hidden: true })
    expect(await setPronunciationMessageHidden(thread, false)).toEqual({ success: true })
    expect(mockRpc).toHaveBeenLastCalledWith('set_pronunciation_message_hidden', { p_message_id: thread, p_hidden: false })
  })
  it.each(['not_authorized', 'not_found', 'not_authenticated'] as const)('passes the database decision %s through', async reason => {
    mockRpc.mockResolvedValue(failure(reason))
    expect(await setPronunciationSubmissionHidden(thread, true)).toEqual({ success: false, reason })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it('treats transport errors, unknown codes and unexpected answers as not saved', async () => {
    for (const answer of [{ data: null, error: { code: 'PGRST202' } }, failure('request_failed'), { data: { success: true }, error: null }, hidden(false)]) {
      mockRpc.mockResolvedValueOnce(answer)
      expect(await setPronunciationMessageHidden(thread, true)).toEqual({ success: false, reason: 'save_failed' })
    }
    expect(revalidatePath).not.toHaveBeenCalled()
  })
  it('a cache refresh failure after saving cannot turn success into a failure', async () => {
    mockRpc.mockResolvedValue(hidden(true))
    jest.mocked(revalidatePath).mockImplementation(() => { throw new Error('cache unavailable') })
    expect(await setPronunciationSubmissionHidden(thread, true)).toEqual({ success: true })
  })
})

describe('what staff and learners see afterwards', () => {
  const other = '4aab2f11-3456-4234-8234-123456789012'
  const [teacherReply, followUp, question] = ['5aab2f11-0000-4234-8234-000000000001', '5aab2f11-0000-4234-8234-000000000002', '5aab2f11-0000-4234-8234-000000000003']
  const rows = [
    { id: thread, auth_user_id: student, level: 'A1.1', text_content: 'Guten Tag.', content_url: `storage://pronunciation_audio/${recording}`, status: 'pending', created_at: '2026-09-01T10:00:00Z', prompt_id: null, prompt: null,
      pronunciation_messages: [
        { id: teacherReply, sender_id: staff, sender_role: 'teacher', text_content: 'Gut!', audio_path: null, created_at: '2026-09-02T10:00:00Z', seen_at: '2026-09-02T11:00:00Z' },
        { id: followUp, sender_id: student, sender_role: 'student', text_content: '', audio_path: `storage://pronunciation_audio/${recording}`, created_at: '2026-09-03T10:00:00Z', seen_at: null },
        { id: question, sender_id: student, sender_role: 'student', text_content: 'Passt das so?', audio_path: null, created_at: '2026-09-04T10:00:00Z', seen_at: null },
      ] },
    { id: other, auth_user_id: student, level: 'A1.1', text_content: 'Hallo.', content_url: null, status: 'pending', created_at: '2026-09-05T10:00:00Z', prompt_id: null, prompt: null, pronunciation_messages: [] },
  ]
  function tables(role: 'teacher' | 'student') {
    mockFrom.mockImplementation((table: string) => table === 'profiles' ? query({ data: { role }, error: null })
      : table === 'submissions' ? query({ data: rows, error: null }) : query({ data: [{ auth_user_id: student, display_name: 'Anna', email: 'anna@example.test' }], error: null }))
  }
  it('derives the staff status from the latest message staff can still see', () => {
    expect(staffConversationStatus('pending', ['teacher', 'student'], 0)).toBe('pending')
    expect(staffConversationStatus('pending', ['student', 'teacher'], 2)).toBe('reviewed')
    expect(staffConversationStatus('pending', ['student', 'admin'], 0)).toBe('reviewed')
    // Only removed learner messages are left: the first recording still waits.
    expect(staffConversationStatus('reviewed', [], 1)).toBe('pending')
    // No message at all: the stored status stands (legacy feedback without a thread).
    expect(staffConversationStatus('reviewed', [], 0)).toBe('reviewed')
    expect(staffConversationStatus('pending', [], 0)).toBe('pending')
  })
  it('hides removed conversations and messages from staff and follows the visible conversation', async () => {
    tables('teacher')
    mockRpc.mockResolvedValue(view([other], [followUp, question], 0))
    const conversations = await getPronunciationConversations()
    expect(conversations.map(conversation => conversation.id)).toEqual([thread])
    expect(conversations[0].messages.map(message => message.id)).toEqual([`recording-${thread}`, teacherReply])
    // The stored status stays "pending" for the learner; for staff the teacher's reply is now the latest.
    expect(conversations[0].status).toBe('reviewed')
    expect(conversations[0].hasUnseen).toBe(false)
  })
  it('shows staff everything while nothing is removed or the view cannot be loaded', async () => {
    tables('teacher')
    for (const answer of [view(), { data: null, error: { code: 'PGRST202' } }, failure('request_failed')]) {
      mockRpc.mockResolvedValueOnce(answer)
      const conversations = await getPronunciationConversations()
      expect(conversations.map(conversation => conversation.id).sort()).toEqual([thread, other].sort())
      expect(conversations.find(conversation => conversation.id === thread)?.messages).toHaveLength(4)
      expect(conversations.find(conversation => conversation.id === thread)?.status).toBe('pending')
    }
  })
  it('never applies the staff view to learners: they keep every recording and message', async () => {
    tables('student')
    mockGetUser.mockResolvedValue({ data: { user: { id: student } }, error: null })
    mockRpc.mockImplementation(async (name: string) => name === 'get_staff_pronunciation_view' ? view([thread, other], [followUp, question], 0) : { data: [], error: null })
    const conversations = await getPronunciationConversations()
    expect(mockRpc).not.toHaveBeenCalledWith('get_staff_pronunciation_view')
    expect(conversations).toHaveLength(2)
    const own = conversations.find(conversation => conversation.id === thread)
    expect(own?.messages.map(message => message.id)).toEqual([`recording-${thread}`, teacherReply, followUp, question])
    expect(own?.status).toBe('pending')
    expect(own?.messages.filter(message => message.audioUrl)).toHaveLength(2)
    expect(own?.messages.find(message => message.id === `recording-${thread}`)?.audioUrl).toBe(`https://files.test/${recording}`)
    expect(own?.messages.find(message => message.id === followUp)?.audioUrl).toBe(`https://files.test/${recording}`)
    expect(mockSignedUrls).toHaveBeenCalledWith([recording], 3600)
    expect(mockSignedUrl).not.toHaveBeenCalled()
  })
  it('counts open corrections the way staff see them and falls back to the stored status', async () => {
    mockFrom.mockImplementation(() => query({ data: { role: 'teacher' }, error: null }))
    mockAdminFrom.mockImplementation(() => query({ count: 7, error: null }))
    mockRpc.mockResolvedValueOnce(view([thread], [], 5))
    expect(await getAdminNavCounts()).toEqual({ newStudents: 0, corrections: 5 })
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202' } })
    expect(await getAdminNavCounts()).toEqual({ newStudents: 0, corrections: 7 })
  })
})

describe('staff delete a learner profile', () => {
  it('needs the confirmation word and a valid identifier', async () => {
    for (const input of [{ studentId: student, confirmation: 'yes' }, { studentId: 'x', confirmation: 'DELETE_STUDENT_PROFILE' }, { studentId: student }, { ...staffInput, extra: true }])
      expect(await deleteStudentProfile(input as unknown as typeof staffInput)).toEqual({ success: false, reason: 'invalid_input' })
    expect(mockRpc).not.toHaveBeenCalled()
  })
  it('requires a verified server session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('session invalid') })
    expect(await deleteStudentProfile(staffInput)).toEqual({ success: false, reason: 'not_authenticated' })
    expect(mockRpc).not.toHaveBeenCalled()
  })
  it('lets the database decide, clears the recordings it names and refreshes staff pages', async () => {
    mockRpc.mockResolvedValueOnce(pending(recording)).mockResolvedValueOnce(deleted)
    expect(await deleteStudentProfile(staffInput)).toEqual({ success: true })
    expect(mockRpc).toHaveBeenCalledWith('delete_student_learning_profile', { p_student_id: student, p_confirmation: 'DELETE_STUDENT_PROFILE' })
    expect(mockRemove).toHaveBeenCalledWith([recording])
    expect(revalidatePath).toHaveBeenCalledWith('/[lang]/admin', 'layout')
  })
  it.each(['not_authorized', 'conflict', 'not_found'] as const)('reports %s without removing files', async reason => {
    mockRpc.mockResolvedValue(failure(reason))
    expect(await deleteStudentProfile(staffInput)).toEqual({ success: false, reason })
    expect(mockRemove).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('learners delete their own profile', () => {
  beforeEach(() => { mockGetUser.mockResolvedValue({ data: { user: { id: student } }, error: null }) })
  it('needs the confirmation word', async () => {
    for (const input of [{ confirmation: 'DELETE_STUDENT_PROFILE' }, { confirmation: 'yes' }, {}, { ...ownInput, userId: staff }])
      expect(await deleteOwnProfile('de', input as unknown as typeof ownInput)).toEqual({ success: false, reason: 'invalid_input' })
    expect(mockRpc).not.toHaveBeenCalled()
  })
  it('falls back to the default language for the login page instead of trusting an unknown one', async () => {
    await expect(deleteOwnProfile('//evil.example', ownInput)).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/de/login?status=profile_deleted')
  })
  it('requires a verified server session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await deleteOwnProfile('de', ownInput)).toEqual({ success: false, reason: 'not_authenticated' })
    expect(mockRpc).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })
  it('sends no user identifier, clears the session and leads to the login page with a confirmation', async () => {
    mockRpc.mockResolvedValueOnce(pending(recording)).mockResolvedValueOnce(deleted)
    await expect(deleteOwnProfile('ru', ownInput)).rejects.toThrow('NEXT_REDIRECT')
    expect(mockRpc).toHaveBeenCalledWith('delete_own_learning_profile', { p_confirmation: 'DELETE_LEARNING_PROFILE' })
    expect(mockRemove).toHaveBeenCalledWith([recording])
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(redirect).toHaveBeenCalledWith('/ru/login?status=profile_deleted')
  })
  it('keeps the session and stays on the page when the delete did not happen', async () => {
    mockRpc.mockResolvedValue(failure('conflict'))
    expect(await deleteOwnProfile('de', ownInput)).toEqual({ success: false, reason: 'conflict' })
    expect(mockSignOut).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })
  it('still leaves for the login page when sign-out or the cache refresh fails after the delete', async () => {
    mockSignOut.mockRejectedValue(new Error('auth unavailable'))
    jest.mocked(revalidatePath).mockImplementation(() => { throw new Error('cache unavailable') })
    await expect(deleteOwnProfile('de', ownInput)).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/de/login?status=profile_deleted')
  })
})
