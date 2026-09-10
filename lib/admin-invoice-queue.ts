import type { StaffRegistration, StaffInvoice } from './types/admin-registrations'

/** One invoice per pupil and month. Explicit monthly selections/pause supersede
 * recurring legacy courses. Multiple active registrations may add different
 * courses, so merge them instead of silently retaining just the newest set. */
export function invoiceQueue(registrations: readonly StaffRegistration[], invoices: readonly StaffInvoice[], month: string): StaffRegistration[] {
  const prepared = registrations.filter(row=>invoices.some(invoice=>invoice.source===row.source&&invoice.sourceId===row.id&&invoice.month===month&&invoice.status==='created'))
  const explicit = new Map(registrations.filter(row=>row.source==='monthly_booking'&&row.targetMonth===month).map(row=>[row.personId,row]))
  const recurring = registrations.filter(row=>row.source==='registration'&&row.status==='confirmed'&&(!row.startDate||row.startDate.slice(0,7)<=month.slice(0,7))&&row.courses.some(course=>!course.endDate||course.endDate>=month))
    .sort((a,b)=>(b.startDate??'').localeCompare(a.startDate??'')||(b.createdAt??'').localeCompare(a.createdAt??'')||b.id.localeCompare(a.id))
  const groups = new Map<string,StaffRegistration[]>()
  for(const row of recurring)groups.set(row.personId,[...(groups.get(row.personId)??[]),row])
  const active = new Map<string,StaffRegistration>()
  for(const [person,rows] of groups){
    if(explicit.has(person))continue
    const courses = new Map<string,StaffRegistration['courses'][number]>()
    for(const row of rows)for(const course of row.courses)if((!course.endDate||course.endDate>=month)&&!courses.has(course.id))courses.set(course.id,course)
    const merged=[...courses.values()]
    if(merged.length)active.set(person,{...rows[0],courses:merged,totalPrice:rows.length===1?rows[0].totalPrice:null})
  }
  for(const [person,row] of explicit)if(row.status==='confirmed')active.set(person,row)
  // Preserve the source carrying a prepared invoice even after cancellation or
  // replacement, so a new registration does not appear as a second invoice due.
  const result:StaffRegistration[]=[]
  const preparedPeople=new Set<string>()
  for(const row of prepared){result.push({...row,courses:active.get(row.personId)?.courses??row.courses});preparedPeople.add(row.personId)}
  for(const [person,row] of active)if(!preparedPeople.has(person))result.push(row)
  return result
}
