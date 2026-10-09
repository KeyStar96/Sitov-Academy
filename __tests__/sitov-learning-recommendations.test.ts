/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/access/server', () => ({ currentUserHasContentAccess: jest.fn() }))
import { createClient } from '@/utils/supabase/server'
import { currentUserHasContentAccess } from '@/lib/access/server'
import { resolveSitovLearningRecommendations } from '@/lib/learning/sitov-learning-recommendations-server'
import { sitovLearningRecommendationInputSchema } from '@/lib/learning/sitov-learning-recommendations-contract'
import { SITOV_TOPIC_MAPPING } from '@/lib/learning/sitov-topic-mapping'
import { ACCESS_LEVELS } from '@/lib/access/levels'
const topic = SITOV_TOPIC_MAPPING[0]
const target = topic.targets.find(t => t.kind === 'vocabulary_card')!
const unit = target.kind === 'vocabulary_card' ? target.unitId : ''
const progressId='88888888-8888-4888-8888-888888888888'
const client = { auth: { getUser: jest.fn() }, rpc: jest.fn(), from: jest.fn() }
let allowed: string[]; let failProgress = false; let foreignUnit = false; let duplicate = false
const filters: Record<string, unknown>[] = []
beforeEach(() => {
 jest.clearAllMocks(); filters.length=0; allowed=[target.id];failProgress=false;foreignUnit=false;duplicate=false
 ;(createClient as jest.Mock).mockResolvedValue(client)
 client.auth.getUser.mockResolvedValue({ data: { user: { id: 'account-a' } }, error: null })
 ;(currentUserHasContentAccess as jest.Mock).mockImplementation(({id}) => allowed.includes(id))
 client.rpc.mockImplementation(async (name, args) => {
  if(name==='get_sitov_access_catalog') return { error:null, data:{version:1,level:args.p_level,trainer:args.p_trainer,units: args.p_trainer==='vocabulary'?[{id:foreignUnit?'99999999-9999-4999-9999-999999999999':unit, items:[{kind:'vocabulary_card',id:target.id,published:true},...(duplicate?[{kind:'vocabulary_card',id:target.id,published:true}]:[])]}]:[]} }
  if(name==='sitov_learning_checkpoint')return {error:null,data:{checkpoint:null}}
  throw new Error('unexpected rpc')
 })
 client.from.mockImplementation(table => {
  const where: Record<string, unknown> = {table}; filters.push(where)
  const query: Record<string, unknown> = {}
  for(const method of ['select','eq','limit']) query[method]=jest.fn((key,value)=>{if(method==='eq')where[key]=value;return query})
  query.then=(resolve: (v:unknown)=>void)=>resolve({error: table==='vocabulary_direction_progress'&&failProgress?{code:'offline'}:null,data:table==='vocabulary_direction_progress'?[{id:progressId,direction:'native_to_de',box_number:3}]:[]})
  return query
 })
})
const input={topicIds:[topic.topicId],locale:'uk',limit:3}
it('strictly rejects caller identity/URLs/unknown IDs and unsupported counts',async()=>{
 for(const value of [{...input,account:'other'},{...input,href:'//evil'},{...input,topicIds:['sitov.topic.foreign']},{...input,limit:4}])expect((await resolveSitovLearningRecommendations(value)).ok).toBe(false)
 expect(client.auth.getUser).not.toHaveBeenCalled()
 expect(sitovLearningRecommendationInputSchema.parse({topicIds:[topic.topicId],locale:'de'}).limit).toBe(3)
})
it('requires a verified session',async()=>{client.auth.getUser.mockResolvedValue({data:{user:null},error:null});expect(await resolveSitovLearningRecommendations(input)).toEqual({ok:false,error:'authentication_required',retryable:false});expect(client.rpc).not.toHaveBeenCalled()})
it('returns only exact authorized selected item and real account progress',async()=>{
 const result=await resolveSitovLearningRecommendations(input);expect(result.ok).toBe(true)
 if(!result.ok)throw new Error('unexpected failure')
 expect(result.data.items).toHaveLength(1)
 expect(result.data.items[0]).toMatchObject({kind:'vocabulary',targetId:target.id,action:'practice',progress:{directions:[{direction:'native_to_de',box:3}],checkpoint:false},href:`/uk/dashboard/level/A1.1/vocabulary/lessons?sitov_target=${target.id}`})
 expect(filters.find(f=>f.table==='vocabulary_direction_progress')).toMatchObject({auth_user_id:'account-a',card_id:target.id})
})
it('omits commercial denial without revealing target or reading progress',async()=>{allowed=[];const result=await resolveSitovLearningRecommendations(input);expect(result).toEqual({ok:true,data:{mappingVersion:1,items:[]}});expect(filters.some(f=>f.table==='vocabulary_direction_progress')).toBe(false)})
it('does not turn a progress read failure into invented zero',async()=>{failProgress=true;expect(await resolveSitovLearningRecommendations(input)).toEqual({ok:false,error:'retryable_failure',retryable:true})})
it.each(['foreign','ambiguous'])('omits %s canonical unit/target matches',async(type)=>{foreignUnit=type==='foreign';duplicate=type==='ambiguous';expect(await resolveSitovLearningRecommendations(input)).toEqual({ok:true,data:{mappingVersion:1,items:[]}})})
it.each(['de','en','ru','uk','tr'])('uses the requested %s UI locale without changing IDs',async(locale)=>{const r=await resolveSitovLearningRecommendations({...input,locale});expect(r.ok).toBe(true);if(r.ok)expect(r.data.items[0].href).toBe(`/${locale}/dashboard/level/A1.1/vocabulary/lessons?sitov_target=${target.id}`)})
it('preserves a persisted checkpoint as continue and never copies another account',async()=>{const old=client.rpc.getMockImplementation()!;client.rpc.mockImplementation((name,args)=>name==='sitov_learning_checkpoint'?Promise.resolve({error:null,data:{checkpoint:{revision:2,updatedAt:'2026-10-09',state:{plan:[progressId]}}}}):old(name,args));const r=await resolveSitovLearningRecommendations(input);if(!r.ok)throw new Error('failure');expect(r.data.items[0].action).toBe('continue')})
it('does not treat a card UUID as a resumable direction-progress UUID',async()=>{const old=client.rpc.getMockImplementation()!;client.rpc.mockImplementation((name,args)=>name==='sitov_learning_checkpoint'?Promise.resolve({error:null,data:{checkpoint:{revision:2,updatedAt:'2026-10-09',state:{plan:[target.id]}}}}):old(name,args));const r=await resolveSitovLearningRecommendations(input);if(!r.ok)throw new Error('failure');expect(r.data.items[0].action).toBe('practice')})
it('can recommend individual pronunciation pretest with no vocabulary/path/verb evidence',async()=>{
 const reading=topic.targets.find(t=>t.kind==='reading_text')!;const readingUnit='77777777-7777-4777-8777-777777777777';allowed=[reading.id]
 client.rpc.mockImplementation(async(name,args)=>{
  if(name==='get_sitov_access_catalog')return {error:null,data:{version:1,level:args.p_level,trainer:args.p_trainer,units:args.p_trainer==='pronunciation'?[{id:readingUnit,items:[{kind:'reading_text',id:reading.id,published:true}]}]:[]}}
  if(name==='sitov_get_pronunciation_pretests')return {error:null,data:{ok:true,data:[{textId:reading.id,unitId:readingUnit,level:topic.level,title:'Guten Tag',focus:null,kind:'regular',textVersion:'a'.repeat(64),testVersion:'b'.repeat(64),status:'available',lockedReason:null,attempt:null,proof:null,target:'pretest'}]}}
  throw new Error('unexpected progress prerequisite')
 })
 const r=await resolveSitovLearningRecommendations(input);if(!r.ok)throw new Error('failure');expect(r.data.items).toHaveLength(1);expect(r.data.items[0]).toMatchObject({kind:'pronunciation',action:'pretest',href:`/uk/dashboard/level/A1.1/pronunciation?sitov_target=${reading.id}`});expect(filters.some(f=>String(f.table).includes('progress'))).toBe(false)
})
it('resolves a level-qualified stored node and truthful completed review',async()=>{
 const nodeId='66666666-6666-4666-8666-666666666666';const pathUnit='55555555-5555-4555-8555-555555555555';allowed=[nodeId]
 client.rpc.mockImplementation(async(name,args)=>{
  if(name==='get_sitov_access_catalog')return {error:null,data:{version:1,level:args.p_level,trainer:args.p_trainer,units:args.p_trainer==='exercises'?[{id:pathUnit,items:[{kind:'path_node',id:nodeId,published:true}]}]:[]}}
  if(name==='sitov_get_learning_recommendation_sources')return {error:null,data:{ok:true,data:{level:args.p_level,sources:[{nodeId,unitId:pathUnit,pathSourceId:'P1',nodeSourceId:'P1-N3',kind:'practice',anchorNodeId:null,anchorSourceId:null,goals:[],anchorGoals:[]}]}}}
  if(name==='get_learning_path')return {error:null,data:{level:'A1.1',completed:false,next_level:null,next_level_available:false,paths:[{id:pathUnit,source_id:'P1',title:'Pfad',sort_order:1,available:true,completed:false,nodes:[{id:nodeId,kind:'practice',title:'Namen',sort_order:1,available:true,status:'completed',stars:2,tests:[]}]}]}}
  throw new Error('unexpected rpc')
 })
 const r=await resolveSitovLearningRecommendations(input);if(!r.ok)throw new Error('failure');expect(r.data.items).toHaveLength(1);expect(r.data.items[0]).toMatchObject({kind:'learning_path',targetId:nodeId,action:'review',progress:{status:'completed'},href:`/uk/dashboard/level/A1.1/path?sitov_target=${nodeId}`})
 expect(client.rpc).toHaveBeenCalledWith('sitov_get_learning_recommendation_sources',{p_level:'A1.1',p_node_ids:[nodeId]})
 expect(client.from).not.toHaveBeenCalled()
 allowed=[];const revoked=await resolveSitovLearningRecommendations(input);expect(revoked).toEqual({ok:true,data:{mappingVersion:1,items:[]}})
})
it('treats access-catalog transport failure as retryable without returning metadata',async()=>{client.rpc.mockResolvedValue({data:null,error:{code:'offline'}});expect(await resolveSitovLearningRecommendations(input)).toEqual({ok:false,error:'retryable_failure',retryable:true})})
it('reads checkpoints only and keeps requested source IDs intact after revocation',async()=>{
 const result=await resolveSitovLearningRecommendations(input);expect(result.ok).toBe(true)
 const reads=client.rpc.mock.calls.filter(([name])=>name==='sitov_learning_checkpoint')
 expect(reads.length).toBeGreaterThan(0);expect(reads.every(([,args])=>args.p_action==='get'&&args.p_state===null&&args.p_expected_revision===null)).toBe(true)
 expect(client.rpc.mock.calls.every(([name])=>['get_sitov_access_catalog','sitov_learning_checkpoint'].includes(name))).toBe(true)
 allowed=[];expect(await resolveSitovLearningRecommendations(input)).toEqual({ok:true,data:{mappingVersion:1,items:[]}})
})

