jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/lib/request-session', () => ({ requestSession: jest.fn() }))
jest.mock('@/lib/learning/sitov-learning-recommendations-server', () => ({ resolveSitovLearningRecommendations: jest.fn() }))
import { requestSession } from '@/lib/request-session'
import { resolveSitovLearningRecommendations } from '@/lib/learning/sitov-learning-recommendations-server'
import { SITOV_TOPIC_MAPPING } from '@/lib/learning/sitov-topic-mapping'
import { enrichSitovPronunciationPretestLearningLinks } from '@/lib/sitov-pronunciation-pretest-learning-links'
import type { SitovPronunciationPretestCompletedAttempt } from '@/lib/sitov-pronunciation-pretest-contract'
const id='00000000-0000-4000-8000-000000000001', version='a'.repeat(64), testVersion='b'.repeat(64), topic=SITOV_TOPIC_MAPPING[0]
const result={attemptId:id,textId:id,textVersion:version,testVersion,passed:false,correct:1,total:3,competencies:[{id:'sitov.text.words',correct:1,total:3,required:2,met:false}],failedCompetencyIds:['sitov.text.words'],learningLinks:[],proof:null}
const value:SitovPronunciationPretestCompletedAttempt={attempt:{id,textId:id,textVersion:version,testVersion,status:'failed',revision:1,startedAt:'2026-10-08T21:00:00Z',updatedAt:'2026-10-08T21:00:00Z',questionIds:['sitov.q1','sitov.q2','sitov.q3'],answers:{},answeredCount:0,totalCount:3},result}
const data={attemptId:id,textId:id,textVersion:version,testVersion,failedCompetencyIds:result.failedCompetencyIds,topicIds:[topic.topicId]}
const rpc=jest.fn()
beforeEach(()=>{jest.clearAllMocks();rpc.mockResolvedValue({data:{ok:true,data},error:null});jest.mocked(requestSession).mockResolvedValue({user:{id},supabase:{rpc}} as unknown as Awaited<ReturnType<typeof requestSession>>);jest.mocked(resolveSitovLearningRecommendations).mockResolvedValue({ok:true,data:{mappingVersion:1,items:[]}})})
it('delegates only bound known topics to the current-rights resolver, never text core IDs',async()=>{
 const target='00000000-0000-4000-8000-000000000002',href=`/de/dashboard/level/A1.1/vocabulary/lessons?sitov_target=${target}`
 jest.mocked(resolveSitovLearningRecommendations).mockResolvedValue({ok:true,data:{mappingVersion:1,items:[{kind:'vocabulary',level:'A1.1',targetId:target,topicId:topic.topicId,competencyId:topic.competencyId,action:'practice',progress:{source:'vocabulary',directions:[],checkpoint:false},href}]}})
 const enriched=await enrichSitovPronunciationPretestLearningLinks(value)
 expect(rpc).toHaveBeenCalledWith('sitov_get_pronunciation_pretest_learning_topics',{p_attempt_id:id})
 expect(resolveSitovLearningRecommendations).toHaveBeenCalledWith({topicIds:[topic.topicId],locale:'de',limit:3})
 expect(enriched.result).toEqual({...result,learningLinks:[{kind:'vocabulary',level:'A1.1',targetId:target,href}]});expect(value.result).toEqual(result)
})
it.each([{attemptId:'00000000-0000-4000-8000-000000000002'},{textId:'00000000-0000-4000-8000-000000000002'},{textVersion:'c'.repeat(64)},{testVersion:'c'.repeat(64)},{failedCompetencyIds:['sitov.other']},{privateKey:'forbidden'},{topicIds:[topic.topicId,topic.topicId]}])('rejects companion binding/schema mismatch %j',async change=>{rpc.mockResolvedValue({data:{ok:true,data:{...data,...change}},error:null});expect(await enrichSitovPronunciationPretestLearningLinks(value)).toEqual(value);expect(resolveSitovLearningRecommendations).not.toHaveBeenCalled()})
it.each([{topicIds:[]},{topicIds:['sitov.topic.unknown']}])('unknown or empty topics produce no lookup %j',async ({topicIds})=>{rpc.mockResolvedValue({data:{ok:true,data:{...data,topicIds}},error:null});expect(await enrichSitovPronunciationPretestLearningLinks(value)).toEqual(value);expect(resolveSitovLearningRecommendations).not.toHaveBeenCalled()})
it('lookup and resolver failures preserve successful grading',async()=>{rpc.mockRejectedValueOnce(new Error('offline'));expect(await enrichSitovPronunciationPretestLearningLinks(value)).toEqual(value);jest.mocked(resolveSitovLearningRecommendations).mockRejectedValueOnce(new Error('denied'));expect(await enrichSitovPronunciationPretestLearningLinks(value)).toEqual(value)})
it('passed/outdated results never perform optional lookup',async()=>{await enrichSitovPronunciationPretestLearningLinks({...value,attempt:{...value.attempt,status:'passed'},result:{...result,passed:true}});await enrichSitovPronunciationPretestLearningLinks({...value,attempt:{...value.attempt,status:'outdated'}});expect(rpc).not.toHaveBeenCalled()})
