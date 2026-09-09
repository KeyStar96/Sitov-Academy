'use server'

import { withBackendSession } from '@/lib/actions/backend'
import type { BackendActionResult } from '@/lib/types/backend'
import { loadNextMonthStaffOverview, loadStaffBlackboardNotes } from '@/lib/admin-staff-overview'
import type { NextMonthOverview } from '@/lib/types/admin-staff'
import type { TeacherStudentNote } from '@/lib/types/teacher-notes'

export async function getNextMonthStaffOverview(): Promise<BackendActionResult<NextMonthOverview>> {
  return withBackendSession(() => loadNextMonthStaffOverview(), 'staff')
}

export async function getStaffBlackboardNotes(): Promise<BackendActionResult<Record<string, TeacherStudentNote>>> {
  return withBackendSession(() => loadStaffBlackboardNotes(), 'staff')
}
