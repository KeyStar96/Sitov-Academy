jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/lib/request-session', () => ({ requestSession: jest.fn() }))
import { readFileSync } from 'node:fs'
import { requestSession } from '@/lib/request-session'
import { sitovPretestAuthorSaveInputSchema } from '@/lib/sitov-pronunciation-pretest-author-contract'
import { saveSitovPronunciationPretestDraftServer } from '@/lib/sitov-pronunciation-pretest-server'
const draft = JSON.parse(readFileSync('supabase/seeds/sitov-pronunciation-pretests-2026-10-08.json', 'utf8')).drafts[0]
const id='00000000-0000-4000-8000-000000000001',requestId='00000000-0000-4000-8000-000000000002'
const input={textId:draft.textId,textVersion:draft.textVersion,baseDefinitionId:id,definition:draft.definition,requestId}
const ack={id:requestId,text_id:input.textId,text_version:input.textVersion,test_version:'b'.repeat(64),definition:input.definition,active:false,created_at:'2026-10-09T00:00:00Z'}
const rpc=jest.fn()
function setup(data:unknown,user:{id:string}|null={id}) {
 rpc.mockResolvedValue({data,error:null})
 jest.mocked(requestSession).mockResolvedValue({user,supabase:{rpc}} as unknown as Awaited<ReturnType<typeof requestSession>>)
}
beforeEach(()=>jest.clearAllMocks())
it('preserves actual authored German wording and rejects injected publishing/private identity fields',async()=>{
 expect(sitovPretestAuthorSaveInputSchema.parse(input)).toEqual(input)
 setup({ok:true,data:ack})
 for(const extra of [{studentId:id},{active:true},{approval:'approved'}])expect(await saveSitovPronunciationPretestDraftServer({...input,...extra})).toEqual({ok:false,error:'invalid_input',retryable:false})
 const definition=JSON.parse(JSON.stringify(input.definition));definition.tasks[0].correctOptionId='sitov.foreign'
 expect((await saveSitovPronunciationPretestDraftServer({...input,definition})).ok).toBe(false)
 expect(rpc).not.toHaveBeenCalled()
})
it('requires verified cookie identity before RPC and sends only the exact staff draft args',async()=>{
 setup({ok:true,data:ack},null)
 expect(await saveSitovPronunciationPretestDraftServer(input)).toEqual({ok:false,error:'authentication_required',retryable:false})
 expect(rpc).not.toHaveBeenCalled()
 setup({ok:true,data:ack})
 expect(await saveSitovPronunciationPretestDraftServer(input)).toEqual({ok:true,data:ack})
 expect(rpc).toHaveBeenCalledWith('sitov_save_pronunciation_pretest_draft',{p_text_id:input.textId,p_text_version:input.textVersion,p_base_definition_id:id,p_definition:input.definition,p_request_id:requestId})
})
it('rejects active, changed-source and changed-definition acknowledgements',async()=>{
 for(const data of [{...ack,active:true},{...ack,text_id:id},{...ack,text_version:'a'.repeat(64)},{...ack,definition:{...ack.definition,tasks:ack.definition.tasks.map((q:object,i:number)=>i===0?{...q,rationaleDe:'Diese Antwort wurde ohne Autorisierung verändert und ist ungültig.'}:q)}}]) {
  setup({ok:true,data})
  expect(await saveSitovPronunciationPretestDraftServer(input)).toEqual({ok:false,error:'retryable_failure',retryable:true})
 }
})
it('preserves explicit SQL security, CAS and receipt conflicts',async()=>{
 for(const error of ['not_found','version_conflict','request_conflict']) {
  setup({ok:false,error,retryable:false})
  expect(await saveSitovPronunciationPretestDraftServer(input)).toEqual({ok:false,error,retryable:false})
 }
})