describe('captured PostgreSQL catalog unit IDs',()=>{
 const legacyUnit='01da78e3-726f-a505-a9d6-fbb907ccb31f'
 const kommenUnit='ddcf712d-060d-0e2c-9469-1139b39bb87f'
 const nodeId='66666666-6666-4666-8666-666666666666',pathUnit='55555555-5555-4555-8555-555555555555'
 const verbId='sitov-verb-kommen'
 const mappedInput={topicIds:['sitov.topic.kennenlernen','sitov.topic.nominativ'],locale:'uk',limit:3}
 let capturedUnit:string,verbPublished:boolean
 beforeEach(()=>{
  capturedUnit=legacyUnit;verbPublished=true;allowed=[nodeId,verbId]
  client.rpc.mockImplementation(async(name,args)=>{
   if(name==='get_sitov_access_catalog')return {error:null,data:{version:1,level:args.p_level,trainer:args.p_trainer,units:args.p_trainer==='exercises'?[{id:pathUnit,items:[{kind:'path_node',id:nodeId,published:true}]}]:args.p_trainer==='verbs'?[
    // Exact sanitized unit/item shapes captured from the actual epoch19 QA response.
    {id:capturedUnit,label:'meinen',items:[{kind:'verb',id:'sitov-verb-meinen',label:'meinen',published:true}]},
    {id:kommenUnit,label:'kommen',items:[{kind:'verb',id:verbId,label:'kommen',published:verbPublished}]},
   ]:[]}}
   if(name==='get_learning_path')return {error:null,data:{level:'A1.1',completed:false,next_level:null,next_level_available:false,paths:[{id:pathUnit,source_id:'P4',title:'Actual mapped path',sort_order:4,available:true,completed:false,nodes:[{id:nodeId,kind:'practice',title:'Actual mapped anchor',sort_order:1,available:true,status:null,stars:0,tests:[]}]}]}}
   if(name==='sitov_get_learning_recommendation_sources')return {error:null,data:{ok:true,data:{level:'A1.1',sources:[{nodeId,unitId:pathUnit,pathSourceId:'P4',nodeSourceId:'P4-N1',kind:'practice',anchorNodeId:null,anchorSourceId:null,goals:['P4-G1'],anchorGoals:[]}]}}}
   throw new Error('unexpected write or prerequisite')
  })
 })
 it('retains an authorized path and verb beside captured version-a and version-0 units',async()=>{
  const r=await resolveSitovLearningRecommendations(mappedInput);if(!r.ok)throw new Error('captured catalog dropped valid recommendations')
  expect(r.data.items).toHaveLength(2)
  expect(r.data.items).toEqual(expect.arrayContaining([
   expect.objectContaining({kind:'learning_path',targetId:nodeId,href:`/uk/dashboard/level/A1.1/path?sitov_target=${nodeId}`}),
   expect.objectContaining({kind:'verbs',targetId:verbId,progress:{source:'verbs',box:null,attempts:null,correct:null},href:`/uk/dashboard/level/A1.1/verbs?sitov_target=${verbId}&tense=present`}),
  ]))
  expect(currentUserHasContentAccess).toHaveBeenCalledWith({kind:'verb',id:verbId})
  expect(currentUserHasContentAccess).toHaveBeenCalledWith({kind:'path_node',id:nodeId})
  expect(filters).toEqual([{table:'sitov_verb_progress',auth_user_id:'account-a',verb_id:verbId,tense:'present'}])
  expect(client.rpc.mock.calls.every(([name])=>['get_sitov_access_catalog','get_learning_path','sitov_get_learning_recommendation_sources'].includes(name))).toBe(true)
 })
 it.each(['01da78e3-726f-g505-a9d6-fbb907ccb31f','01da78e3_726f-a505-a9d6-fbb907ccb31f','01da78e3-726f-a505-a9d6-fbb907ccb31'])('rejects malformed stored catalog unit %s',async value=>{
  capturedUnit=value
  expect(await resolveSitovLearningRecommendations(mappedInput)).toEqual({ok:false,error:'retryable_failure',retryable:true})
 })
 it('keeps a valid path after current verb permission is revoked',async()=>{
  allowed=[nodeId]
  const r=await resolveSitovLearningRecommendations(mappedInput);if(!r.ok)throw new Error('failure')
  expect(r.data.items.map(item=>item.targetId)).toEqual([nodeId]);expect(client.from).not.toHaveBeenCalled()
 })
 it('omits a revoked catalog verb without trusting a permissive guard',async()=>{
  verbPublished=false
  const r=await resolveSitovLearningRecommendations(mappedInput);if(!r.ok)throw new Error('failure')
  expect(r.data.items.map(item=>item.targetId)).toEqual([nodeId]);expect(currentUserHasContentAccess).not.toHaveBeenCalledWith({kind:'verb',id:verbId});expect(client.from).not.toHaveBeenCalled()
 })
})

