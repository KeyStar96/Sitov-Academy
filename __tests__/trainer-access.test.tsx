import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { hasTrainerAccess, hasConfiguredTrainerAccess, getAllowedLessons, TRAINERS, type LevelAccessProfile } from '@/lib/access/levels'
import LevelTrainerCards from '@/components/dashboard/LevelTrainerCards'
import StudentList from '@/components/admin/StudentList'
import { AdminI18nProvider } from '@/components/admin/AdminI18nProvider'
import { getAvailableLessons, updateStudentTrainerAccess, updateStudentAllowedLevels } from '@/app/actions/admin'
import type { AdminStudentRow } from '@/lib/types/admin-staff'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'
import { mediaCopy } from '@/lib/media-i18n'

jest.unmock('lucide-react')
jest.mock('@/app/actions/admin', () => ({ getAvailableLessons: jest.fn(), updateStudentTrainerAccess: jest.fn(), updateStudentRole: jest.fn(), updateStudentAllowedLevels: jest.fn() }))
jest.mock('@/components/admin/BlackboardProvider', () => ({ useBlackboard: () => ({ getBoard: () => ({ noteText: '' }) }) }))
jest.mock('@/components/admin/BlackboardEditor', () => () => null)
jest.mock('@/components/admin/StudentDetailModal', () => () => null)
const student: LevelAccessProfile = { role: 'student', allowed_levels: ['A1.1','A1.2'] }
const denied = { ...student, trainer_grants: [{ level: 'A1.1', trainer: 'exercises', enabled: false }] }

