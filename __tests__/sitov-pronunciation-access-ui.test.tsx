import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import SitovPronunciationAccess from '@/components/admin/SitovPronunciationAccess'
import { getSitovPronunciationReadiness, setSitovPronunciationAccess } from '@/app/actions/sitov-pronunciation-access'
import { SITOV_PRONUNCIATION_REQUIREMENTS, type SitovPronunciationReadiness } from '@/lib/sitov-pronunciation-readiness'

jest.unmock('lucide-react')
jest.mock('@/app/actions/sitov-pronunciation-access', () => ({ getSitovPronunciationReadiness: jest.fn(), setSitovPronunciationAccess: jest.fn() }))
const refresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
const studentId = '00000000-0000-4000-8000-000000000001'
const state: SitovPronunciationReadiness = { level: 'A1.1', mode: 'logical', tier: 0,
 stats: { knownWords: 0, grammarNodes: 0, passedTests: 0, legacyGrammarExercises: 0, legacyGrammarTopics: 0, confidentVerbForms: 0, verbEvidenceRequired: true },
 requirements: SITOV_PRONUNCIATION_REQUIREMENTS.map(item=>({...item})), texts: [] }
beforeEach(()=>jest.clearAllMocks())

it('saves hard unlock for the exact student/level once and keeps the old state while the server checks access',async()=>{
 let finish: (result:{success:true})=>void = ()=>{}
 jest.mocked(setSitovPronunciationAccess).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
 jest.mocked(getSitovPronunciationReadiness).mockResolvedValue({...state,mode:'hard',tier:3})
 render(<SitovPronunciationAccess studentId={studentId} levels={['A1.1']} lang="de" initialReadiness={state} />)
 const hard=screen.getByRole('button',{name:/Hart freischalten/})
 fireEvent.click(hard);fireEvent.click(hard)
 expect(hard).toBeDisabled();expect(hard).toHaveAttribute('aria-pressed','false')
 expect(setSitovPronunciationAccess).toHaveBeenCalledTimes(1)
 expect(setSitovPronunciationAccess).toHaveBeenCalledWith({studentId,level:'A1.1',mode:'hard'})
 await act(async()=>finish({success:true}))
 await waitFor(()=>expect(hard).toHaveAttribute('aria-pressed','true'))
 expect(refresh).toHaveBeenCalledTimes(1);expect(screen.getByRole('status')).toHaveTextContent('Freigabe aktualisiert')
})
it('does not imply an unlock after a rejected write and exposes a useful retry',async()=>{
 jest.mocked(setSitovPronunciationAccess).mockResolvedValue({success:false,error:'not_authorized'})
 render(<SitovPronunciationAccess studentId={studentId} levels={['A1.1']} lang="en" initialReadiness={state} />)
 fireEvent.click(screen.getByRole('button',{name:/Hard unlock/}))
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Access could not be updated'))
 expect(screen.getByRole('button',{name:/Logical unlock/})).toHaveAttribute('aria-pressed','true')
 expect(getSitovPronunciationReadiness).not.toHaveBeenCalled();expect(refresh).not.toHaveBeenCalled()
})
it('fails closed when readiness cannot be loaded instead of showing a selected or working unlock',()=>{
 render(<SitovPronunciationAccess studentId={studentId} levels={['A1.1']} lang="en" initialReadiness={null} />)
 expect(screen.getByRole('button',{name:/Hard unlock/})).toBeDisabled()
 expect(screen.getByRole('alert')).toHaveTextContent('temporarily unavailable')
})
