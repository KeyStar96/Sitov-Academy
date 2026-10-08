jest.mock('@/lib/motion',()=>({...jest.requireActual('@/lib/motion'),useReducedMotionSafe:jest.fn(()=>true)}))
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SitovPathTargetChoice from '@/components/learning-path/SitovPathTargetChoice'
import { resolveSitovPathRecommendationTarget } from '@/lib/learning/sitov-learning-recommendations-path-target'
import { sitovLearningTargetCopy } from '@/lib/learning/sitov-learning-target-i18n'
import type { PathMap } from '@/lib/learning-path-contract'
const id='66666666-6666-4666-8666-666666666666'
const map: PathMap={level:'A1.1',completed:false,resume_node_id:id,next_level:null,next_level_available:false,paths:[{id:'55555555-5555-4555-8555-555555555555',source_id:'P1',title:'Pfad',sort_order:1,available:true,completed:false,nodes:[{id,kind:'practice',title:'Wie heißen Sie?',sort_order:3,available:true,status:'in_progress',stars:2,tests:[]}]}]}
test('unknown, malformed, foreign, revoked, duplicate and Special targets have no fallback',()=>{
 for(const raw of ['', [id], '77777777-7777-4777-8777-777777777777'])expect(resolveSitovPathRecommendationTarget(raw,'A1.1',map)).toEqual({error:'unavailable'})
 expect(resolveSitovPathRecommendationTarget(id,'A1.2',map)).toEqual({error:'unavailable'})
 for(const patch of [{available:false},{kind:'special' as const}])expect(resolveSitovPathRecommendationTarget(id,'A1.1',{...map,paths:[{...map.paths[0],nodes:[{...map.paths[0].nodes[0],...patch}]}]})).toEqual({error:'unavailable'})
 expect(resolveSitovPathRecommendationTarget(id,'A1.1',{...map,paths:[map.paths[0],map.paths[0]]})).toEqual({error:'unavailable'})
 expect(resolveSitovPathRecommendationTarget(id,'A1.1')).toEqual({error:'retryable'})
})
test('exact opening focuses read-only choice, preserves checkpoint/stars; start is explicit',async()=>{
 const before=JSON.stringify(map),open=jest.fn()
 render(<SitovPathTargetChoice raw={id} level="A1.1" map={map} lang="en" busy={false} onOpen={open} onRetry={jest.fn()} />)
 await waitFor(()=>expect(screen.getByLabelText('Selected learning target')).toHaveFocus())
 expect(open).not.toHaveBeenCalled();expect(JSON.stringify(map)).toBe(before)
 expect(screen.getByText('Wie heißen Sie?')).toHaveAttribute('lang','de');expect(screen.getByText('Wie heißen Sie?')).toHaveAttribute('translate','no')
 fireEvent.click(screen.getByRole('button'));expect(open).toHaveBeenCalledWith(map.paths[0].nodes[0],'Pfad',map.paths[0].id);expect(JSON.stringify(map)).toBe(before)
})
test.each(['de','en','ru','uk','tr'])('revoked choice has localized error and no start in %s',lang=>{
 render(<SitovPathTargetChoice raw="77777777-7777-4777-8777-777777777777" level="A1.1" map={map} lang={lang} busy={false} onOpen={jest.fn()} onRetry={jest.fn()} />)
 expect(screen.getByRole('alert')).toHaveTextContent(sitovLearningTargetCopy(lang).unavailable);expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('reduced motion keeps exact focus and explicit action with calm scrolling',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'scrollIntoView'),scroll=jest.fn(),open=jest.fn()
 Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:scroll})
 try {
  render(<SitovPathTargetChoice raw={id} level="A1.1" map={map} lang="en" busy={false} onOpen={open} onRetry={jest.fn()} />)
  await waitFor(()=>expect(scroll).toHaveBeenCalledWith({block:'center',behavior:'auto'}))
  expect(screen.getByLabelText('Selected learning target')).toHaveFocus();expect(open).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button'));expect(open).toHaveBeenCalledTimes(1)
 } finally { if(descriptor)Object.defineProperty(HTMLElement.prototype,'scrollIntoView',descriptor);else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView }
})
