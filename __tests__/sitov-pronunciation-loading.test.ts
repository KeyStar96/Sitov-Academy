/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/access/server', () => ({ loadLevelAccessProfile: jest.fn() }))
jest.mock('@/lib/sitov-pronunciation-pretest-server', () => ({ loadSitovPronunciationPretests: jest.fn() }))

import { getPronunciationPrompts } from '@/app/actions/pronunciation'
import { createClient } from '@/utils/supabase/server'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { loadSitovPronunciationPretests } from '@/lib/sitov-pronunciation-pretest-server'
import { sitovPronunciationPretestCatalogSchema } from '@/lib/sitov-pronunciation-pretest-contract'
import { sitovPronunciationPlaybackUrls } from '@/lib/pronunciation-playback-server'

const owner = '00000000-0000-4000-8000-000000000001'
const ready = '00000000-0000-4000-8000-000000000002'
const locked = '00000000-0000-4000-8000-000000000003'
const unit = '00000000-0000-4000-8000-000000000004'
const textVersion = 'a'.repeat(64), testVersion = 'b'.repeat(64)
const attemptId = '00000000-0000-4000-8000-000000000005'
const timestamp = '2026-10-09T10:00:00Z'
// The server catalog port returns validated, current-version proof metadata, never text bodies.
const catalog = sitovPronunciationPretestCatalogSchema.parse([{
 textId:ready,unitId:unit,level:'A1.1',title:'Der Lehrer',focus:null,kind:'regular',textVersion,testVersion,
 status:'passed',lockedReason:null,target:'pronunciation',
 attempt:{id:attemptId,textId:ready,textVersion,testVersion,status:'passed',revision:1,
  startedAt:timestamp,updatedAt:timestamp,questionIds:['sitov.q1','sitov.q2','sitov.q3'],
  answers:{'sitov.q1':'sitov.a','sitov.q2':'sitov.a','sitov.q3':'sitov.a'},answeredCount:3,totalCount:3},
 proof:{id:'00000000-0000-4000-8000-000000000006',textId:ready,textVersion,testVersion,
  passedAttemptId:attemptId,passedAt:timestamp,compatibilityId:null},
},{textId:locked,unitId:unit,level:'A1.1',title:'Der Schüler',focus:null,kind:'regular',textVersion,
 testVersion:null,status:'locked',lockedReason:'authoring_not_ready',attempt:null,proof:null,target:null}])
