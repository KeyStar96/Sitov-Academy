'use server'

import { withBackendSession } from '@/lib/actions/backend'
import type { BackendActionResult } from '@/lib/types/backend'
import { loadNextMonthStaffOverview } from '@/lib/admin-staff-overview'
import type { NextMonthOverview } from '@/lib/types/admin-staff'

export async function getNextMonthStaffOverview(): Promise<BackendActionResult<NextMonthOverview>> {
  return withBackendSession(() => loadNextMonthStaffOverview(), 'staff')
}