describe('authorized recommendation variety within stored status priority',()=>{
 const cards=topic.targets.filter(t=>t.kind==='vocabulary_card')
 const verbs=topic.targets.filter(t=>t.kind==='verb')
 const reading=topic.targets.find(t=>t.kind==='reading_text')!
 const readingUnit='77777777-7777-4777-8777-777777777777'
 let resumeCards:boolean
 beforeEach(()=>{
  resumeCards=false;allowed=topic.targets.map(t=>t.id)
  client.rpc.mockImplementation(async(name,args)=>{
   if(name==='get_sitov_access_catalog')return {error:null,data:{version:1,level:args.p_level,trainer:args.p_trainer,units:args.p_trainer==='vocabulary'?cards.map(t=>({id:t.unitId,items:[{kind:t.kind,id:t.id,published:true}]})):args.p_trainer==='verbs'?[{id:readingUnit,items:verbs.map(t=>({kind:'verb',id:t.id,published:true}))}]:args.p_trainer==='pronunciation'?[{id:readingUnit,items:[{kind:'reading_text',id:reading.id,published:true}]}]:[]}}
   if(name==='sitov_learning_checkpoint')return {error:null,data:{checkpoint:resumeCards?{revision:1,updatedAt:'2026-10-09',state:{plan:[progressId]}}:null}}
   if(name==='sitov_get_pronunciation_pretests')return {error:null,data:{ok:true,data:[{textId:reading.id,unitId:readingUnit,level:topic.level,title:'Guten Tag',focus:null,kind:'regular',textVersion:'a'.repeat(64),testVersion:'b'.repeat(64),status:'available',lockedReason:null,attempt:null,proof:null,target:'pretest'}]}}
   throw new Error('unexpected prerequisite or write')
  })
 })
 it('does not let repeated cards and verbs starve the individual pronunciation pretest',async()=>{
  const r=await resolveSitovLearningRecommendations(input);if(!r.ok)throw new Error('failure')
  expect(r.data.items.map(item=>item.kind)).toEqual(['vocabulary','verbs','pronunciation'])
  expect(r.data.items[2]).toMatchObject({targetId:reading.id,action:'pretest',progress:{source:'pronunciation',status:'available'}})
  expect(client.rpc.mock.calls.every(([name,args])=>['get_sitov_access_catalog','sitov_get_pronunciation_pretests'].includes(name)||(name==='sitov_learning_checkpoint'&&args.p_action==='get'))).toBe(true)
 })
 it('keeps every resumable card ahead of lower-priority trainer variety',async()=>{
  resumeCards=true
  const r=await resolveSitovLearningRecommendations(input);if(!r.ok)throw new Error('failure')
  expect(r.data.items.map(item=>item.kind)).toEqual(['vocabulary','vocabulary','verbs'])
  expect(r.data.items.map(item=>item.action)).toEqual(['continue','continue','practice'])
 })
 it('never fills variety with a currently denied target and respects the requested limit',async()=>{
  allowed=allowed.filter(id=>id!==reading.id)
  const r=await resolveSitovLearningRecommendations({...input,limit:2});if(!r.ok)throw new Error('failure')
  expect(r.data.items).toHaveLength(2);expect(r.data.items.map(item=>item.kind)).toEqual(['vocabulary','verbs']);expect(r.data.items.every(item=>allowed.includes(item.targetId))).toBe(true)
 })
})

