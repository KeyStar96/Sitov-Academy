import type { Tables } from '@/supabase/database.types'
import { monthlyBookingStatusSchema, type MonthlyCourseBooking } from './types/monthly-bookings'
export function monthlyBooking(row: Tables<'bookings'> & {booking_items:{course_id:string;requested_units:number|null}[]}, authUserId:string): MonthlyCourseBooking {
  return {
    id:row.id,userId:authUserId,targetMonth:row.target_month,
    courseSelections:row.booking_items.map(item=>({courseId:item.course_id,...(item.requested_units===null?{}:{requestedUnits:item.requested_units})})),
    status:monthlyBookingStatusSchema.parse(row.status),revision:row.revision,
  }
}