describe('Trainer entitlement decisions', () => {
 test.each(TRAINERS)('inherits existing level rights for %s', trainer => {
  expect(hasTrainerAccess(student,'A1.1',trainer)).toBe(true)
  expect(hasTrainerAccess(student,'B1.2',trainer)).toBe(false)
  expect(hasTrainerAccess(null,'A1.1',trainer)).toBe(false)
 })
 test('scope is the exact level and trainer; staff retain full access', () => {
  expect(hasTrainerAccess(denied,'A1.1','exercises')).toBe(false)
  expect(hasTrainerAccess(denied,'A1.2','exercises')).toBe(true)
  expect(hasTrainerAccess(denied,'A1.1','vocabulary')).toBe(true)
  expect(hasTrainerAccess({...denied,role:'teacher'},'A1.1','exercises')).toBe(true)
  expect(hasTrainerAccess({...denied,role:'admin'},'A1.1','exercises')).toBe(true)
  expect(hasTrainerAccess({...denied,allowed_levels:[]},'A1.1','vocabulary')).toBe(false)
 })
})
test('empty unit selections lock learner cards while teacher configuration remains editable, including German profiles',()=>{
 const profile={...student,ui_language:'de',trainer_grants:[{level:'A1.1',trainer:'pronunciation',enabled:true,unit_ids:[]}]}
 expect(hasConfiguredTrainerAccess(profile,'A1.1','pronunciation')).toBe(true)
 expect(hasTrainerAccess(profile,'A1.1','pronunciation')).toBe(false)
 expect(hasTrainerAccess({...profile,ui_language:'ru'},'A1.1','pronunciation')).toBe(false)
 expect(getAllowedLessons({...profile,ui_language:'ru'},'A1.1','pronunciation')).toEqual([])
})
describe('Student trainer cards', () => {
 test.each([['de',de],['en',en],['ru',ru],['uk',uk],['tr',tr]] as const)('locked card has label and no navigation in %s', (lang,dict) => {
  render(<LevelTrainerCards lang={lang} level="A1.1" profile={denied} translations={dict.dashboard} />)
  const locked=screen.getByRole('heading',{name:dict.dashboard.cat_exercises_title}).closest('article')!
  expect(locked).toHaveAttribute('aria-disabled','true')
  expect(within(locked).getByText(dict.dashboard.trainer_locked_badge)).toBeVisible()
  expect(within(locked).queryByRole('link')).toBeNull()
  expect(locked.querySelector('svg')).not.toBeNull()
  expect(screen.getAllByRole('link')).toHaveLength(lang === 'de' ? 2 : 4)
  expect(screen.getByRole('link', { name: `${mediaCopy(lang).title} ${mediaCopy(lang).intro}` })).toHaveAttribute('href', `/${lang}/dashboard/level/A1.1/media`)
 })
})
describe('Teacher trainer controls', () => {
 const id='00000000-0000-4000-8000-000000000001'
 const renderList=(rules: AdminStudentRow['trainer_grants'] = [])=>render(<AdminI18nProvider translations={de.admin}><StudentList initialStudents={[{
  id, person:{id,auth_user_id:id,display_name:'Lernende',email:'learner@example.test',phone:null,street:null,postal_code:null,city:null,birth_date:null,preferred_locale:'de',created_at:'2026-01-01',updated_at:'2026-01-01'},role:'student',allowed_levels:['A1.1'],created_at:null, trainer_grants: rules,
 }]} lang="de" currentUserRole="teacher" /></AdminI18nProvider>)
 const openAccess=()=>fireEvent.click(screen.getByRole('button',{name:'Freigaben für Lernende verwalten'}))
 beforeAll(()=>{
   HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')}
   HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')}
 })
 beforeEach(()=>{
   jest.clearAllMocks()
   jest.mocked(updateStudentTrainerAccess).mockResolvedValue({success:true})
   jest.mocked(getAvailableLessons).mockResolvedValue({success:true,lessons:[{id:'A1.1 · 01',label:'01 · Artikel'},{id:'A1.1 · 02',label:'02 · Verben'}]})
 })
 test('keeps the student row compact and edits exactly one level inside one dialog',async()=>{
  renderList()
  const table=screen.getByRole('table')
  expect(within(table).queryByRole('checkbox')).toBeNull()
  expect(table.querySelector('details')).toBeNull()
  openAccess()
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(document.body.style.overflow).toBe('hidden')
  const checkbox=screen.getByLabelText('Lernende · A1.1 · Grammatikübungen')
  expect(checkbox).toBeChecked()
  fireEvent.click(checkbox)
  await waitFor(()=>expect(updateStudentTrainerAccess).toHaveBeenCalledWith({userId:id,level:'A1.1',trainer:'exercises',enabled:false}))
  await waitFor(()=>expect(checkbox).not.toBeDisabled())
  expect(checkbox).not.toBeChecked()
  expect(screen.getByLabelText('Lernende · A1.1 · Vokabeltrainer')).toBeChecked()
  fireEvent.change(screen.getByLabelText(de.admin.access_level_select),{target:{value:'A1.2'}})
  expect(screen.getByLabelText('Lernende · A1.2 · Grammatikübungen')).toBeDisabled()
  expect(updateStudentAllowedLevels).not.toHaveBeenCalled()
  expect(within(table).queryByRole('checkbox')).toBeNull()
 })
 test('failed save rolls back and reports a translated error inside the dialog',async()=>{
  jest.mocked(updateStudentTrainerAccess).mockResolvedValue({success:false})
  renderList()
  openAccess()
  const checkbox=screen.getByLabelText('Lernende · A1.1 · Grammatikübungen')
  fireEvent.click(checkbox)
  await waitFor(()=>expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(de.admin.trainer_save_failed))
  expect(checkbox).toBeChecked()
 })
 test('trainer off/on keeps its selected lessons and an empty selection means none',async()=>{
  renderList([{level:'A1.1',trainer:'exercises',enabled:true,unit_ids:[]}])
  openAccess()
  const checkbox=screen.getByLabelText('Lernende · A1.1 · Grammatikübungen')
  fireEvent.click(checkbox)
  await waitFor(()=>expect(checkbox).not.toBeDisabled())
  fireEvent.click(checkbox)
  await waitFor(()=>expect(checkbox).not.toBeDisabled())
  fireEvent.click(screen.getAllByRole('button',{name:de.admin.restrict_lessons})[1])
  await waitFor(()=>expect(screen.getByLabelText('01 · Artikel')).toBeInTheDocument())
  expect(screen.getByLabelText('01 · Artikel')).not.toBeChecked()
  expect(screen.getByLabelText(de.admin.access_all_units)).not.toBeChecked()
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button',{name:de.admin.save}))
  await waitFor(()=>expect(updateStudentTrainerAccess).toHaveBeenLastCalledWith({userId:id,level:'A1.1',trainer:'exercises',enabled:true,allowedLessons:[]}))
 })
 test('pronunciation selects individual prompt ids with descriptive titles',async()=>{
  jest.mocked(getAvailableLessons).mockResolvedValue({success:true,lessons:[{id:'prompt-one',label:'Mein erster Tag'},{id:'prompt-two',label:'Ein Besuch im Park'}]})
  renderList()
  openAccess()
  fireEvent.click(screen.getByRole('button',{name:de.admin.pronunciation_access_button}))
  await waitFor(()=>expect(screen.getByLabelText('Mein erster Tag')).toBeInTheDocument())
  fireEvent.click(screen.getByLabelText('Mein erster Tag'))
  expect(screen.getByLabelText('Ein Besuch im Park')).toBeChecked()
  fireEvent.click(screen.getByRole('button',{name:de.admin.save}))
  await waitFor(()=>expect(updateStudentTrainerAccess).toHaveBeenCalledWith({userId:id,level:'A1.1',trainer:'pronunciation',enabled:true,allowedLessons:['prompt-two']}))
 })
 test('loading errors cannot overwrite existing access and can be retried',async()=>{
  jest.mocked(getAvailableLessons).mockResolvedValueOnce({success:false})
  renderList()
  openAccess()
  fireEvent.click(screen.getAllByRole('button',{name:de.admin.restrict_lessons})[0])
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent(de.admin.access_load_failed))
  expect(screen.getByRole('button',{name:de.admin.save})).toBeDisabled()
  expect(updateStudentTrainerAccess).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:de.admin.access_retry}))
  await waitFor(()=>expect(screen.getByLabelText('01 · Artikel')).toBeInTheDocument())
  expect(screen.getByRole('button',{name:de.admin.save})).not.toBeDisabled()
 })
 test('closing restores focus and body scrolling without changing access',()=>{
  renderList()
  const opener=screen.getByRole('button',{name:'Freigaben für Lernende verwalten'})
  opener.focus()
  openAccess()
  fireEvent.click(screen.getByRole('button',{name:de.admin.dialog_close}))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(document.body.style.overflow).toBe('')
  expect(opener).toHaveFocus()
  expect(updateStudentTrainerAccess).not.toHaveBeenCalled()
 })
})
