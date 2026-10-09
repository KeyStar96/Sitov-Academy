/** @jest-environment node */
jest.mock('server-only',()=>({}),{virtual:true})
import { resolveSitovPathRecommendationTopics } from '@/lib/learning/sitov-learning-recommendations-path-server'
import type { PathMap } from '@/lib/learning-path-contract'
import type { requestSession } from '@/lib/request-session'
const id='66666666-6666-4666-8666-666666666666',unit='55555555-5555-4555-8555-555555555555'
const map: PathMap={level:'A1.1',completed:false,next_level:null,next_level_available:false,paths:[{id:unit,source_id:'P1',title:'Nicht aus Titel ableiten',sort_order:91,available:true,completed:false,nodes:[{id,kind:'practice',title:'Andere Beschriftung',sort_order:77,available:true,status:null,stars:0,tests:[]}]}]}
const row={nodeId:id,unitId:unit,pathSourceId:'P1',nodeSourceId:'P1-N3',kind:'practice',anchorNodeId:null,anchorSourceId:null,goals:[],anchorGoals:[]}
let data:unknown,error:unknown;const rpc=jest.fn();const from=jest.fn()
const session={user:{id:'account-a'},supabase:{from,rpc}} as unknown as Awaited<ReturnType<typeof requestSession>>
beforeEach(()=>{jest.clearAllMocks();data=[row];error=null;rpc.mockImplementation(async()=>({data:{ok:true,data:{level:map.level,sources:data}},error}))})
test('uses exact authenticated stored source IDs despite different titles/orders',async()=>{
 expect(await resolveSitovPathRecommendationTopics(session,map)).toEqual(['sitov.topic.kennenlernen']);expect(rpc).toHaveBeenCalledWith('sitov_get_learning_recommendation_sources',{p_level:'A1.1',p_node_ids:[id]});expect(from).not.toHaveBeenCalled()
})
test.each(['foreign-parent','unknown-node','ambiguous','read-error'])('%s metadata fails closed',async type=>{
 if(type==='foreign-parent')data=[{...row,unitId:id}]
 if(type==='unknown-node')data=[{...row,nodeId:unit}]
 if(type==='ambiguous')data=[row,row]
 if(type==='read-error')error={code:'offline'}
 expect(await resolveSitovPathRecommendationTopics(session,map)).toEqual([])
})
test('anonymous and unavailable maps do not query metadata',async()=>{
 expect(await resolveSitovPathRecommendationTopics({...session,user:null},map)).toEqual([])
 expect(await resolveSitovPathRecommendationTopics(session,{...map,paths:[{...map.paths[0],available:false}]})).toEqual([]);expect(from).not.toHaveBeenCalled();expect(rpc).not.toHaveBeenCalled()
})
