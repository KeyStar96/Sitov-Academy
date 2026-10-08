import { render, screen, act, fireEvent } from '@testing-library/react'
import SitovLearningRecommendations from '@/components/learning/SitovLearningRecommendations'
import { getSitovLearningRecommendations } from '@/app/actions/sitov-learning-recommendations'
import { sitovLearningRecommendationsCopy } from '@/lib/learning/sitov-learning-recommendations-copy'
jest.unmock('lucide-react')
jest.mock('@/app/actions/sitov-learning-recommendations',()=>({getSitovLearningRecommendations:jest.fn()}))
const topic='sitov.topic.kennenlernen',id='8d77bdb5-5ef5-47cc-805d-549d3f8ae059'
const response=(lang='en')=>({ok:true,data:{mappingVersion:1,items:[{kind:'vocabulary',level:'A1.1',targetId:id,topicId:topic,competencyId:'sitov.competency.kennenlernen',action:'continue',progress:{source:'vocabulary',directions:[],checkpoint:true},href:`/${lang}/dashboard/level/A1.1/vocabulary/lessons?sitov_target=${id}`} ]}})
beforeEach(()=>jest.clearAllMocks())
test.each(['de','en','ru','uk','tr'])('real resolver input and exact link in %s, optional help closed',async lang=>{
 jest.mocked(getSitovLearningRecommendations).mockResolvedValue(response(lang) as never)
 render(<SitovLearningRecommendations accountKey="account-a" topicIds={[topic]} lang={lang} />)
 expect(await screen.findByRole('link')).toHaveAttribute('href',response(lang).data.items[0].href)
 expect(getSitovLearningRecommendations).toHaveBeenCalledWith({topicIds:[topic],locale:lang,limit:3})
 expect(screen.getByRole('button',{name:sitovLearningRecommendationsCopy(lang).help})).toHaveAttribute('aria-expanded','false')
})
test('stale account/locale response cannot replace current empty authorized result',async()=>{
 let old!:(value:never)=>void
 jest.mocked(getSitovLearningRecommendations).mockImplementationOnce(()=>new Promise(resolve=>{old=resolve})).mockResolvedValueOnce({ok:true,data:{mappingVersion:1,items:[]}})
 const view=render(<SitovLearningRecommendations accountKey="account-a" topicIds={[topic]} lang="en" />)
 view.rerender(<SitovLearningRecommendations accountKey="account-b" topicIds={[topic]} lang="uk" />)
 await act(async()=>{old(response() as never)})
 expect(screen.queryByRole('link')).not.toBeInTheDocument()
})
test('malformed payload fails closed and retry uses resolver again',async()=>{
 jest.mocked(getSitovLearningRecommendations).mockResolvedValueOnce({ok:true,data:{items:[{href:'//evil'}]}} as never).mockResolvedValueOnce(response() as never)
 render(<SitovLearningRecommendations accountKey="account-a" topicIds={[topic]} lang="en" />)
 expect(await screen.findByRole('alert')).toHaveTextContent(sitovLearningRecommendationsCopy('en').error);expect(screen.queryByRole('link')).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Try again'}));expect(await screen.findByRole('link')).toBeInTheDocument();expect(getSitovLearningRecommendations).toHaveBeenCalledTimes(2)
})
