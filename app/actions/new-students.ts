'use server'

import { withBackendSession } from '@/lib/actions/backend'
import { createAdminClient } from '@/utils/supabase/admin'
import { loadNewStudents, type NewStudent } from '@/lib/admin-new-students'
import type { BackendActionResult } from '@/lib/types/backend'

/**
 * Neue Registrierungen ohne Niveau-Zuordnung für die Freischalt-Liste.
 * Die Staff-Prüfung läuft über die Sitzung; gelesen wird wie bei den
 * Übersichts-Kennzahlen mit dem Service-Client, damit Liste, Badge und
 * Kennzahl dieselbe Datengrundlage haben. Nur Lesezugriffe.
 */
export async function getNewStudents(): Promise<BackendActionResult<NewStudent[]>> {
  return withBackendSession(() => loadNewStudents(createAdminClient()), 'staff')
}
