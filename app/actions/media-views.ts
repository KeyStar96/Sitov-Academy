'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { getRpcError } from '@/lib/rpc-errors'

const viewSchema = z.object({ kind: z.enum(['video', 'presentation']), id: z.string().uuid() })

/**
 * Ein Medium wurde geöffnet (Mediathek-Kurve). Still wie die Gesehen-Quittung:
 * ein fehlender Eintrag darf das Öffnen nie stören, und es wird nichts neu geladen.
 */
export async function recordMediaView(kind: string, id: string): Promise<{ recorded: boolean }> {
  const parsed = viewSchema.safeParse({ kind, id })
  if (!parsed.success) return { recorded: false }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('record_media_view', { p_kind: parsed.data.kind, p_object_id: parsed.data.id })
    if (error || getRpcError(data)) { console.error('[media-view] record_failed'); return { recorded: false } }
    return { recorded: typeof data === 'object' && data !== null && (data as { recorded?: unknown }).recorded === true }
  } catch { console.error('[media-view] record_failed'); return { recorded: false } }
}
