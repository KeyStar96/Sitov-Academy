import type {Tables} from '@/supabase/database.types'
import {monthlyBookingStatusSchema,type MonthlyCourseBooking} from './types/monthly-bookings'
export function monthlyBooking(row:Tables<'bookings'> & {booking_items:{course_id:string}[]},authUserId:string):MonthlyCourseBooking {
 return {id:row.id,user_id:authUserId,target_month:row.target_month,course_ids:row.booking_items.map(item=>item.course_id),status:monthlyBookingStatusSchema.parse(row.status),revision:row.revision}
}