it('validates every expanded mapping against authoritative same-level source catalogs',()=>{
 const fs=jest.requireActual<typeof import('node:fs')>('node:fs')
 const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'))
 const catalog={nodes:ACCESS_LEVELS.flatMap(level=>read(`supabase/seeds/path-${level.toLowerCase()}.json`).flatMap(p=>p.nodes.map(n=>({level:p.level,pathSourceId:p.id,nodeSourceId:n.id})))),targets:[
  ...read('content/vocabulary/sitov-vocabulary-seed.json').units.flatMap(u=>u.cards.map(c=>({kind:'vocabulary_card',id:c.id,level:u.level,unitId:u.id}))),
  ...read('lib/verbs/catalog-data.json').map(v=>({kind:'verb',id:v.id,level:v.level})),
  ...read('supabase/seeds/pronunciation-reading-2026.json').map(t=>({kind:'reading_text',id:t.id,level:t.level})),
 ]}
 const {validateSitovTopicMapping}=jest.requireActual<typeof import('@/lib/learning/sitov-topic-mapping')>('@/lib/learning/sitov-topic-mapping')
 expect(validateSitovTopicMapping(SITOV_TOPIC_MAPPING,catalog)).toEqual([])
 const added=SITOV_TOPIC_MAPPING.filter(t=>/-a1[12]$/.test(t.topicId));expect(added).toHaveLength(9)
 expect(added.every(t=>t.targets.every(target=>target.kind!=='vocabulary_card'))).toBe(true)
 const invalid=structuredClone(added);invalid[0].anchors[0].level='A1.2'
 expect(validateSitovTopicMapping(invalid,catalog).some(error=>error.startsWith('anchor:'))).toBe(true)
})


