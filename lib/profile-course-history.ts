import 'server-only'
import type {User} from '@supabase/supabase-js'
import {createClient} from '@/utils/supabase/server'
import {resolveVerifiedPerson} from './profile-person'
import {checkDatabaseError} from './actions/backend'
import type {VerifiedCourseHistory} from './types/admin-registrations'
import {z} from 'zod'
export async function loadVerifiedCourseHistory(user:User):Promise<VerifiedCourseHistory|null> {
 if(!user.email_confirmed_at)return {unresolved:false,registrations:[]}
 const person=await resolveVerifiedPerson(user)
 if(!person.id)return {unresolved:person.unresolved,registrations:[]}
 const client=await createClient()
 const [contact,bookings]=await Promise.all([
  client.from('people').select('birth_date').eq('id',person.id).single(),
  client.from('bookings').select('*,booking_items(*)').eq('person_id',person.id).order('start_date',{ascending:false}),
 ])
 checkDatabaseError(contact.error);checkDatabaseError(bookings.error)
 return {unresolved:person.unresolved,birthDate:contact.data?.birth_date,registrations:(bookings.data??[]).map(row=>({
 id:row.id,status:z.enum(['pending','confirmed','cancelled','rejected']).parse(row.status),startDate:row.start_date,
 courses:row.booking_items.map(item=>({id:item.course_id,title:item.title_snapshot,amount:item.amount,unitPrice:item.unit_price,unitMinutes:item.unit_minutes,units:item.units,requestedUnits:item.requested_units})),
 }))}
}
