/** @jest-environment node */
jest.mock('server-only',()=>({}),{virtual:true})
import { loadSitovLearningRecommendationSources } from '@/lib/learning/sitov-learning-recommendation-sources-server'
import type { createClient } from '@/utils/supabase/server'
import type { PathMap } from '@/lib/learning-path-contract'
const id='66666666-6666-4666-8666-666666666666',unit='55555555-5555-4555-8555-555555555555'
const row={nodeId:id,unitId:unit,pathSourceId:'P1',nodeSourceId:'P1-N3',kind:'practice',anchorNodeId:null,anchorSourceId:null,goals:['P1-G1'],anchorGoals:[]}
const map:PathMap={level:'A1.1',completed:false,next_level:null,next_level_available:false,paths:[{id:unit,source_id:'P1',title:'Changed title',sort_order:100,available:true,completed:false,nodes:[{id,kind:'practice',title:'Changed node',sort_order:42,available:true,status:null,stars:0,tests:[]}]}]}
const rpc=jest.fn(),client={rpc} as unknown as Pick<Awaited<ReturnType<typeof createClient>>,'rpc'>
const respond=(sources:unknown,level='A1.1')=>rpc.mockResolvedValue({error:null,data:{ok:true,data:{level,sources}}})
beforeEach(()=>{jest.clearAllMocks();respond([row])})
test('uses only current available UUIDs, returns stored metadata and makes no writes',async()=>{
 expect(await loadSitovLearningRecommendationSources(client,map)).toEqual([row])
 expect(rpc.mock.calls).toEqual([['sitov_get_learning_recommendation_sources',{p_level:'A1.1',p_node_ids:[id]}]])
})
test.each(['unit','path','kind','id','duplicate','malformed','level','anchor'])('%s cannot redirect to another target',async type=>{
 const changed={...row}
 if(type==='unit')changed.unitId=id
 if(type==='path')changed.pathSourceId='P2'
 if(type==='kind')changed.kind='test'
 if(type==='id')changed.nodeId=unit
 if(type==='anchor')Object.assign(changed,{anchorNodeId:unit,anchorSourceId:'P1-N1'})
 respond(type==='duplicate'?[row,row]:type==='malformed'?[{...row,answers:['private']}]:[changed],type==='level'?'A1.2':'A1.1')
 await expect(loadSitovLearningRecommendationSources(client,map)).rejects.toThrow()
})
test.each(['authentication_required','not_found','invalid_input'])('%s is safely empty',async error=>{
 rpc.mockResolvedValue({error:null,data:{ok:false,error,retryable:false}})
 expect(await loadSitovLearningRecommendationSources(client,map)).toEqual([])
})
test.each(['transport','retryable_failure'])('%s remains a failure',async error=>{
 rpc.mockResolvedValue(error==='transport'?{error:{code:'offline'},data:null}:{error:null,data:{ok:false,error,retryable:true}})
 await expect(loadSitovLearningRecommendationSources(client,map)).rejects.toThrow()
})
test('omitted or currently unavailable IDs produce no source fallback',async()=>{
 respond([]);expect(await loadSitovLearningRecommendationSources(client,map)).toEqual([])
 rpc.mockClear();expect(await loadSitovLearningRecommendationSources(client,{...map,paths:[{...map.paths[0],available:false}]})).toEqual([]);expect(rpc).not.toHaveBeenCalled()
})
test('duplicate current map IDs fail before RPC',async()=>{
 const node=map.paths[0].nodes[0]
 await expect(loadSitovLearningRecommendationSources(client,{...map,paths:[{...map.paths[0],nodes:[node,node]}]})).rejects.toThrow();expect(rpc).not.toHaveBeenCalled()
})

test('a repeated stored source under different runtime IDs fails closed',async()=>{
 const second={...map.paths[0].nodes[0],id:unit}
 respond([row,{...row,nodeId:unit}])
 await expect(loadSitovLearningRecommendationSources(client,{...map,paths:[{...map.paths[0],nodes:[map.paths[0].nodes[0],second]}]})).rejects.toThrow('ambiguous_source_binding')
})
test('batches larger maps into the RPC limit without adding IDs or account input',async()=>{
 const nodes=Array.from({length:201},(_,i)=>({...map.paths[0].nodes[0],id:`aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12,'0')}`}))
 respond([])
 expect(await loadSitovLearningRecommendationSources(client,{...map,paths:[{...map.paths[0],nodes}]})).toEqual([])
 expect(rpc.mock.calls.map(([,args])=>args.p_node_ids.length)).toEqual([200,1])
 expect(rpc.mock.calls.flatMap(([,args])=>args.p_node_ids)).toEqual(nodes.map(node=>node.id))
})