it.each(['A2.1','A2.2','B1.1','B1.2'] as const)('resolves the exact authorized %s vocabulary target and current progress',async level=>{
 const mapped=SITOV_TOPIC_MAPPING.find(t=>t.level===level)!
 const card=mapped.targets.find(t=>t.kind==='vocabulary_card')!
 if(card.kind!=='vocabulary_card')throw new Error('missing concrete card')
 allowed=[card.id]
 client.rpc.mockImplementation(async(name,args)=>{
  if(name==='get_sitov_access_catalog')return {error:null,data:{version:1,level:args.p_level,trainer:args.p_trainer,units:args.p_trainer==='vocabulary'?[{id:card.unitId,items:[{kind:'vocabulary_card',id:card.id,published:true}]}]:[]}}
  if(name==='sitov_learning_checkpoint')return {error:null,data:{checkpoint:null}}
  throw new Error('unexpected rpc')
 })
 const requested={topicIds:[mapped.topicId],locale:'tr',limit:3}
 const result=await resolveSitovLearningRecommendations(requested)
 expect(result).toEqual({ok:true,data:{mappingVersion:1,items:[expect.objectContaining({kind:'vocabulary',level,targetId:card.id,topicId:mapped.topicId,action:'practice',href:`/tr/dashboard/level/${level}/vocabulary/lessons?sitov_target=${card.id}`})]}})
 expect(filters.some(row=>row.card_id===card.id&&row.auth_user_id==='account-a')).toBe(true)
 expect(client.rpc.mock.calls.filter(([name])=>name==='get_sitov_access_catalog').every(([,args])=>args.p_level===level)).toBe(true)
 allowed=[]
 expect(await resolveSitovLearningRecommendations(requested)).toEqual({ok:true,data:{mappingVersion:1,items:[]}})
})

