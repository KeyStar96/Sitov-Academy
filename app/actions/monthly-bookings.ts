'use server'

import {
  BackendError, checkDatabaseError, revalidateBackendPages, withBackendSession,
} from '@/lib/actions/backend'
import { uuidSchema, type BackendActionResult } from '@/lib/types/backend'
import {
  createMonthlyBookingSchema, updateMonthlyBookingSchema, listMonthlyBookingsSchema,
  monthlyBookingStatusSchema, type MonthlyCourseBooking,
  saveNextMonthSchema, type ProfileMonthlyState,
} from '@/lib/types/monthly-bookings'
import type { Tables } from '@/supabase/database.types'
import { loadProfileMonthlyState } from '@/lib/profile-dashboard-server'

export async function getProfileMonthlyState(): Promise<BackendActionResult<ProfileMonthlyState>> {
  return withBackendSession(({ supabase, user }) => loadProfileMonthlyState(supabase, user))
}

export async function saveNextMonthBooking(input: unknown): Promise<BackendActionResult<MonthlyCourseBooking>> {
  return withBackendSession(async ({ supabase }) => {
    const fields = saveNextMonthSchema.parse(input)
    const { data, error } = await supabase.rpc('save_next_month_booking', {
      p_target_month: fields.targetMonth, p_course_ids: fields.courseIds, p_paused: fields.paused,
      p_expected_id: fields.expected?.id ?? null,
      p_expected_course_ids: fields.expected?.course_ids ?? null,
      p_expected_status: fields.expected?.status ?? null,
    }).single()
    checkDatabaseError(error)
    if (!data) throw new BackendError('not_found')
    revalidateBackendPages()
    return toBooking(data)
  })
}

function toBooking(row: Tables<'monthly_course_bookings'>): MonthlyCourseBooking {
  return { ...row, status: monthlyBookingStatusSchema.parse(row.status) }
}

/** Admins can list all bookings; everyone else sees only their own. */
export async function getMonthlyBookings(input: unknown = {}): Promise<BackendActionResult<MonthlyCourseBooking[]>> {
  return withBackendSession(async ({ supabase, userId, role }) => {
    const filters = listMonthlyBookingsSchema.parse(input)
    if (role !== 'admin' && filters.user_id && filters.user_id !== userId) throw new BackendError('not_authorized')
    let query = supabase.from('monthly_course_bookings').select('*')
    if (role !== 'admin') query = query.eq('user_id', userId)
    else if (filters.user_id) query = query.eq('user_id', filters.user_id)
    if (filters.target_month) query = query.eq('target_month', filters.target_month)
    const { data, error } = await query.order('target_month', { ascending: false })
      .order('id').range(filters.offset, filters.offset + filters.limit - 1)
    checkDatabaseError(error)
    return (data ?? []).map(toBooking)
  })
}

export async function createMonthlyBooking(input: unknown): Promise<BackendActionResult<MonthlyCourseBooking>> {
  return withBackendSession(async ({ supabase, userId, role }) => {
    const fields = createMonthlyBookingSchema.parse(input)
    const ownerId = fields.user_id ?? userId
    if (ownerId !== userId && role !== 'admin') throw new BackendError('not_authorized')
    const { data, error } = await supabase.from('monthly_course_bookings').insert({
      user_id: ownerId, target_month: fields.target_month, course_ids: fields.course_ids, status: 'pending',
    }).select('*').single()
    checkDatabaseError(error)
    if (!data) throw new BackendError('not_found')
    revalidateBackendPages()
    return toBooking(data)
  })
}

export async function updateMonthlyBooking(input: unknown): Promise<BackendActionResult<MonthlyCourseBooking>> {
  return withBackendSession(async ({ supabase, userId, role }) => {
    const { id, ...changes } = updateMonthlyBookingSchema.parse(input)
    if (changes.status === 'confirmed' && role !== 'admin') throw new BackendError('not_authorized')
    let query = supabase.from('monthly_course_bookings').update(changes).eq('id', id)
    if (role !== 'admin') query = query.eq('user_id', userId)
    const { data, error } = await query.select('*').single()
    checkDatabaseError(error)
    if (!data) throw new BackendError('not_found')
    revalidateBackendPages()
    return toBooking(data)
  })
}

export async function deleteMonthlyBooking(input: unknown): Promise<BackendActionResult<{ id: string }>> {
  return withBackendSession(async ({ supabase, userId, role }) => {
    const id = uuidSchema.parse(input)
    let query = supabase.from('monthly_course_bookings').delete().eq('id', id)
    if (role !== 'admin') query = query.eq('user_id', userId)
    const { data, error } = await query.select('id').single()
    checkDatabaseError(error)
    if (!data) throw new BackendError('not_found')
    revalidateBackendPages()
    return data
  })
}
