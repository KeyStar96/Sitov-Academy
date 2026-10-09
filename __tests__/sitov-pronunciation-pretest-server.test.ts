jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/lib/sitov-pronunciation-pretest-learning-links', () => ({ enrichSitovPronunciationPretestLearningLinks: jest.fn(v=>Promise.resolve(v)) }))
jest.mock('@/lib/request-session', () => ({ requestSession: jest.fn() }))
import { enrichSitovPronunciationPretestLearningLinks } from '@/lib/sitov-pronunciation-pretest-learning-links'
import { requestSession } from '@/lib/request-session'
import { loadSitovPronunciationPretests, startSitovPronunciationPretestServer, saveSitovPronunciationPretestAnswersServer, createSitovPronunciationReplyUploadTicketServer, loadSitovPronunciationPretestAttempt, submitSitovPronunciationPretestServer } from '@/lib/sitov-pronunciation-pretest-server'
const id = '00000000-0000-4000-8000-000000000001', requestId = '00000000-0000-4000-8000-000000000002'
const rpc = jest.fn()
function setup(data: unknown, user: { id: string } | null = { id }) {
  rpc.mockResolvedValue({ data, error: null })
  jest.mocked(requestSession).mockResolvedValue({ user, supabase: { rpc } } as unknown as Awaited<ReturnType<typeof requestSession>>)
}
beforeEach(() => jest.clearAllMocks())
it('rejects malformed input or injected learner/score without any RPC', async () => {
  setup({ ok: true, data: [] })
  expect((await loadSitovPronunciationPretests('invalid')).ok).toBe(false)
  expect((await startSitovPronunciationPretestServer({ textId: id, requestId, studentId: id })).ok).toBe(false)
  expect((await saveSitovPronunciationPretestAnswersServer({ attemptId: id, revision: 0, answers: {}, requestId, score: 100 })).ok).toBe(false)
  expect(rpc).not.toHaveBeenCalled()
})
it('uses authenticated RPC identity and preserves explicit errors; malformed returned data stays closed', async () => {
  setup({ ok: true, data: [] }, null)
  expect(await loadSitovPronunciationPretests('A1.1')).toEqual({ ok: false, error: 'authentication_required', retryable: false })
  setup({ ok: false, error: 'test_required', retryable: false })
  expect(await loadSitovPronunciationPretests('A1.1')).toEqual({ ok: false, error: 'test_required', retryable: false })
  setup({ ok: true, data: [{ sentence_de: 'leak' }] })
  expect(await loadSitovPronunciationPretests('A1.1')).toEqual({ ok: false, error: 'retryable_failure', retryable: true })
})
it('maps a concurrent completed start to explicit refresh conflict, never a fabricated open form', async () => {
  const version = 'a'.repeat(64), testVersion = 'b'.repeat(64), time = '2026-10-08T21:00:00Z'
  setup({ ok: true, data: { attempt: { id, textId: id, textVersion: version, testVersion, status: 'outdated', revision: 0, startedAt: time, updatedAt: time, questionIds: ['sitov.q1', 'sitov.q2', 'sitov.q3'], answers: {}, answeredCount: 0, totalCount: 3 }, result: null } })
  expect(await startSitovPronunciationPretestServer({ textId: id, requestId })).toEqual({ ok: false, error: 'attempt_conflict', retryable: false })
  expect(rpc).toHaveBeenCalledWith('sitov_start_pronunciation_pretest', { p_text_id: id, p_request_id: requestId })
})
it('returns refresh conflict when another tab has already passed the current form', async () => {
  const version='a'.repeat(64), testVersion='b'.repeat(64), time='2026-10-08T21:00:00Z'
  const proof={id:requestId,textId:id,textVersion:version,testVersion,passedAttemptId:id,passedAt:time,compatibilityId:null}
  const attempt={id,textId:id,textVersion:version,testVersion,status:'passed',revision:1,startedAt:time,updatedAt:time,questionIds:['sitov.q1','sitov.q2','sitov.q3'],answers:{'sitov.q1':'sitov.a','sitov.q2':'sitov.a','sitov.q3':'sitov.a'},answeredCount:3,totalCount:3}
  const result={attemptId:id,textId:id,textVersion:version,testVersion,passed:true,correct:3,total:3,competencies:[{id:'sitov.core',correct:3,total:3,required:2,met:true}],failedCompetencyIds:[],learningLinks:[],proof}
  setup({ok:true,data:{attempt,result}})
  expect(await startSitovPronunciationPretestServer({textId:id,requestId})).toEqual({ok:false,error:'attempt_conflict',retryable:false})
})
it('separates reply input/purpose from target tickets and refuses target DTO as reply result', async () => {
  setup({ ok: true, data: { ticketId: requestId, path: `${id}/${requestId}.webm`, textVersion: 'a'.repeat(64), expiresAt: '2026-10-08T21:00:00Z' } })
  expect((await createSitovPronunciationReplyUploadTicketServer({ submissionId: id, requestId, extension: 'webm' })).ok).toBe(false)
  setup({ ok: true, data: { ticketId: requestId, path: `${id}/${requestId}.webm`, submissionId: id, purpose: 'reply', expiresAt: '2026-10-08T21:00:00Z' } })
  expect((await createSitovPronunciationReplyUploadTicketServer({ submissionId: id, requestId, extension: 'webm' })).ok).toBe(true)
})

it('completed submit and get use the same optional enrichment boundary',async()=>{
 const version='a'.repeat(64),testVersion='b'.repeat(64),time='2026-10-08T21:00:00Z'
 const attempt={id,textId:id,textVersion:version,testVersion,status:'failed',revision:1,startedAt:time,updatedAt:time,questionIds:['sitov.q1','sitov.q2','sitov.q3'],answers:{'sitov.q1':'sitov.a','sitov.q2':'sitov.a','sitov.q3':'sitov.a'},answeredCount:3,totalCount:3}
 const result={attemptId:id,textId:id,textVersion:version,testVersion,passed:false,correct:1,total:3,competencies:[{id:'sitov.text.words',correct:1,total:3,required:2,met:false}],failedCompetencyIds:['sitov.text.words'],learningLinks:[],proof:null}
 setup({ok:true,data:{attempt,result}})
 expect((await loadSitovPronunciationPretestAttempt(id)).ok).toBe(true)
 expect((await submitSitovPronunciationPretestServer({attemptId:id,revision:1,answers:{},requestId})).ok).toBe(true)
 expect(enrichSitovPronunciationPretestLearningLinks).toHaveBeenCalledTimes(2)
 expect(enrichSitovPronunciationPretestLearningLinks).toHaveBeenCalledWith({attempt,result})
})