it('keeps higher-level coverage partial and rejects cross-level, foreign and duplicate references',()=>{
 const fs=jest.requireActual<typeof import('node:fs')>('node:fs')
 const read=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'))
 const {validateSitovTopicMapping}=jest.requireActual<typeof import('@/lib/learning/sitov-topic-mapping')>('@/lib/learning/sitov-topic-mapping')
 const higher=SITOV_TOPIC_MAPPING.filter(t=>!['A1.1','A1.2'].includes(t.level))
 expect(higher.map(t=>t.level)).toEqual(['A2.1','A2.2','B1.1','B1.2'])
 expect(SITOV_TOPIC_MAPPING).toHaveLength(20)
 const catalog={nodes:ACCESS_LEVELS.flatMap(level=>read(`supabase/seeds/path-${level.toLowerCase()}.json`).flatMap(p=>p.nodes.map(n=>({level:p.level,pathSourceId:p.id,nodeSourceId:n.id})))),targets:[
  ...read('content/vocabulary/sitov-vocabulary-seed.json').units.flatMap(u=>u.cards.map(c=>({kind:'vocabulary_card',id:c.id,level:u.level,unitId:u.id}))),
  ...read('lib/verbs/catalog-data.json').map(v=>({kind:'verb',id:v.id,level:v.level})),
  ...read('supabase/seeds/pronunciation-reading-2026.json').map(t=>({kind:'reading_text',id:t.id,level:t.level})),
 ]}
 expect(validateSitovTopicMapping(SITOV_TOPIC_MAPPING,catalog)).toEqual([])
 for(const level of ['B2.1','B2.2','C1.1','C1.2'])expect(catalog.targets.filter(t=>t.level===level)).toHaveLength(0)
 const cross=structuredClone(higher);cross[0].targets[0].level='A2.2'
 expect(validateSitovTopicMapping(cross,catalog)).toContain(`target:${cross[0].targets[0].kind}/${cross[0].targets[0].id}`)
 const foreign=structuredClone(higher);foreign[0].anchors[0].nodeSourceId='P1-N999'
 expect(validateSitovTopicMapping(foreign,catalog).some(error=>error.startsWith('anchor:'))).toBe(true)
 const repeated=structuredClone(higher);repeated[0].targets=[...repeated[0].targets,repeated[0].targets[0]]
 expect(validateSitovTopicMapping(repeated,catalog).some(error=>error.startsWith('target:'))).toBe(true)
 expect(validateSitovTopicMapping([higher[0],higher[0]],catalog)).toEqual(expect.arrayContaining([`topic:${higher[0].topicId}`,`competency:${higher[0].competencyId}`]))
})
