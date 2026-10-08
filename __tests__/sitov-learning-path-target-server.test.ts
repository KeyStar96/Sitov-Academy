/** @jest-environment node */
jest.mock('server-only',()=>({}),{virtual:true})
import { resolveSitovPathRecommendationTopics } from '@/lib/learning/sitov-learning-recommendations-path-server'
import type { PathMap } from '@/lib/learning-path-contract'
import type { requestSession } from '@/lib/request-session'
const id='66666666-6666-4666-8666-666666666666',unit='55555555-5555-4555-8555-555555555555'
const map: PathMap={level:'A1.1',completed:false,next_level:null,next_level_available:false,paths:[{id:unit,source_id:'P1',title:'Nicht aus Titel ableiten',sort_order:91,available:true,completed:false,nodes:[{id,kind:'practice',title:'Andere Beschriftung',sort_order:77,available:true,status:null,stars:0,tests:[]}]}]}
let data:unknown,error:unknown;const query={select:jest.fn(),in:jest.fn(),eq:jest.fn()};const from=jest.fn(()=>query)
const session={user:{id:'account-a'},supabase:{from}} as unknown as Awaited<ReturnType<typeof requestSession>>
beforeEach(()=>{jest.clearAllMocks();data=[{id,unit_id:unit,source_id:'P1-N3'}];error=null;query.select.mockReturnValue(query);query.in.mockReturnValue(query);query.eq.mockImplementation(()=>Promise.resolve({data,error}))})
test('uses exact authenticated stored source IDs despite different titles/orders',async()=>{
 expect(await resolveSitovPathRecommendationTopics(session,map)).toEqual(['sitov.topic.kennenlernen']);expect(query.in).toHaveBeenCalledWith('id',[id]);expect(query.eq).toHaveBeenCalledWith('is_active',true)
})
test.each(['foreign-parent','unknown-node','ambiguous','read-error'])('%s metadata fails closed',async type=>{
 if(type==='foreign-parent')data=[{id,unit_id:id,source_id:'P1-N3'}]
 if(type==='unknown-node')data=[{id:unit,unit_id:unit,source_id:'P1-N3'}]
 if(type==='ambiguous')data=[{id,unit_id:unit,source_id:'P1-N3'},{id,unit_id:unit,source_id:'P1-N3'}]
 if(type==='read-error')error={code:'offline'}
 expect(await resolveSitovPathRecommendationTopics(session,map)).toEqual([])
})
test('anonymous and unavailable maps do not query metadata',async()=>{
 expect(await resolveSitovPathRecommendationTopics({...session,user:null},map)).toEqual([])
 expect(await resolveSitovPathRecommendationTopics(session,{...map,paths:[{...map.paths[0],available:false}]})).toEqual([]);expect(from).not.toHaveBeenCalled()
})
