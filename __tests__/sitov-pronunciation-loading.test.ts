/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/access/server', () => ({ loadLevelAccessProfile: jest.fn() }))

import { getPronunciationPrompts } from '@/app/actions/pronunciation'
import { createClient } from '@/utils/supabase/server'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { SITOV_PRONUNCIATION_REQUIREMENTS } from '@/lib/sitov-pronunciation-readiness'
import { sitovPronunciationPlaybackUrls } from '@/lib/pronunciation-playback-server'

const owner = '00000000-0000-4000-8000-000000000001'
const ready = '00000000-0000-4000-8000-000000000002'
const locked = '00000000-0000-4000-8000-000000000003'
const unit = '00000000-0000-4000-8000-000000000004'
const readiness = {
 level:'A1.1',mode:'logical',tier:1,
 stats:{knownWords:40,grammarNodes:3,passedTests:0,legacyGrammarExercises:0,legacyGrammarTopics:0,confidentVerbForms:3,verbEvidenceRequired:true},
 requirements:SITOV_PRONUNCIATION_REQUIREMENTS,
 texts:[ready,locked].map((id,index) => ({id,title:'Der Lehrer',tier:1,ready:index===0,wordCount:20,coveragePercent:80,requiredCoveragePercent:60})),
}
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
 mockRpc.mockResolvedValue({data:readiness,error:null})
 mockOrder.mockResolvedValue({data:[{id:ready,sentence_de:'Der Lehrer kommt morgen.',focus:null,audio_url:null,unit:{id:unit,level:'A1.1',label:'Der Lehrer',sort_order:1,is_active:true,learning_levels:{cefr_level:'A1'}}}],error:null})
})
afterAll(() => {
 if (previousPublicUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL=previousPublicUrl
 if (previousInternalUrl === undefined) delete process.env.SUPABASE_INTERNAL_URL; else process.env.SUPABASE_INTERNAL_URL=previousInternalUrl
})

test('uses one verified session and restricts the text query to ready IDs',async () => {
 expect((await getPronunciationPrompts('A1.1')).map(prompt => prompt.id)).toEqual([ready])
 expect(mockGetUser).toHaveBeenCalledTimes(1)
 expect(loadLevelAccessProfile).toHaveBeenCalledTimes(1)
 expect(mockQuery.in).toHaveBeenCalledWith('id',[ready])
})
test('keeps locked text bodies unread when none are ready',async () => {
 mockRpc.mockResolvedValue({data:{...readiness,texts:readiness.texts.map(text => ({...text,ready:false}))},error:null})
 expect(await getPronunciationPrompts('A1.1')).toEqual([])
 expect(mockFrom).not.toHaveBeenCalled()
})
test('missing readiness and denied trainer access fail closed before text reads',async () => {
 mockRpc.mockResolvedValue({data:null,error:{code:'unavailable'}})
 expect(await getPronunciationPrompts('A1.1')).toEqual([])
 expect(mockFrom).not.toHaveBeenCalled()
 jest.mocked(loadLevelAccessProfile).mockResolvedValue({role:'student',ui_language:'en',allowed_levels:[]})
 mockRpc.mockClear()
 expect(await getPronunciationPrompts('A1.1')).toEqual([])
 expect(mockRpc).not.toHaveBeenCalled()
})
test('teacher lesson restrictions remain enforced after narrowing the ready query',async () => {
 jest.mocked(loadLevelAccessProfile).mockResolvedValue({role:'student',ui_language:'en',allowed_levels:['A1.1'],trainer_grants:[{level:'A1.1',trainer:'pronunciation',enabled:true,unit_ids:[locked]}]})
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