const mockGetUser = jest.fn()
const mockRpc = jest.fn()
const mockOrder = jest.fn()
const mockQuery = { select:jest.fn().mockReturnThis(),in:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),order:mockOrder }
const mockFrom = jest.fn(() => mockQuery)
const mockSignedUrls = jest.fn()
const mockClient = {auth:{getUser:mockGetUser},rpc:mockRpc,from:mockFrom,storage:{from:jest.fn(() => ({createSignedUrls:mockSignedUrls}))}}
const previousPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const previousInternalUrl = process.env.SUPABASE_INTERNAL_URL
beforeEach(() => {
 jest.clearAllMocks()
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://academy.example/supabase'
 process.env.SUPABASE_INTERNAL_URL='http://127.0.0.1:9080'
 jest.mocked(createClient).mockResolvedValue(mockClient as never)
 jest.mocked(loadLevelAccessProfile).mockResolvedValue({role:'student',ui_language:'en',allowed_levels:['A1.1']})
 mockGetUser.mockResolvedValue({data:{user:{id:owner}},error:null})
 mockRpc.mockImplementation((name:string) => {throw new Error(`Unexpected RPC: ${name}`)})
 jest.mocked(loadSitovPronunciationPretests).mockResolvedValue({ok:true,data:catalog})
 mockOrder.mockResolvedValue({data:[{id:ready,sentence_de:'Der Lehrer kommt morgen.',focus:null,audio_url:null,unit:{id:unit,level:'A1.1',label:'Der Lehrer',sort_order:1,is_active:true,learning_levels:{cefr_level:'A1'}}}],error:null})
})
afterAll(() => {
 if (previousPublicUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL=previousPublicUrl
 if (previousInternalUrl === undefined) delete process.env.SUPABASE_INTERNAL_URL; else process.env.SUPABASE_INTERNAL_URL=previousInternalUrl
})

test('uses one verified session and reads only individually passed text IDs at the requested active level',async () => {
 expect((await getPronunciationPrompts('A1.1')).map(prompt => prompt.id)).toEqual([ready])
 expect(mockGetUser).toHaveBeenCalledTimes(1)
 expect(loadLevelAccessProfile).toHaveBeenCalledWith(mockClient,owner)
 expect(loadLevelAccessProfile).toHaveBeenCalledTimes(1)
 expect(loadSitovPronunciationPretests).toHaveBeenCalledTimes(1)
 expect(loadSitovPronunciationPretests).toHaveBeenCalledWith('A1.1')
 expect(mockFrom).toHaveBeenCalledWith('learning_reading_texts')
 expect(mockQuery.in).toHaveBeenCalledWith('id',[ready])
 expect(mockQuery.eq.mock.calls).toEqual([['unit.level','A1.1'],['unit.is_active',true]])
 expect(mockOrder).toHaveBeenCalledWith('sort_order',{referencedTable:'unit'})
 expect(mockRpc).not.toHaveBeenCalled()
})
test('keeps private bodies unread for locked and available texts without a passed proof',async () => {
 const unpassed = sitovPronunciationPretestCatalogSchema.parse([
  {...catalog[0],status:'available',target:'pretest',attempt:null,proof:null},catalog[1],
 ])
 jest.mocked(loadSitovPronunciationPretests).mockResolvedValue({ok:true,data:unpassed})
 expect(await getPronunciationPrompts('A1.1')).toEqual([])
 expect(mockFrom).not.toHaveBeenCalled()
 expect(mockClient.storage.from).not.toHaveBeenCalled()
})
test('a catalog failure keeps private text bodies unread',async () => {
 jest.mocked(loadSitovPronunciationPretests).mockResolvedValue({ok:false,error:'retryable_failure',retryable:true})
 expect(await getPronunciationPrompts('A1.1')).toEqual([])
 expect(mockFrom).not.toHaveBeenCalled()
})
test('signed-out learners cannot load access, catalog or private bodies',async () => {
 mockGetUser.mockResolvedValue({data:{user:null},error:null})
 expect(await getPronunciationPrompts('A1.1')).toEqual([])
 expect(loadLevelAccessProfile).not.toHaveBeenCalled()
 expect(loadSitovPronunciationPretests).not.toHaveBeenCalled()
 expect(mockFrom).not.toHaveBeenCalled()
})
test('denied trainer access fails closed before catalog or text reads',async () => {
 jest.mocked(loadLevelAccessProfile).mockResolvedValue({role:'student',ui_language:'en',allowed_levels:[]})
 expect(await getPronunciationPrompts('A1.1')).toEqual([])
 expect(loadSitovPronunciationPretests).not.toHaveBeenCalled()
 expect(mockFrom).not.toHaveBeenCalled()
 expect(mockRpc).not.toHaveBeenCalled()
})
test('catalog fixtures reject foreign text, stale version and unrelated attempt proofs',() => {
 for (const patch of [{textId:locked},{textVersion:'c'.repeat(64)},{testVersion:'c'.repeat(64)},{passedAttemptId:locked}]) {
  expect(sitovPronunciationPretestCatalogSchema.safeParse([
   {...catalog[0],proof:{...catalog[0].proof,...patch}},
  ]).success).toBe(false)
 }
})
test('teacher lesson restrictions remain enforced after narrowing the passed query',async () => {
 jest.mocked(loadLevelAccessProfile).mockResolvedValue({role:'student',ui_language:'en',allowed_levels:['A1.1'],trainer_grants:[{level:'A1.1',trainer:'pronunciation',enabled:true,unit_ids:[locked]}]})
 expect(await getPronunciationPrompts('A1.1')).toEqual([])
 expect(mockQuery.in).toHaveBeenCalledWith('id',[ready])
})
test('unexpected text rows cannot escape the passed-ID filter',async () => {
 mockOrder.mockResolvedValue({data:[{id:locked,sentence_de:'Privater Text.',focus:null,audio_url:null,
  unit:{id:unit,level:'A1.1',label:'Der Schüler',sort_order:1,is_active:true,learning_levels:{cefr_level:'A1'}}}],error:null})
 expect(await getPronunciationPrompts('A1.1')).toEqual([])
})

test('batch signing preserves permitted recordings while denied, invalid and unexpected references stay unavailable',async () => {
 const good=`${owner}/${ready}.webm`, denied=`${owner}/${locked}.webm`, unexpected=`${owner}/${unit}.webm`
 mockSignedUrls.mockResolvedValue({data:[
  {path:good,error:null,signedUrl:`http://127.0.0.1:9080/storage/v1/object/sign/pronunciation_audio/${good}?token=a%2Bb%3D`},
  {path:denied,error:'Object not found',signedUrl:null},
  {path:unexpected,error:null,signedUrl:'https://unexpected.example/recording.webm'},
 ],error:null})
 const log=jest.spyOn(console,'error').mockImplementation(() => {})
 try {
  const urls=await sitovPronunciationPlaybackUrls(mockClient as never,[`storage://pronunciation_audio/${good}`,`storage://pronunciation_audio/${denied}`,`storage://pronunciation_audio/${unexpected}`,`storage://pronunciation_audio/${good}`,'https://legacy.example/recording.webm',null])
  expect(mockSignedUrls).toHaveBeenCalledWith([good,denied,unexpected],3600)
  expect([...urls]).toEqual([[`storage://pronunciation_audio/${good}`,`https://academy.example/supabase/storage/v1/object/sign/pronunciation_audio/${good}?token=a%2Bb%3D`]])
 } finally {log.mockRestore()}
})
test('a Storage request failure keeps the history loadable without audio',async () => {
 const log=jest.spyOn(console,'error').mockImplementation(() => {})
 mockSignedUrls.mockResolvedValue({data:null,error:{message:'Unavailable'}})
 try {expect(await sitovPronunciationPlaybackUrls(mockClient as never,[`storage://pronunciation_audio/${owner}/${ready}.webm`])).toEqual(new Map())}
 finally {log.mockRestore()}
})
