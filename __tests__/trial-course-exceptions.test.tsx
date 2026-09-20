import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import EnrollmentTerminal from '@/components/registration/EnrollmentTerminal'
import type { CourseConfig } from '@/lib/course-config'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.mock('next/navigation',()=>({useSearchParams:()=>({get:(name:string)=>name==='courseId'?'00000000-0000-4000-8000-000000000001':name==='trial'?'1':null})}))
jest.mock('@/app/actions/validate-email',()=>({validateEmail:jest.fn().mockResolvedValue({isValid:true})}))
jest.mock('@/app/actions/submit-enrollment',()=>({submitEnrollment:jest.fn()}))
jest.mock('@/app/actions/submit-trial',()=>({submitTrialLesson:jest.fn()}))
jest.mock('@/app/actions/check-trial-eligibility',()=>({checkTrialEligibility:jest.fn()}))
jest.mock('@/lib/analytics/meta-pixel',()=>({trackMetaEvent:jest.fn()}))
jest.mock('framer-motion',()=>{
 const React=jest.requireActual<typeof import('react')>('react')
 const element=(tag:string)=>({children,className,onClick,...props}:React.HTMLAttributes<HTMLElement> & {initial?:unknown;animate?:unknown;exit?:unknown;layout?:unknown;transition?:unknown})=>{
  const {initial,animate,exit,layout,transition,...dom}=props
  return React.createElement(tag,{...dom,className,onClick},children)
 }
 return {useReducedMotion:()=>true,MotionConfig:({children}:{children:React.ReactNode})=><>{children}</>,AnimatePresence:({children}:{children:React.ReactNode})=><>{children}</>,motion:{div:element('div'),span:element('span'),button:element('button')}}
})
const course:CourseConfig={id:'00000000-0000-4000-8000-000000000001',slug:'deutsch-level-1',title:'Deutsch Level 1',category:'german',type:'presence',unitPrice:2.5,unitMinutes:45,sessions:[{day:'Mo',startTime:'10:30',endTime:'12:00'}],trialLessons:true}
const serverTime=new Date('2026-09-13T10:00:00Z').getTime()

it('excludes global and own-course cancellations before filling eight trial dates, but keeps other-course cancellations',()=>{
 render(<EnrollmentTerminal dictionary={de} lang="de" courses={[course]} serverTime={serverTime} exceptions={[
  {date:'2026-09-14',reason:'All courses cancelled'},
  {date:'2026-09-21',reason:'This course cancelled',courseIds:[course.id]},
  {date:'2026-09-28',reason:'Another course cancelled',courseIds:['00000000-0000-4000-8000-000000000002']},
 ]}/>);
 expect(screen.queryByRole('button',{name:/14\.09\.2026/})).not.toBeInTheDocument()
 expect(screen.queryByRole('button',{name:/21\.09\.2026/})).not.toBeInTheDocument()
 expect(screen.getByRole('button',{name:/28\.09\.2026/})).toBeInTheDocument()
 expect(screen.getByRole('button',{name:/09\.11\.2026/})).toBeInTheDocument()
})

it('respects the course period and clears a selected trial when its date becomes cancelled',()=>{
 const courses=[{...course,startDate:'2026-09-21',endDate:'2026-09-28'}]
 const {rerender}=render(<EnrollmentTerminal dictionary={de} lang="de" courses={courses} serverTime={serverTime}/>);
 expect(screen.queryByRole('button',{name:/14\.09\.2026/})).not.toBeInTheDocument()
 expect(screen.queryByRole('button',{name:/05\.10\.2026/})).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:/21\.09\.2026/}))
 const receipt=document.querySelector('.enrollment-receipt')!
 expect(receipt.textContent).toContain('21.09.2026')
 rerender(<EnrollmentTerminal dictionary={de} lang="de" courses={courses} serverTime={serverTime} exceptions={[{date:'2026-09-21',reason:'Cancelled'}]}/>);
 expect(screen.queryByRole('button',{name:/21\.09\.2026/})).not.toBeInTheDocument()
 expect(receipt.textContent).not.toContain('21.09.2026')
 expect(screen.getByRole('button',{name:/28\.09\.2026/})).toBeInTheDocument()
})
jest.mock('@/app/actions/auth',()=>({signup:jest.fn()}))
