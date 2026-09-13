import React, { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import CourseQuantityInput from '@/components/registration/CourseQuantityInput'
import PricingRoadmap from '@/components/registration/PricingRoadmap'
import { calculateMonthlyStats } from '@/lib/course-calculations'
import { courseSelectionsSchema, courseSelectionsForRpc } from '@/lib/course-selection'
import type { CourseConfig } from '@/lib/course-config'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.mock('framer-motion',()=>({useReducedMotion:()=>true,motion:{div:({children,className}:{children:React.ReactNode;className?:string})=><div className={className}>{children}</div>}}))
const id='00000000-0000-4000-8000-000000000001'
const course:CourseConfig={id,slug:'privatunterricht-online',title:'Privatunterricht online',type:'online',category:'private',unitPrice:25,unitMinutes:45,sessions:[]}
function QuantityPreview() {
 const [value,setValue]=useState(1)
 const stats=calculateMonthlyStats(course,'de',9,2026,[],15,value)
 return <><CourseQuantityInput value={value} onChange={setValue} unitPrice={25} unitMinutes={45} lang="de"/><PricingRoadmap dictionary={de} lang="de" startDate="15.10.2026" selectedCourses={[course]} courseSelections={[{courseId:id,requestedUnits:value}]} currentMonthPrice={stats.totalUnits*course.unitPrice}/></>
}
it('prices the chosen number of 45-minute units at €25 in the first month and both following months',()=>{
 render(<QuantityPreview/>)
 expect(screen.getByRole('spinbutton',{name:'Unterrichtseinheiten'})).toHaveValue(1)
 expect(screen.getAllByText('25,00 €')).toHaveLength(4)
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'3'}})
 expect(screen.getAllByText('75,00 €')).toHaveLength(4)
 fireEvent.click(screen.getByRole('button',{name:'Eine Einheit mehr'}))
 expect(screen.getByRole('spinbutton')).toHaveValue(4)
 expect(screen.getAllByText('100,00 €')).toHaveLength(4)
})
it('does not lose a valid quantity when the learner temporarily clears the input',()=>{
 render(<QuantityPreview/>)
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:''}})
 expect(screen.getByRole('alert')).toHaveTextContent('1 bis 1.000')
 expect(screen.getAllByText('25,00 €')).toHaveLength(4)
 fireEvent.blur(screen.getByRole('spinbutton'))
 expect(screen.getByRole('spinbutton')).toHaveValue(1)
 expect(screen.queryByRole('alert')).not.toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Eine Einheit weniger'})).toBeDisabled()
})
it.each([0,-1,1.5,1001,Infinity,NaN,null])('rejects invalid requested quantity %s before calling the database',requestedUnits=>{
 expect(courseSelectionsSchema.safeParse([{courseId:id,requestedUnits}]).success).toBe(false)
})
it('sends quantity only when selected and retains one canonical UUID key',()=>{
 const selections=courseSelectionsSchema.parse([{courseId:id,requestedUnits:3},{courseId:'00000000-0000-4000-8000-000000000002'}])
 expect(courseSelectionsForRpc(selections)).toEqual([{course_id:id,requested_units:3},{course_id:'00000000-0000-4000-8000-000000000002'}])
 expect(courseSelectionsSchema.safeParse([{courseId:id,requestedUnits:3,unit_price:0}]).success).toBe(false)
})
it('scheduled groups keep their computed lesson count even if passed a requested quantity',()=>{
 const scheduled={...course,category:'german' as const,sessions:[{day:'Mo' as const,startTime:'10:00',endTime:'11:30'}]}
 expect(calculateMonthlyStats(scheduled,'de',9,2026,[],1,999).totalUnits).toBe(8)
})
