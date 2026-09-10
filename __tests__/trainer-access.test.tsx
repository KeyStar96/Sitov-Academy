import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { hasTrainerAccess, TRAINERS, type LevelAccessProfile } from '@/lib/access/levels'
import LevelTrainerCards from '@/components/dashboard/LevelTrainerCards'
import StudentList from '@/components/admin/StudentList'
import { AdminI18nProvider } from '@/components/admin/AdminI18nProvider'
import { updateStudentTrainerAccess } from '@/app/actions/admin'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

jest.unmock('lucide-react')
jest.mock('@/app/actions/admin', () => ({ updateStudentTrainerAccess: jest.fn(), updateStudentRole: jest.fn(), updateStudentAllowedLevels: jest.fn() }))
jest.mock('@/components/admin/BlackboardProvider', () => ({ useBlackboard: () => ({ getBoard: () => ({ noteText: '', discount: 0 }) }) }))
jest.mock('@/components/admin/BlackboardEditor', () => () => null)
jest.mock('@/components/admin/StudentDetailModal', () => () => null)
const student: LevelAccessProfile = { role: 'student', allowed_levels: ['A1.1','A1.2'] }
const denied = { ...student, student_trainer_access: [{ level: 'A1.1', trainer: 'exercises', enabled: false }] }

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
describe('Student trainer cards', () => {
 test.each([['de',de],['en',en],['ru',ru],['uk',uk],['tr',tr]] as const)('locked card has label and no navigation in %s', (lang,dict) => {
  render(<LevelTrainerCards lang={lang} level="A1.1" profile={denied} translations={dict.dashboard} />)
  const locked=screen.getByRole('heading',{name:dict.dashboard.cat_exercises_title}).closest('article')!
  expect(locked).toHaveAttribute('aria-disabled','true')
  expect(within(locked).getByText(dict.dashboard.trainer_locked_badge)).toBeVisible()
  expect(within(locked).queryByRole('link')).toBeNull()
  expect(locked.querySelector('svg')).not.toBeNull()
  expect(screen.getAllByRole('link')).toHaveLength(3)
 })
})
describe('Teacher trainer controls', () => {
 const id='00000000-0000-4000-8000-000000000001'
 const renderList=()=>render(<AdminI18nProvider translations={de.admin}><StudentList initialStudents={[{
  id, email:'learner@example.test',name:'Lernende',role:'student',allowed_levels:['A1.1'],created_at:null,phone:null,street:null,zip_code:null,city:null,
 }]} lang="de" currentUserRole="teacher" /></AdminI18nProvider>)
 beforeEach(()=>jest.clearAllMocks())
 test('saves one trainer for the selected student and level',async()=>{
  jest.mocked(updateStudentTrainerAccess).mockResolvedValue({success:true})
  renderList()
  const labels=screen.getAllByLabelText('Lernende · A1.1 · Grammatikübungen')
  expect(labels[0]).toBeChecked()
  fireEvent.click(labels[0])
  await waitFor(()=>expect(updateStudentTrainerAccess).toHaveBeenCalledWith({userId:id,level:'A1.1',trainer:'exercises',enabled:false}))
  await waitFor(()=>expect(labels[0]).not.toBeDisabled())
  expect(labels[0]).not.toBeChecked()
  expect(screen.getAllByLabelText('Lernende · A1.1 · Vokabeltrainer')[0]).toBeChecked()
  expect(screen.getAllByLabelText('Lernende · A1.2 · Grammatikübungen')[0]).toBeDisabled()
 })
 test('failed save rolls back and reports a translated error',async()=>{
  jest.mocked(updateStudentTrainerAccess).mockResolvedValue({success:false})
  renderList()
  const checkbox=screen.getAllByLabelText('Lernende · A1.1 · Grammatikübungen')[0]
  fireEvent.click(checkbox)
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent(de.admin.trainer_save_failed))
  expect(checkbox).toBeChecked()
 })
})
