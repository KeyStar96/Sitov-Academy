import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import SitovLearningSpecial from '@/components/learning-path/SitovLearningSpecial'
import LearningPathClient from '@/components/learning-path/LearningPathClient'
import { startLearningNode, startLearningTest } from '@/app/actions/learning-path'
import { sitovSpecialCopy } from '@/lib/learning/sitov-learning-specials-i18n'
import { sitovSpecialResultSchema, type SitovSpecialResult } from '@/lib/learning/sitov-learning-specials-contract'
import type { PathMap } from '@/lib/learning-path-contract'
jest.unmock('lucide-react')
jest.mock('@/app/actions/learning-path',()=>({getLearningPath:jest.fn(),startLearningNode:jest.fn(),startLearningTest:jest.fn(),submitLearningAnswer:jest.fn(),saveLearningTestAnswer:jest.fn(),finishLearningTest:jest.fn(),getLearningTestReview:jest.fn()}))
const node='00000000-0000-4000-8000-000000000602',runId='00000000-0000-4000-8000-000000000900'
const ids=Array.from({length:10},(_,i)=>`00000000-0000-4000-8000-${String(701+i).padStart(12,'0')}`)
const tasks=ids.map(id=>({id,type:'multiple_choice' as const,content:{question:'Artikel?',options:['den','die','das']}}))
const base={runId,nodeId:node,definitionVersion:'a'.repeat(64),mode:'learning' as const,status:'in_progress' as const,revision:0,selected:ids,queue:ids,revealed:false,answers:{},tasks,learningSolution:null,result:null}
const ok=(data:unknown)=>sitovSpecialResultSchema.parse({ok:true,data})
const renderSpecial=(action:jest.Mock,lang='en')=>render(<SitovLearningSpecial nodeId={node} title="Akkusativ" lang={lang} accountKey="account-a" onClose={jest.fn()} action={action}/>)
beforeEach(()=>{jest.clearAllMocks();let n=1000;Object.defineProperty(crypto,'randomUUID',{configurable:true,value:jest.fn(()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`)})})
test.each(['de','en','ru','uk','tr'])('mode choice is read-only and unpublished response is honest in %s',async lang=>{
 const action=jest.fn().mockResolvedValue({ok:false,error:'authoring_not_ready',retryable:false});renderSpecial(action,lang)
 expect(action).not.toHaveBeenCalled();expect(screen.getByText('Akkusativ')).toHaveAttribute('translate','no')
 fireEvent.click(screen.getByRole('button',{name:sitovSpecialCopy(lang).learning}));expect(await screen.findByRole('alert')).toHaveTextContent(sitovSpecialCopy(lang).notReady)
 expect(action.mock.calls[0][0]).toMatchObject({operation:'start',nodeId:node,mode:'learning',locale:lang});expect(screen.queryByTestId('path-exercise')).not.toBeInTheDocument()
})
test('server resume/reveal/wrong rotates stack, right completes without a test score',async()=>{
 const revealed={...base,revision:5,revealed:true,learningSolution:{content:{correct_answer:'den'},explanation:null}}
 const resumed={...base,revision:4,queue:[ids[1],ids[0],...ids.slice(2)]}
 const rotated={...base,revision:6,queue:[ids[0],...ids.slice(2),ids[1]]}
 const action=jest.fn().mockResolvedValueOnce(ok(resumed)).mockResolvedValueOnce(ok({...revealed,queue:resumed.queue})).mockResolvedValueOnce(ok(rotated)).mockResolvedValueOnce(ok({...revealed,revision:7,queue:rotated.queue})).mockResolvedValueOnce(ok({...base,revision:8,status:'completed',queue:[]}))
 renderSpecial(action);fireEvent.click(screen.getByRole('button',{name:'Learn'}));await screen.findByRole('button',{name:'Reveal solution'})
 expect(screen.queryByRole('button',{name:'Correct'})).not.toBeInTheDocument();expect(screen.queryByText('den')).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Reveal solution'}));expect(await screen.findByText('den')).toHaveAttribute('lang','de')
 fireEvent.click(screen.getByRole('button',{name:'Try again later'}));await screen.findByRole('button',{name:'Reveal solution'});expect(action.mock.calls[2][0]).toMatchObject({operation:'wrong',runId,revision:5})
 fireEvent.click(screen.getByRole('button',{name:'Reveal solution'}));await screen.findByRole('button',{name:'Correct'});fireEvent.click(screen.getByRole('button',{name:'Correct'}));await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Stack completed'))
 expect(action.mock.calls[4][0]).toMatchObject({operation:'right',revision:7});expect(screen.queryByText(/Passed/)).not.toBeInTheDocument()
})
test('uncertain mutation retry reuses exact request ID revision and payload; CAS reload is get-only',async()=>{
 const action=jest.fn().mockResolvedValueOnce(ok(base)).mockResolvedValueOnce({ok:false,error:'retryable_failure',retryable:true}).mockResolvedValueOnce({ok:false,error:'revision_conflict',retryable:false}).mockResolvedValueOnce(ok({...base,revision:3}))
 renderSpecial(action);fireEvent.click(screen.getByRole('button',{name:'Learn'}));await screen.findByRole('button',{name:'Reveal solution'});fireEvent.click(screen.getByRole('button',{name:'Reveal solution'}));await screen.findByRole('alert')
 expect(screen.getByRole('button',{name:'Reveal solution'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Try again'}));await screen.findByRole('button',{name:'Load saved progress'});expect(action.mock.calls[2][0]).toEqual(action.mock.calls[1][0])
 fireEvent.click(screen.getByRole('button',{name:'Load saved progress'}));await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());expect(action.mock.calls[3][0]).toEqual({operation:'get',runId,locale:'en'})
})
test.each([7,8])('resumes persisted ten-answer test, server %i/10 alone determines result and next round',async correct=>{
 const answers=Object.fromEntries(ids.map(id=>[id,{index:0}]))
 const completed={...base,mode:'test',status:'completed',answers,result:{correct,total:10,passed:correct>=8,feedback:ids.map((itemId,i)=>({itemId,correct:i<correct,solution:{correct_answer:'den'},explanation:null}))}}
 const action=jest.fn().mockResolvedValueOnce(ok({...base,mode:'test',revision:11,answers})).mockResolvedValueOnce(ok({...completed,revision:12})).mockResolvedValueOnce(ok({...base,mode:'test',runId:'00000000-0000-4000-8000-000000000901'}))
 renderSpecial(action);fireEvent.click(screen.getByRole('button',{name:'Test · 10 tasks'}));await screen.findByRole('button',{name:'Grade test'});expect(screen.queryByText('den')).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Grade test'}));await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent(correct>=8?'Passed':'Not passed yet'));expect(action.mock.calls[1][0]).toMatchObject({operation:'submit',revision:11,answers})
 fireEvent.click(screen.getByRole('button',{name:'New test round'}));await screen.findByTestId('path-exercise');expect(action.mock.calls[2][0]).toMatchObject({operation:'start',nodeId:node,mode:'test'});expect(action.mock.calls[2][0].requestId).not.toEqual(action.mock.calls[0][0].requestId)
})
test('test saves exact task answer through real input form without showing solutions',async()=>{
 const action=jest.fn().mockResolvedValueOnce(ok({...base,mode:'test'})).mockResolvedValueOnce(ok({...base,mode:'test',revision:1,answers:{[ids[0]]:{index:0}}}))
 renderSpecial(action);fireEvent.click(screen.getByRole('button',{name:'Test · 10 tasks'}));await screen.findByTestId('path-exercise');fireEvent.click(screen.getByRole('radio',{name:'den'}));fireEvent.click(screen.getByTestId('path-check'));await waitFor(()=>expect(action).toHaveBeenCalledTimes(2));expect(action.mock.calls[1][0]).toMatchObject({operation:'save',runId,revision:0,answers:{[ids[0]]:{index:0}}});expect(screen.queryByRole('button',{name:'Correct'})).not.toBeInTheDocument()
})
test('account change discards delayed prior account response',async()=>{
 let finish!:(r:SitovSpecialResult)=>void;const action=jest.fn(()=>new Promise<SitovSpecialResult>(resolve=>{finish=resolve}))
 const view=renderSpecial(action);fireEvent.click(screen.getByRole('button',{name:'Learn'}));view.rerender(<SitovLearningSpecial nodeId={node} title="Akkusativ" lang="en" accountKey="account-b" onClose={jest.fn()} action={action}/>)
 await act(async()=>finish(ok(base)));expect(screen.queryByRole('button',{name:'Reveal solution'})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Learn'})).toBeEnabled()
})
test('existing and exact Special entrances open mode choice without legacy actions/main-path writes',()=>{
 const map:PathMap={level:'A1.1',completed:false,resume_node_id:node,next_level:null,next_level_available:false,paths:[{id:runId,source_id:'P1',title:'Pfad',sort_order:1,available:true,completed:false,nodes:[{id:node,kind:'special',title:'Akkusativ',sort_order:1,available:true,status:null,stars:0,tests:[]}]}]}
 const old=JSON.stringify(map),view=render(<LearningPathClient initialPath={map} lang="en" level="A1.1" recommendationAccountKey="account-a"/>);fireEvent.click(screen.getByTestId(`path-node-${node}`));expect(screen.getByRole('button',{name:'Test · 10 tasks'})).toBeInTheDocument();expect(startLearningNode).not.toHaveBeenCalled();expect(startLearningTest).not.toHaveBeenCalled();expect(JSON.stringify(map)).toBe(old)
 view.unmount();render(<LearningPathClient initialPath={map} lang="en" level="A1.1" recommendationAccountKey="account-a" sitovTarget={node}/>);fireEvent.click(screen.getByLabelText('Selected learning target').querySelector('button')!);expect(screen.getByRole('button',{name:'Learn'})).toBeInTheDocument();expect(startLearningNode).not.toHaveBeenCalled();expect(JSON.stringify(map)).toBe(old)
})
test.each(['scope_insufficient_for_test','version_conflict','not_found','authentication_required'])('%s is an honest blocked state without fabricated task',async error=>{
 const action=jest.fn().mockResolvedValue({ok:false,error,retryable:false});renderSpecial(action);fireEvent.click(screen.getByRole('button',{name:'Test · 10 tasks'}));expect(await screen.findByRole('alert')).toBeInTheDocument();expect(screen.queryByTestId('path-exercise')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Grade test'})).not.toBeInTheDocument()
})
test('repeated start presses cannot create simultaneous mutations; foreign or malformed results never render',async()=>{
 let resolve!:(r:SitovSpecialResult)=>void;const action=jest.fn(()=>new Promise<SitovSpecialResult>(done=>{resolve=done}));renderSpecial(action)
 const button=screen.getByRole('button',{name:'Learn'});fireEvent.click(button);fireEvent.click(button);expect(action).toHaveBeenCalledTimes(1)
 await act(async()=>resolve(ok({...base,nodeId:ids[0]})));expect(screen.getByRole('alert')).toHaveTextContent('changed');expect(screen.queryByRole('button',{name:'Reveal solution'})).not.toBeInTheDocument()
})
test('malformed uncertain response retries exactly the original start request',async()=>{
 const action=jest.fn().mockResolvedValueOnce({ok:true,data:{...base,learningSolution:{content:{correct_answer:'den'},explanation:null}}}).mockResolvedValueOnce(ok(base));renderSpecial(action)
 fireEvent.click(screen.getByRole('button',{name:'Learn'}));await screen.findByRole('alert');expect(screen.queryByText('den')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Try again'}));await screen.findByRole('button',{name:'Reveal solution'});expect(action.mock.calls[1][0]).toEqual(action.mock.calls[0][0])
})
