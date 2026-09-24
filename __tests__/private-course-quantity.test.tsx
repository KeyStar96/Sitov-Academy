import React, { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import CourseQuantityInput from '@/components/registration/CourseQuantityInput'
import EnrollmentCosts from '@/components/registration/EnrollmentCosts'
import { calculateMonthlyStats } from '@/lib/course-calculations'
import { courseSelectionsSchema, courseSelectionsForRpc } from '@/lib/course-selection'
import type { CourseConfig } from '@/lib/course-config'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
const id='00000000-0000-4000-8000-000000000001'
const course:CourseConfig={id,slug:'privatunterricht-online',title:'Privatunterricht online',type:'online',category:'private',unitPrice:25,unitMinutes:45,sessions:[]}
function QuantityPreview() {
 const [value,setValue]=useState(1)
 return <><CourseQuantityInput value={value} onChange={setValue} unitPrice={25} unitMinutes={45} lang="de"/><EnrollmentCosts courses={[course]} selections={[{courseId:id,requestedUnits:value}]} startIso="2026-10-15" startChosen exceptions={[]} lang="de" copy={de.registration.flow} agbHref="/de/agb" referenceYear="2026"/></>
}
// Quantity input, first-month total and the course line show the exact price; the next two months follow in words.
const expectPrice=(price:string)=>{
 expect(screen.getAllByText(price)).toHaveLength(3)
 expect(screen.getByText(`November 2026: etwa ${price}`)).toBeInTheDocument()
 expect(screen.getByText(`Dezember 2026: etwa ${price}`)).toBeInTheDocument()
}
it('prices the chosen number of 45-minute units at €25 in the first month and both following months',()=>{
 render(<QuantityPreview/>)
 expect(screen.getByRole('spinbutton',{name:'Unterrichtseinheiten'})).toHaveValue(1)
 expectPrice('25,00 €')
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:'3'}})
 expectPrice('75,00 €')
 expect(screen.getByText('3 × 45 Minuten')).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Eine Einheit mehr'}))
 expect(screen.getByRole('spinbutton')).toHaveValue(4)
 expectPrice('100,00 €')
})
it('does not lose a valid quantity when the learner temporarily clears the input',()=>{
 render(<QuantityPreview/>)
 fireEvent.change(screen.getByRole('spinbutton'),{target:{value:''}})
 expect(screen.getByRole('alert')).toHaveTextContent('1 bis 1.000')
 expectPrice('25,00 €')
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
