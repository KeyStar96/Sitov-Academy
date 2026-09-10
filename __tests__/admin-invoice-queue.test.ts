import { invoiceQueue } from '@/lib/admin-invoice-queue'
import { invoiceStatusInputSchema } from '@/lib/types/admin-registrations'
import type { StaffRegistration, StaffInvoice } from '@/lib/types/admin-registrations'
const registration=(changes:Partial<StaffRegistration>={}):StaffRegistration=>({id:'reg',source:'registration',personId:'person',profileId:'profile',createdAt:'2026-01-01',startDate:'2026-02-01',targetMonth:null,status:'confirmed',contact:{name:'Test',email:'test@example.invalid',phone:null,street:null,zip:null,city:null,birthDate:null},courses:[{id:'c',title:'Test',translationKey:'test',price:99,endDate:null}],totalPrice:99,consents:null,...changes})
const month='2026-10-01'
it('only includes confirmed active courses that have started for the selected month',()=>{
 const active=registration()
 expect(invoiceQueue([active,registration({id:'pending',status:'pending'}),registration({id:'future',startDate:'2026-11-01'}),registration({id:'ended',courses:[{id:'old',title:'Old',translationKey:'old',price:99,endDate:'2026-09-30'}]})],[],month)).toEqual([active])
})
it('an explicit monthly pause or pending selection supersedes recurring enrollments',()=>{
 const explicit=registration({id:'monthly',source:'monthly_booking',targetMonth:month,status:'cancelled',courses:[]})
 expect(invoiceQueue([registration(),explicit],[],month)).toEqual([])
 expect(invoiceQueue([registration(),{...explicit,status:'pending'}],[],month)).toEqual([])
 expect(invoiceQueue([registration(),{...explicit,status:'confirmed'}],[],month)).toEqual([{...explicit,status:'confirmed'}])
})
it('an already prepared invoice stays visible after cancellation',()=>{
 const cancelled=registration({status:'cancelled'})
 const invoice:StaffInvoice={source:'registration',sourceId:'reg',month,status:'created',reference:'RE1',createdAt:'2026-09-30'}
 expect(invoiceQueue([cancelled],[invoice],month)).toEqual([cancelled])
 expect(invoiceQueue([cancelled],[invoice],'2026-11-01')).toEqual([])
})
it('rejects arbitrary dates, excess reference text and privilege fields before database access',()=>{
 const input={source:'registration',id:'00000000-0000-4000-8000-000000000001',month,created:true,reference:'RE1'}
 expect(invoiceStatusInputSchema.safeParse(input).success).toBe(true)
 for(const invalid of [{...input,month:'2026-10-15'},{...input,reference:'x'.repeat(121)},{...input,role:'admin'},{...input,reference:'<script>'}])expect(invoiceStatusInputSchema.safeParse(invalid).success).toBe(false)
})
it('merges concurrent distinct courses while deduplicating repeated registrations for one pupil',()=>{
 const old=registration({id:'old',createdAt:'2026-01-01'})
 const next=registration({id:'new',createdAt:'2026-02-01',courses:[...old.courses,{id:'c2',title:'Second',translationKey:'second',price:80,endDate:null}]})
 const rows=invoiceQueue([old,next],[],month)
 expect(rows).toHaveLength(1);expect(rows[0].id).toBe('new');expect(rows[0].courses.map(course=>course.id)).toEqual(['c','c2'])
})
it('retains a prepared invoice when another registration adds a course for the same pupil',()=>{
 const old=registration({id:'old'})
 const next=registration({id:'new',createdAt:'2026-02-01',courses:[{id:'c2',title:'Second',translationKey:'second',price:80,endDate:null}]})
 const invoice:StaffInvoice={source:'registration',sourceId:'old',month,status:'created',reference:'RE1',createdAt:'2026-09-30'}
 const rows=invoiceQueue([old,next],[invoice],month)
 expect(rows).toHaveLength(1);expect(rows[0].id).toBe('old');expect(rows[0].courses.map(course=>course.id).sort()).toEqual(['c','c2'])
})
