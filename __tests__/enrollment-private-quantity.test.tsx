import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EnrollmentTerminal from '@/components/registration/EnrollmentTerminal'
import type { CourseConfig } from '@/lib/course-config'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.mock('next/navigation',()=>({useSearchParams:()=>({get:(name:string)=>name==='courseId'?'00000000-0000-4000-8000-000000000001':null})}))
jest.mock('@/app/actions/validate-email',()=>({validateEmail:jest.fn().mockResolvedValue({isValid:true})}))
jest.mock('@/app/actions/submit-enrollment',()=>({submitEnrollment:jest.fn()}))
jest.mock('@/app/actions/auth',()=>({signup:jest.fn()}))
jest.mock('@/app/actions/submit-trial',()=>({submitTrialLesson:jest.fn()}))
jest.mock('@/app/actions/trialEligibilityHint',()=>({trialEligibilityHint:jest.fn()}))
jest.mock('@/lib/analytics/meta-pixel',()=>({trackMetaEvent:jest.fn()}))
jest.mock('framer-motion',()=>{
 const React=jest.requireActual<typeof import('react')>('react')
 const element=(tag:string)=>({children,className,onClick,...props}:React.HTMLAttributes<HTMLElement> & {initial?:unknown;animate?:unknown;exit?:unknown;layout?:unknown;transition?:unknown})=>{
  const {initial,animate,exit,layout,transition,...dom}=props
  return React.createElement(tag,{...dom,className,onClick},children)
 }
 return {useReducedMotion:()=>true,MotionConfig:({children}:{children:React.ReactNode})=><>{children}</>,AnimatePresence:({children}:{children:React.ReactNode})=><>{children}</>,motion:{div:element('div'),span:element('span'),button:element('button')}}
})
const course:CourseConfig={id:'00000000-0000-4000-8000-000000000001',slug:'privatunterricht-online',title:'Privatunterricht online',description:'Termine nach Vereinbarung',category:'private',type:'online',unitPrice:25,unitMinutes:45,sessions:[],trialLessons:false}
it('preselects online private lessons and updates the registration receipt without inventing scheduled sessions',async()=>{
 render(<EnrollmentTerminal dictionary={de} lang="de" courses={[course]} serverTime={new Date('2026-10-14T10:00:00Z').getTime()}/>)
 const quantity=await screen.findByRole('spinbutton',{name:'Unterrichtseinheiten'})
 expect(quantity).toHaveValue(1)
 fireEvent.change(quantity,{target:{value:'3'}})
 await waitFor(()=>expect(screen.getAllByText('75,00 €').length).toBeGreaterThanOrEqual(3))
 expect(screen.getByText('3 × 45 Minuten')).toBeInTheDocument()
 expect(screen.getByRole('spinbutton')).toHaveValue(3)
})
