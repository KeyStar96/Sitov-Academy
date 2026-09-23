import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { createProfileTranslator, PROFILE_FALLBACKS } from '@/lib/profile-i18n'
import { formatProfileMonth, profileMonthWindow } from '@/lib/profile-month'
import { studentTranslator } from '@/lib/student-ui-i18n'
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
jest.mock('@/app/actions/profile-calendar',()=>({getProfileCourseCalendar:jest.fn()}))

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
  expect(screen.getByRole('heading',{name:dict.profile.next_month_title})).toBeInTheDocument()
  expect(screen.getByRole('button',{name:studentTranslator(lang)('booking_change')})).toBeInTheDocument()
})
const s=studentTranslator('de')
const edit=()=>fireEvent.click(screen.getByRole('button',{name:s('booking_change')}))
const next=()=>fireEvent.click(screen.getByRole('button',{name:s('booking_next')}))
it('shows inherited current courses as the plan until the learner changes it',()=>{
  renderCourses()
  expect(screen.getByText('A1')).toBeInTheDocument()
  expect(screen.getByText(de.profile.inherited_courses)).toBeInTheDocument()
  expect(saveNextMonthBooking).not.toHaveBeenCalled()
})
it('keeps choices as a draft, summarises courses and dates, and saves once on confirmation',async()=>{
  let resolveFirst: (value:BackendActionResult<MonthlyCourseBooking>)=>void=()=>{}
  jest.mocked(saveNextMonthBooking).mockImplementationOnce(()=>new Promise(resolve=>{resolveFirst=resolve}))
    .mockResolvedValueOnce({success:true,data:{...row([two]),revision:2}})
  renderCourses({...initial,courses:initial.courses.map(course=>({...course,sessions:4}))})
  edit()
  fireEvent.click(screen.getByRole('checkbox',{name:'A2'}))
  expect(screen.getByRole('checkbox',{name:'A2'})).toHaveAttribute('aria-checked','true')
  expect(saveNextMonthBooking).not.toHaveBeenCalled()
  next()
  expect(screen.getByText(s('booking_summary',{month:formatProfileMonth(initial.targetMonth,'de')}))).toBeInTheDocument()
  expect(screen.getByText('2 Kurse')).toBeInTheDocument()
  expect(screen.getByText('8 Termine')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:s('booking_confirm')}))
  expect(saveNextMonthBooking).toHaveBeenCalledTimes(1)
  expect(jest.mocked(saveNextMonthBooking).mock.calls[0][0]).toMatchObject({courseSelections:[{courseId:one},{courseId:two}],paused:false,expected:null})
  await act(async()=>resolveFirst({success:true,data:row([one,two])}))
  expect(await screen.findByText(s('booking_saved'))).toBeInTheDocument()
  edit()
  fireEvent.click(screen.getByRole('checkbox',{name:'A1'}))
  next()
  fireEvent.click(screen.getByRole('button',{name:s('booking_confirm')}))
  await waitFor(()=>expect(saveNextMonthBooking).toHaveBeenCalledTimes(2))
  expect(jest.mocked(saveNextMonthBooking).mock.calls[1][0]).toMatchObject({courseSelections:[{courseId:two}],expected:{id:two,revision:1}})
})
it('keeps the draft and reconciles after a failed save',async()=>{
  jest.mocked(saveNextMonthBooking).mockResolvedValue({success:false,error:'request_failed'})
  renderCourses()
  edit()
  fireEvent.click(screen.getByRole('checkbox',{name:'A2'}))
  next()
  fireEvent.click(screen.getByRole('button',{name:s('booking_confirm')}))
  expect(await screen.findByRole('alert')).toHaveTextContent(de.profile.save_failed)
  expect(getProfileMonthlyState).toHaveBeenCalled()
  expect(screen.getByRole('button',{name:s('booking_confirm')})).toBeInTheDocument()
})
it('persists a pause with no selected courses and restores it on reload',async()=>{
  jest.mocked(saveNextMonthBooking).mockResolvedValue({success:true,data:row([],true)})
  const view=renderCourses({...initial,selection:{courseSelections:[],paused:false},source:'empty'})
  fireEvent.click(screen.getByRole('button',{name:new RegExp(s('booking_pause'))}))
  fireEvent.click(screen.getByRole('button',{name:s('booking_confirm_pause')}))
  await waitFor(()=>expect(saveNextMonthBooking).toHaveBeenCalledWith(expect.objectContaining({courseSelections:[],paused:true})))
  expect(await screen.findByText(s('booking_saved'))).toBeInTheDocument()
  view.unmount()
  renderCourses({...initial,booking:row([],true),selection:{courseSelections:[],paused:true},source:'booking'})
  expect(screen.getByText(de.profile.paused_notice.replace('{month}',formatProfileMonth(initial.targetMonth,'de')))).toBeInTheDocument()
})
it('cannot continue from a pause without choosing a course',()=>{
  renderCourses({...initial,selection:{courseSelections:[],paused:true},source:'booking',booking:row([],true)})
  edit()
  fireEvent.click(screen.getByRole('button',{name:new RegExp(s('booking_continue'))}))
  fireEvent.click(screen.getByRole('checkbox',{name:'A1'}))
  fireEvent.click(screen.getByRole('checkbox',{name:'A1'}))
  expect(screen.getByRole('button',{name:s('booking_next')})).toBeDisabled()
  expect(saveNextMonthBooking).not.toHaveBeenCalled()
})
it('clears the selected courses when explicitly pausing the next month',async()=>{
  jest.mocked(saveNextMonthBooking).mockResolvedValue({success:true,data:row([],true)})
  renderCourses()
  edit()
  fireEvent.click(screen.getByRole('button',{name:s('booking_back')}))
  fireEvent.click(screen.getByRole('button',{name:new RegExp(s('booking_pause'))}))
  fireEvent.click(screen.getByRole('button',{name:s('booking_confirm_pause')}))
  await waitFor(()=>expect(saveNextMonthBooking).toHaveBeenCalledWith({targetMonth:initial.targetMonth,courseSelections:[],paused:true,expected:null}))
})
it('saves the chosen private lesson quantity with the acknowledged revision',async()=>{
  const privateState:ProfileMonthlyState={...initial,source:'booking',booking:{...row([one]),courseSelections:[{courseId:one,requestedUnits:3}]},
    selection:{courseSelections:[{courseId:one,requestedUnits:3}],paused:false},courses:[{...initial.courses[0],category:'private'}]}
  jest.mocked(saveNextMonthBooking).mockResolvedValue({success:true,data:{...row([one]),revision:2,courseSelections:[{courseId:one,requestedUnits:4}]}})
  renderCourses(privateState)
  edit()
  expect(screen.getByRole('spinbutton',{name:'Unterrichtseinheiten'})).toHaveValue(3)
  fireEvent.click(screen.getByRole('button',{name:'Eine Einheit mehr'}))
  expect(screen.getByRole('spinbutton')).toHaveValue(4)
  expect(screen.getByText('100,00 €')).toBeInTheDocument()
  next()
  expect(screen.getByText('4 Einzelstunden')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:s('booking_confirm')}))
  await waitFor(()=>expect(saveNextMonthBooking).toHaveBeenCalledWith({targetMonth:initial.targetMonth,courseSelections:[{courseId:one,requestedUnits:4}],paused:false,expected:{id:two,revision:1}}))
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
