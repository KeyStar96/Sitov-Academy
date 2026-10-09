/** @jest-environment node */
jest.mock('server-only',()=>({}),{virtual:true})
jest.mock('@/utils/supabase/server',()=>({createClient:jest.fn()}))
jest.mock('@/lib/access/server',()=>({currentUserHasContentAccess:jest.fn()}))
import { createClient } from '@/utils/supabase/server'
import { currentUserHasContentAccess } from '@/lib/access/server'
import { resolveSitovLearningRecommendations } from '@/lib/learning/sitov-learning-recommendations-server'
import { SITOV_TOPIC_MAPPING } from '@/lib/learning/sitov-topic-mapping'
const unit='55555555-5555-4555-8555-555555555555',anchor='66666666-6666-4666-8666-666666666666',special='77777777-7777-4777-8777-777777777777'
const topic=SITOV_TOPIC_MAPPING.find(t=>t.topicId==='sitov.topic.nominativ')!
const source={nodeId:special,unitId:unit,pathSourceId:'P4',nodeSourceId:'sitov-special-a11-artikel-nominativ-v1',kind:'special',anchorNodeId:anchor,anchorSourceId:'P4-N1',goals:['P4-G1'],anchorGoals:['P4-G1']}
const client={auth:{getUser:jest.fn()},rpc:jest.fn(),from:jest.fn()}
let row:Record<string,unknown>,available:boolean,published:boolean,status:null|'in_progress'|'completed',denied:boolean,sourceError:boolean,sourceLevel:string,duplicate:boolean,vocabContinue:boolean
beforeEach(()=>{
 jest.clearAllMocks();row={...source};available=true;published=true;status=null;denied=false;sourceError=false;sourceLevel='A1.1';duplicate=false;vocabContinue=false
 ;(createClient as jest.Mock).mockResolvedValue(client);client.auth.getUser.mockResolvedValue({error:null,data:{user:{id:'account-a'}}})
 ;(currentUserHasContentAccess as jest.Mock).mockImplementation(({kind,id})=>id===special?kind==='path_special'&&!denied:true)
 client.rpc.mockImplementation(async(name,args)=>{
  if(name==='get_sitov_access_catalog')return {error:null,data:{version:1,level:args.p_level,trainer:args.p_trainer,units:args.p_trainer==='exercises'?[{id:unit,items:[{id:special,kind:'path_special',published},{id:anchor,kind:'path_node',published:true}]}]:args.p_trainer==='vocabulary'?topic.targets.filter(t=>t.kind==='vocabulary_card').map(t=>({id:t.kind==='vocabulary_card'?t.unitId:'',items:[{id:t.id,kind:t.kind,published:true}]})):[]}}
  if(name==='get_learning_path')return {error:null,data:{level:'A1.1',completed:false,next_level:null,next_level_available:false,paths:[{id:unit,source_id:'P4',title:'Different title',sort_order:99,available:true,completed:false,nodes:[{id:anchor,kind:'practice',title:'Anchor',sort_order:4,available:true,status:'completed',stars:2,tests:[]},{id:special,kind:'special',title:'Different Special',sort_order:2,available,status,stars:0,tests:[]}]}]}}
  if(name==='sitov_get_learning_recommendation_sources')return sourceError?{error:{code:'offline'},data:null}:{error:null,data:{ok:true,data:{level:sourceLevel,sources:[{nodeId:anchor,unitId:unit,pathSourceId:'P4',nodeSourceId:'P4-N1',kind:'practice',anchorNodeId:null,anchorSourceId:null,goals:['P4-G1'],anchorGoals:[]},...(args.p_node_ids.includes(special)?duplicate?[row,row]:[row]:[])]}}}
  if(name==='sitov_learning_checkpoint')return {error:null,data:{checkpoint:null}}
  throw new Error(`unexpected RPC ${name}`)
 })
 client.from.mockImplementation(table=>{
  if(table!=='vocabulary_direction_progress')throw new Error(`forbidden raw read ${table}`)
  const query={select:jest.fn(),eq:jest.fn(),then:(resolve:(v:unknown)=>void)=>resolve({error:null,data:vocabContinue?[{id:anchor,direction:'native_to_de',box_number:3}]:[]})};query.select.mockReturnValue(query);query.eq.mockReturnValue(query);return query
 })
})
const input={topicIds:[topic.topicId],locale:'de',limit:3}
const resolve=()=>resolveSitovLearningRecommendations(input)
test.each(['de','en','ru','uk','tr'])('valid exact Special uses %s route and typed current rights without writes',async locale=>{
 const r=await resolveSitovLearningRecommendations({...input,locale});if(!r.ok)throw new Error('failure')
 expect(r.data.items.find(i=>i.targetId===special)).toMatchObject({kind:'learning_path',action:'practice',progress:{source:'learning_path',status:'not_started'},href:`/${locale}/dashboard/level/A1.1/path?sitov_target=${special}`})
 expect(currentUserHasContentAccess).toHaveBeenCalledWith({kind:'path_special',id:special})
 expect(client.from.mock.calls.every(([table])=>table==='vocabulary_direction_progress')).toBe(true)
 expect(client.rpc.mock.calls.every(([name,args])=>['get_sitov_access_catalog','get_learning_path','sitov_get_learning_recommendation_sources'].includes(name)||(name==='sitov_learning_checkpoint'&&args.p_action==='get'))).toBe(true)
 expect(client.rpc.mock.calls.filter(([name])=>name==='sitov_get_learning_recommendation_sources')).toHaveLength(1)
})
test.each(['in_progress','completed'] as const)('uses only stored map %s evidence',async value=>{
 status=value;const r=await resolve();if(!r.ok)throw new Error('failure');expect(r.data.items.find(i=>i.targetId===special)).toMatchObject({action:value==='in_progress'?'continue':'review',progress:{status:value}})
})
test.each(['source','anchor-source','goal','anchor-goal','revoked','unpublished','unavailable'])('%s safely omits Special',async type=>{
 if(type==='source')row.nodeSourceId='foreign-special'
 if(type==='anchor-source')row.anchorSourceId='P4-N7'
 if(type==='goal')row.goals=['P4-G2']
 if(type==='anchor-goal')row.anchorGoals=['P4-G2']
 if(type==='revoked')denied=true
 if(type==='unpublished')published=false
 if(type==='unavailable')available=false
 const r=await resolve();if(!r.ok)throw new Error('failure');expect(r.data.items.some(i=>i.targetId===special)).toBe(false)
})
test.each(['parent','path','kind','anchor-id','duplicate','malformed','level','transport'])('%s fails closed without a wrong link',async type=>{
 if(type==='parent')row.unitId=anchor
 if(type==='path')row.pathSourceId='P5'
 if(type==='kind')row.kind='practice'
 if(type==='anchor-id')row.anchorNodeId=unit
 if(type==='duplicate')duplicate=true
 if(type==='malformed')row.privateAnswers=[]
 if(type==='level')sourceLevel='A1.2'
 if(type==='transport')sourceError=true
 expect(await resolve()).toEqual({ok:false,error:'retryable_failure',retryable:true})
})
test('current permission revocation on a second resolution removes only Special',async()=>{
 const first=await resolve();expect(first.ok&&first.data.items.some(i=>i.targetId===special)).toBe(true)
 denied=true;const second=await resolve();expect(second.ok&&second.data.items.some(i=>i.targetId===special)).toBe(false)
})
test('existing continue priority remains ahead of newly placed Special',async()=>{
 vocabContinue=true
 const progress='88888888-8888-4888-8888-888888888888'
 const old=client.rpc.getMockImplementation()!
 client.rpc.mockImplementation((name,args)=>name==='sitov_learning_checkpoint'?Promise.resolve({error:null,data:{checkpoint:{revision:1,updatedAt:'2026-10-09',state:{plan:[anchor,progress]}}}}):old(name,args))
 const r=await resolve();if(!r.ok)throw new Error('failure');expect(r.data.items[0].action).toBe('continue');expect(r.data.items).toHaveLength(3);expect(r.data.items.some(i=>i.targetId===special)).toBe(true)
})
