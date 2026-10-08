import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import StudentAccessModal from '@/components/admin/StudentAccessModal'
import type { AdminStudentRow } from '@/lib/types/admin-staff'
import SitovCommercialAccessPanel from '@/components/admin/SitovCommercialAccessPanel'
import { getSitovStaffCommercialAccess, getSitovStaffCommercialCatalog, saveSitovStaffCommercialAccess } from '@/app/actions/sitov-commercial-access'
import { sitovCommercialAdminCopy } from '@/lib/admin-i18n'
jest.unmock('lucide-react')
jest.mock('@/app/actions/admin', () => ({ getAvailableLessons: jest.fn(), updateStudentTrainerAccess: jest.fn() }))
jest.mock('@/app/actions/sitov-commercial-access', () => ({ getSitovStaffCommercialAccess: jest.fn(), getSitovStaffCommercialCatalog: jest.fn(), saveSitovStaffCommercialAccess: jest.fn() }))
jest.mock('@/components/admin/AdminDialog', () => ({ __esModule: true, default: ({children}: {children:React.ReactNode}) => <div>{children}</div> }))
let mockLang = 'de'
jest.mock('next/navigation', () => ({ useParams: () => ({ lang: mockLang }) }))
jest.mock('@/components/motion/SitovTrainerHelp', () => ({ __esModule: true, default: ({title,children}: {title:string;children:React.ReactNode}) => <details><summary>{title}</summary>{children}</details> }))
const studentId='00000000-0000-4000-8000-000000000107', unit='00000000-0000-4000-8000-000000000211', card='00000000-0000-4000-8000-000000000301'
const state={vip_enabled:false,revision:2,purchased_levels:[],trial:{version:1 as const,rules:[]}}
beforeEach(() => {
  jest.clearAllMocks()
  mockLang='de'
  jest.mocked(getSitovStaffCommercialAccess).mockResolvedValue({ok:true,data:state})
  jest.mocked(getSitovStaffCommercialCatalog).mockResolvedValue({ok:true,data:{version:1,level:'A1.1',trainer:'vocabulary',units:[{id:unit,label:'Lektion 1',items:[{kind:'vocabulary_card',id:card,label:'Haus',published:true}]}]}})
  jest.mocked(saveSitovStaffCommercialAccess).mockResolvedValue({ok:true,data:{revision:3}})
})
it('saves a genuinely empty selection and handles CAS conflict without inventing success', async () => {
  render(<SitovCommercialAccessPanel studentId={studentId} onBusyChange={jest.fn()} />)
  const mode=await screen.findByRole('combobox',{name:'Einheiten'})
  fireEvent.change(mode,{target:{value:'selected'}})
  expect(screen.getByLabelText('Lektion 1')).not.toBeChecked()
  fireEvent.click(screen.getByRole('button',{name:'Testzugang speichern'}))
  await waitFor(() => expect(saveSitovStaffCommercialAccess).toHaveBeenCalledWith({kind:'trial',studentId,revision:2,manifest:{version:1,rules:[{level:'A1.1',trainer:'vocabulary',unit_ids:[],items:[]}]}}))
  await screen.findByText('Gespeichert')
  jest.mocked(saveSitovStaffCommercialAccess).mockResolvedValue({ok:false,error:'revision_conflict'})
  fireEvent.click(screen.getByRole('button',{name:'VIP freigeben'}))
  await screen.findByText('Die Freigabe wurde inzwischen geändert. Bitte neu laden.')
  expect(screen.getByRole('button',{name:'VIP freigeben'})).toBeDisabled()
  expect(screen.queryByText('Gespeichert')).not.toBeInTheDocument()
})
it('saves only the selected actual item and retains unrelated trial rules', async () => {
  const other={level:'A2.1' as const,trainer:'videos' as const,unit_ids:null,items:null}
  jest.mocked(getSitovStaffCommercialAccess).mockResolvedValue({ok:true,data:{...state,trial:{version:1,rules:[other]}}})
  render(<SitovCommercialAccessPanel studentId={studentId} onBusyChange={jest.fn()} />)
  fireEvent.change(await screen.findByRole('combobox',{name:'Einheiten'}),{target:{value:'selected'}})
  fireEvent.click(screen.getByLabelText('Lektion 1'))
  fireEvent.click(screen.getByLabelText(/Haus/))
  fireEvent.click(screen.getByRole('button',{name:'Testzugang speichern'}))
  await waitFor(() => expect(saveSitovStaffCommercialAccess).toHaveBeenCalledWith({kind:'trial',studentId,revision:2,manifest:{version:1,rules:[other,{level:'A1.1',trainer:'vocabulary',unit_ids:[unit],items:[{unit_id:unit,refs:[{kind:'vocabulary_card',id:card}]}]}]}}))
})
it.each(['de','en','ru','uk','tr'] as const)('has complete commercial copy for %s', locale => {
  expect(Object.keys(sitovCommercialAdminCopy[locale]).sort()).toEqual(Object.keys(sitovCommercialAdminCopy.de).sort())
  expect(Object.values(sitovCommercialAdminCopy[locale]).every(v=>v.length>0)).toBe(true)
})

it('VIP save leaves the existing manual access callbacks intact', async () => {
  const levelToggle=jest.fn(), trainerToggle=jest.fn(), lessonsUpdate=jest.fn()
  const student={id:studentId,allowed_levels:['A1.1'],trainer_grants:[],person:null} as unknown as AdminStudentRow
  render(<StudentAccessModal student={student} loading={false} message={null} hasError={false} onClose={jest.fn()} onLevelToggle={levelToggle} onTrainerToggle={trainerToggle} onLessonsUpdate={lessonsUpdate} />)
  await screen.findByRole('combobox',{name:'Einheiten'})
  fireEvent.click(screen.getByRole('button',{name:'VIP freigeben'}))
  await screen.findByText('Gespeichert')
  expect(levelToggle).not.toHaveBeenCalled(); expect(trainerToggle).not.toHaveBeenCalled(); expect(lessonsUpdate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('checkbox',{name:/^Sprachniveau A1.1/}))
  expect(levelToggle).toHaveBeenCalledWith(studentId,'A1.1')
})
it('encodes all future content as null rather than the current IDs', async () => {
  render(<SitovCommercialAccessPanel studentId={studentId} onBusyChange={jest.fn()} />)
  fireEvent.change(await screen.findByRole('combobox',{name:'Einheiten'}),{target:{value:'all'}})
  fireEvent.click(screen.getByRole('button',{name:'Testzugang speichern'}))
  await waitFor(() => expect(saveSitovStaffCommercialAccess).toHaveBeenCalledWith({kind:'trial',studentId,revision:2,manifest:{version:1,rules:[{level:'A1.1',trainer:'vocabulary',unit_ids:null,items:null}]}}))
})

it.each(['de','en','ru','uk','tr'] as const)('renders the actual editor in %s with German catalog labels', async locale => {
  mockLang=locale
  render(<SitovCommercialAccessPanel studentId={studentId} onBusyChange={jest.fn()} />)
  expect(await screen.findByRole('combobox',{name:sitovCommercialAdminCopy[locale].units})).toBeInTheDocument()
  expect(screen.getByRole('button',{name:sitovCommercialAdminCopy[locale].save})).toBeInTheDocument()
})
