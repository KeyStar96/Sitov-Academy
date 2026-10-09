jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/lib/request-session', () => ({ requestSession: jest.fn() }))
import { requestSession } from '@/lib/request-session'
import { loadSitovPronunciationPretestPublicationServer, publishSitovPronunciationPretestServer } from '@/lib/sitov-pronunciation-pretest-server'
const textId='00000000-0000-4000-8000-000000000001',definitionId='00000000-0000-4000-8000-000000000002',base='00000000-0000-4000-8000-000000000003',requestId='00000000-0000-4000-8000-000000000004'
const input={textId,definitionId,textVersion:'a'.repeat(64),testVersion:'b'.repeat(64),baseActiveDefinitionId:base}
const identity={textId,definitionId,textVersion:input.textVersion,testVersion:input.testVersion}
const ready={...identity,activeDefinitionId:base,ready:true},published={...identity,activeDefinitionId:definitionId,active:true}
const rpc=jest.fn()
function setup(data:unknown,user:{id:string}|null={id:textId}){rpc.mockResolvedValue({data,error:null});jest.mocked(requestSession).mockResolvedValue({user,supabase:{rpc}} as unknown as Awaited<ReturnType<typeof requestSession>>)}
beforeEach(()=>jest.clearAllMocks())
it('rejects any client approval/active/identity/proof injection before RPC',async()=>{
 setup({ok:true,data:ready})
 for(const extra of [{approved:true},{active:true},{reviewerIdentity:'sitov.M'},{studentId:textId},{audioProof:{}}])expect(await loadSitovPronunciationPretestPublicationServer({...input,...extra})).toEqual({ok:false,error:'invalid_input',retryable:false})
 expect((await publishSitovPronunciationPretestServer(input)).ok).toBe(false)
 expect(rpc).not.toHaveBeenCalled()
})
it('requires verified cookie user for reads and publication',async()=>{
 setup({ok:true,data:published},null)
 for(const result of [await loadSitovPronunciationPretestPublicationServer(input),await publishSitovPronunciationPretestServer({...input,requestId})])expect(result).toEqual({ok:false,error:'authentication_required',retryable:false})
 expect(rpc).not.toHaveBeenCalled()
})
it('sends exact source/definition/active CAS args without passing authoring or proofs',async()=>{
 setup({ok:true,data:ready});expect(await loadSitovPronunciationPretestPublicationServer(input)).toEqual({ok:true,data:ready})
 const args={p_text_id:textId,p_definition_id:definitionId,p_text_version:input.textVersion,p_test_version:input.testVersion,p_base_active_definition_id:base}
 expect(rpc).toHaveBeenLastCalledWith('sitov_get_pronunciation_pretest_publication',args)
 setup({ok:true,data:published});expect(await publishSitovPronunciationPretestServer({...input,requestId})).toEqual({ok:true,data:published})
 expect(rpc).toHaveBeenLastCalledWith('sitov_publish_pronunciation_pretest',{...args,p_request_id:requestId})
})
it('requires strict current active acknowledgement matching requested source/version/definition',async()=>{
 for(const data of [{...published,active:false},{...published,activeDefinitionId:base},{...published,textId:base},{...published,textVersion:'c'.repeat(64)},{...published,testVersion:'c'.repeat(64)},{...published,definitionId:base},{...published,approval:true}]){
  setup({ok:true,data});expect(await publishSitovPronunciationPretestServer({...input,requestId})).toEqual({ok:false,error:'retryable_failure',retryable:true})
 }
 setup({ok:true,data:{...ready,activeDefinitionId:definitionId}});expect((await loadSitovPronunciationPretestPublicationServer(input)).ok).toBe(false)
})
it('preserves false readiness and security/version/proof/retry errors',async()=>{
 setup({ok:true,data:{...ready,ready:false}});expect(await loadSitovPronunciationPretestPublicationServer(input)).toEqual({ok:true,data:{...ready,ready:false}})
 for(const error of ['not_found','version_conflict','authoring_not_ready','request_conflict']){setup({ok:false,error,retryable:false});expect(await publishSitovPronunciationPretestServer({...input,requestId})).toEqual({ok:false,error,retryable:false})}
})
