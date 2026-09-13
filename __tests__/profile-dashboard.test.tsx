import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { createProfileTranslator, PROFILE_FALLBACKS } from '@/lib/profile-i18n'
import { profileMonthWindow } from '@/lib/profile-month'
import ProfileMonthlyCourses from '@/components/dashboard/ProfileMonthlyCourses'
import ProfileDetailsForm from '@/components/dashboard/ProfileDetailsForm'
import { saveNextMonthBooking, getProfileMonthlyState } from '@/app/actions/monthly-bookings'
import { updatePersonalDetails } from '@/app/actions/profile'
import type { ProfileMonthlyState, MonthlyCourseBooking } from '@/lib/types/monthly-bookings'
import type { BackendActionResult } from '@/lib/types/backend'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'
jest.unmock('lucide-react')
jest.mock('@/app/actions/monthly-bookings',()=>({saveNextMonthBooking:jest.fn(),getProfileMonthlyState:jest.fn()}))
jest.mock('@/app/actions/profile',()=>({updatePersonalDetails:jest.fn()}))

const one='00000000-0000-4000-8000-000000000001',two='00000000-0000-4000-8000-000000000002'
const initial: ProfileMonthlyState = {
  targetMonth:profileMonthWindow().next, booking:null,source:'previous',selection:{courseSelections:[{courseId:one}],paused:false},
  courses:[{id:one,title:'A1',slug:'a1',translations:[],unitPrice:25,unitMinutes:45,category:'online',type:'online',available:true},{id:two,title:'A2',slug:'a2',translations:[],unitPrice:25,unitMinutes:45,category:'german',type:'presence',available:true}],
}
const row=(ids:string[],paused=false):MonthlyCourseBooking=>({id:two,userId:one,targetMonth:initial.targetMonth,courseSelections:ids.map(courseId=>({courseId})),revision:1,status:paused?'cancelled':'pending'})
const renderCourses=(state=initial,lang='de',translations=de.profile)=>render(<ProfileMonthlyCourses initial={state} lang={lang} translations={translations} courseTitles={{[one]:'A1',[two]:'A2'}} />)
const profile={display_name:'Anna',email:'anna@example.invalid',phone:null,street:null,postal_code:'00123',city:'Berlin'}
beforeEach(()=>{
  jest.clearAllMocks()
  jest.mocked(getProfileMonthlyState).mockResolvedValue({success:true,data:initial})
  jest.mocked(saveNextMonthBooking).mockResolvedValue({success:true,data:row([one,two])})
})

