import {invoiceQueue} from '@/lib/admin-invoice-queue'
import {invoiceStatusInputSchema,type StaffRegistration,type StaffInvoice} from '@/lib/types/admin-registrations'
const month='2026-10-01'
const booking=(changes:Partial<StaffRegistration>={}):StaffRegistration=>({id:'booking',source:'registration',personId:'person',profileId:'profile',createdAt:'2026-09-01',startDate:month,targetMonth:month,status:'confirmed',contact:{name:'Test',email:'test@example.test',phone:null,street:null,zip:null,city:null,birthDate:null},courses:[{id:'course',title:'Course snapshot',amount: 99, unitPrice: 10, unitMinutes: 45, units: 8, requestedUnits: null}],totalPrice:99,consents:null,...changes})
it('shows only confirmed paid bookings for the selected month',()=>{
 const active=booking()
 expect(invoiceQueue([active,booking({id:'pending',status:'pending'}),booking({id:'future',targetMonth:'2026-11-01'}),booking({id:'trial',isTrial:true}),booking({id:'cancelled',status:'cancelled'})],[],month)).toEqual([active])
})
it('preserves created invoice snapshots after a cancellation without carrying them into another month',()=>{
 const cancelled=booking({status:'cancelled'}),invoice:StaffInvoice={source:'registration',sourceId:cancelled.id,month,status:'created',reference:'RE1',createdAt:'2026-09-30'}
 expect(invoiceQueue([cancelled],[invoice],month)).toEqual([cancelled]);expect(invoiceQueue([cancelled],[invoice],'2026-11-01')).toEqual([])
})
it('keeps exact title and price snapshots without merging unrelated applications in the UI',()=>{
 const row=booking({source:'monthly_booking'})
 expect(invoiceQueue([row],[],month)[0]).toBe(row)
})
it('validates months, references and privilege fields before mutation',()=>{
 const input={source:'registration',id:'00000000-0000-4000-8000-000000000001',month,created:true,reference:'RE1'}
 expect(invoiceStatusInputSchema.safeParse(input).success).toBe(true)
 for(const invalid of [{...input,month:'2026-10-15'},{...input,reference:'x'.repeat(121)},{...input,role:'admin'},{...input,reference:'<script>'}])expect(invoiceStatusInputSchema.safeParse(invalid).success).toBe(false)
})
