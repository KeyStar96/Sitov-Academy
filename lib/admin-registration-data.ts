import 'server-only'
import {createClient} from '@/utils/supabase/server'
import {checkDatabaseError,checkRpcError} from './actions/backend'
import type {StaffRegistration,RegistrationOverview} from './types/admin-registrations'
import {z} from 'zod'
/** Caller is staff-checked; RLS independently restricts all business data. */
export async function loadRegistrationOverview(month:string):Promise<RegistrationOverview> {
 const client=await createClient()
 const prepared=await client.rpc('prepare_business_month',{p_month:month});checkDatabaseError(prepared.error);checkRpcError(prepared.data)
 const [bookings,invoices]=await Promise.all([
  client.from('bookings').select('*,people(auth_user_id),booking_items(*)').order('created_at',{ascending:false}),
  client.from('invoice_cases').select('*').eq('target_month',month),
 ])
 checkDatabaseError(bookings.error);checkDatabaseError(invoices.error)
 const registrations:StaffRegistration[]=(bookings.data??[]).map(row=>({
 id:row.id,isTrial:row.kind==='trial',source:row.kind==='monthly'?'monthly_booking':'registration',personId:row.person_id,profileId:row.people?.auth_user_id??null,
 createdAt:row.created_at,startDate:row.start_date,targetMonth:row.target_month,status:z.enum(['pending','confirmed','cancelled','rejected']).parse(row.status),
 contact:{name:row.contact_name,email:row.contact_email,phone:row.contact_phone,street:row.contact_street,zip:row.contact_postal_code,city:row.contact_city,birthDate:row.contact_birth_date},
 totalPrice:row.booking_items.reduce((sum,item)=>sum+item.amount,0),
 consents:{privacy:row.privacy_accepted,agb:row.agb_accepted,revocation:row.revocation_accepted,recording:row.recording_accepted},
 courses:row.booking_items.map(item=>({id:item.course_id,title:item.title_snapshot,amount:item.amount,unitPrice:item.unit_price,unitMinutes:item.unit_minutes,units:item.units,requestedUnits:item.requested_units})),
 }))
 return {registrations,targetMonth:month,invoices:(invoices.data??[]).map(row=>({source:registrations.find(b=>b.id===row.booking_id)?.source??'registration',sourceId:row.booking_id,month:row.target_month,status:row.status==='created'?'created':'outstanding',reference:row.invoice_reference,createdAt:row.invoice_created_at}))}
}