it('calculates months in Berlin across year and UTC boundaries',()=>{
  expect(profileMonthWindow(new Date('2026-12-31T23:30:00Z')).next).toBe('2027-02-01')
  expect(profileMonthWindow(new Date('2026-09-30T22:30:00Z')).next).toBe('2026-11-01')
  expect(profileMonthWindow(new Date('2028-02-29T10:00:00Z')).next).toBe('2028-03-01')
})
it.each([['de',de],['en',en],['ru',ru],['uk',uk],['tr',tr]] as const)('all profile strings and placeholders exist for %s',(lang,dict)=>{
  for(const key of Object.keys(PROFILE_FALLBACKS)) {
    expect(dict.profile[key]).toEqual(expect.any(String))
    expect(dict.profile[key].length).toBeGreaterThan(0)
    expect((dict.profile[key].match(/\{\w+\}/g)??[]).sort()).toEqual((de.profile[key].match(/\{\w+\}/g)??[]).sort())
  }
  renderCourses(initial,lang,dict.profile)
  expect(screen.getByRole('switch',{name:dict.profile.pause_next_month})).toBeInTheDocument()
  expect(screen.getByRole('heading',{name:dict.profile.next_month_title})).toBeInTheDocument()
})
it('shows inherited current courses as default',()=>{
  renderCourses()
  expect(screen.getByRole('checkbox',{name:'A1'})).toHaveAttribute('aria-checked','true')
  expect(screen.getByText(de.profile.inherited_courses)).toBeInTheDocument()
})
it('updates immediately and serializes rapid edits with the acknowledged record',async()=>{
  let resolveFirst: (value:BackendActionResult<MonthlyCourseBooking>)=>void=()=>{}
  jest.mocked(saveNextMonthBooking).mockImplementationOnce(()=>new Promise(resolve=>{resolveFirst=resolve}))
    .mockResolvedValueOnce({success:true,data:row([two])})
  renderCourses()
  fireEvent.click(screen.getByRole('checkbox',{name:'A2'}))
  expect(screen.getByRole('checkbox',{name:'A2'})).toHaveAttribute('aria-checked','true')
  fireEvent.click(screen.getByRole('checkbox',{name:'A1'}))
  expect(screen.getByRole('checkbox',{name:'A1'})).toHaveAttribute('aria-checked','false')
  expect(saveNextMonthBooking).toHaveBeenCalledTimes(1)
  await act(async()=>resolveFirst({success:true,data:row([one,two])}))
  await waitFor(()=>expect(saveNextMonthBooking).toHaveBeenCalledTimes(2))
  expect(jest.mocked(saveNextMonthBooking).mock.calls[1][0]).toMatchObject({courseSelections:[{courseId:two}],expected:{id:two,revision:1}})
  expect(screen.getByRole('checkbox',{name:'A1'})).toHaveAttribute('aria-checked','false')
})
it('rolls back and reconciles after a failed save',async()=>{
  jest.mocked(saveNextMonthBooking).mockResolvedValue({success:false,error:'request_failed'})
  renderCourses()
  fireEvent.click(screen.getByRole('checkbox',{name:'A2'}))
  await waitFor(()=>expect(screen.getByRole('checkbox',{name:'A2'})).toHaveAttribute('aria-checked','false'))
  expect(screen.getByRole('alert')).toHaveTextContent(de.profile.save_failed)
})
it('persists a pause with no selected courses and restores it on reload',async()=>{
  jest.mocked(saveNextMonthBooking).mockResolvedValue({success:true,data:row([],true)})
  const view=renderCourses({...initial,selection:{courseSelections:[],paused:false}})
  fireEvent.click(screen.getByRole('switch'))
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','true')
  await waitFor(()=>expect(saveNextMonthBooking).toHaveBeenCalledWith(expect.objectContaining({courseSelections:[],paused:true})))
  await screen.findByText(de.profile.pause_saved)
  view.unmount()
  renderCourses({...initial,booking:row([],true),selection:{courseSelections:[],paused:true},source:'booking'})
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked','true')
})
it('cannot resume an empty pause without choosing a course',async()=>{
  renderCourses({...initial,selection:{courseSelections:[],paused:true}})
  fireEvent.click(screen.getByRole('switch'))
  expect(screen.getByText(de.profile.choose_to_resume)).toBeInTheDocument()
  expect(saveNextMonthBooking).not.toHaveBeenCalled()
})
it('clears the selected units when explicitly pausing the next month',async()=>{
  jest.mocked(saveNextMonthBooking).mockResolvedValue({success:true,data:row([],true)})
  renderCourses()
  fireEvent.click(screen.getByRole('switch'))
  await waitFor(()=>expect(saveNextMonthBooking).toHaveBeenCalledWith({targetMonth:initial.targetMonth,courseSelections:[],paused:true,expected:null}))
  expect(screen.getByRole('checkbox',{name:'A1'})).toHaveAttribute('aria-checked','false')
})
it('saves the chosen private lesson quantity with the acknowledged revision',async()=>{
  const privateState:ProfileMonthlyState={...initial,source:'booking',booking:{...row([one]),courseSelections:[{courseId:one,requestedUnits:3}]},
    selection:{courseSelections:[{courseId:one,requestedUnits:3}],paused:false},courses:[{...initial.courses[0],category:'private'}]}
  jest.mocked(saveNextMonthBooking).mockResolvedValue({success:true,data:{...row([one]),revision:2,courseSelections:[{courseId:one,requestedUnits:4}]}})
  renderCourses(privateState)
  expect(screen.getByRole('spinbutton',{name:'Unterrichtseinheiten'})).toHaveValue(3)
  fireEvent.click(screen.getByRole('button',{name:'Eine Einheit mehr'}))
  await waitFor(()=>expect(saveNextMonthBooking).toHaveBeenCalledWith({targetMonth:initial.targetMonth,courseSelections:[{courseId:one,requestedUnits:4}],paused:false,expected:{id:two,revision:1}}))
  expect(screen.getByRole('spinbutton')).toHaveValue(4)
  expect(screen.getByText('100,00 €')).toBeInTheDocument()
})
it('keeps confirmed contact values after an email-only failure',async()=>{
  jest.mocked(updatePersonalDetails).mockResolvedValue({success:true,data:{profile:{...profile,display_name:'Anna Neu'},pendingEmail:null,emailChange:'failed'}})
  render(<ProfileDetailsForm initial={profile} pendingEmail={null} lang="de" translations={de.profile} />)
  fireEvent.change(screen.getByLabelText(de.profile.name),{target:{value:'Anna Neu'}})
  fireEvent.change(screen.getByLabelText(de.profile.email),{target:{value:'new@example.invalid'}})
  fireEvent.click(screen.getByRole('button',{name:de.profile.save_details}))
  expect(screen.getByLabelText(de.profile.name)).toHaveValue('Anna Neu')
  await screen.findByText(de.profile.email_change_failed)
  expect(screen.getByLabelText(de.profile.name)).toHaveValue('Anna Neu')
  expect(screen.getByLabelText(de.profile.email)).toHaveValue(profile.email)
})
it('rolls back profile fields on save failure',async()=>{
  jest.mocked(updatePersonalDetails).mockResolvedValue({success:false,error:'request_failed'})
  render(<ProfileDetailsForm initial={profile} pendingEmail={null} lang="de" translations={de.profile} />)
  fireEvent.change(screen.getByLabelText(de.profile.name),{target:{value:'Temporary'}})
  fireEvent.click(screen.getByRole('button',{name:de.profile.save_details}))
  await screen.findByText(de.profile.profile_save_failed)
  expect(screen.getByLabelText(de.profile.name)).toHaveValue('Anna')
})
it('restores pending email confirmation on reload',()=>{
  render(<ProfileDetailsForm initial={profile} pendingEmail="pending@example.invalid" lang="uk" translations={uk.profile} />)
  expect(screen.getByLabelText(uk.profile.email)).toHaveValue('pending@example.invalid')
  expect(screen.getByText(createProfileTranslator(uk.profile)('pending_email',{email:'pending@example.invalid'}))).toBeInTheDocument()
})
