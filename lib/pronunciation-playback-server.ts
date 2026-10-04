import 'server-only'

import { z } from 'zod'
import { publicStorageUrl } from '@/lib/storage-public-url'
import { pronunciationAudioObjectPath, PRIVATE_PRONUNCIATION_BUCKET } from '@/lib/pronunciation-conversations'
import type { createClient } from '@/utils/supabase/server'

type Client = Awaited<ReturnType<typeof createClient>>

/** Kurzlebige, signierte Abspiel-URL für eine private Aufnahme; Storage prüft jeden Abruf erneut. */
export async function pronunciationPlaybackUrl(client: Client, reference: string | null): Promise<string | null> {
  if (!reference) return null
  const path = pronunciationAudioObjectPath(reference)
  if (!path) return null
  try {
    const { data, error } = await client.storage.from(PRIVATE_PRONUNCIATION_BUCKET).createSignedUrl(path, 3600)
    if (error) { console.error("Signing pronunciation recording failed"); return null }
    return publicStorageUrl(data.signedUrl)
  } catch (error) { console.error("Signing pronunciation recording failed"); return null }
}

/** Sign a conversation history in bounded batches instead of one Storage
 * round trip per message. Invalid, denied or missing recordings remain null;
 * the authenticated Storage policy still decides access to every object. */
export async function sitovPronunciationPlaybackUrls(client: Client, references: readonly (string | null)[]): Promise<Map<string, string>> {
  const paths = [...new Set(references.flatMap(reference => {
    const path = reference && pronunciationAudioObjectPath(reference)
    return path ? [path] : []
  }))]
  const urls = new Map<string, string>()
  const batches: string[][] = []
  for (let offset = 0; offset < paths.length; offset += 100) batches.push(paths.slice(offset, offset + 100))
  await Promise.all(batches.map(async batch => {
    try {
      const { data, error } = await client.storage.from(PRIVATE_PRONUNCIATION_BUCKET).createSignedUrls(batch, 3600)
      if (error) { console.error('Signing pronunciation recordings failed'); return }
      for (const recording of data ?? []) {
        if (recording.error || !recording.path || !recording.signedUrl || !batch.includes(recording.path)) continue
        try { urls.set(`storage://${PRIVATE_PRONUNCIATION_BUCKET}/${recording.path}`, publicStorageUrl(recording.signedUrl)) }
        catch { console.error('Signing pronunciation recording failed') }
      }
    } catch { console.error('Signing pronunciation recordings failed') }
  }))
  return urls
}

/** Namen der Lehrkräfte, die der angemeldeten Person geantwortet haben. Ohne Migration 24 bleibt die Liste leer. */
export async function loadReplySenderNames(client: Client): Promise<Map<string, string>> {
  try {
    const { data, error } = await client.rpc('pronunciation_reply_senders')
    if (error) throw error
    return new Map((data ?? []).flatMap(row => row.display_name ? [[row.sender_id, row.display_name] as [string, string]] : []))
  } catch { console.error('Reply sender names unavailable'); return new Map() }
}

export interface StaffPronunciationView { hiddenSubmissions: ReadonlySet<string>; hiddenMessages: ReadonlySet<string>; pendingCount: number | null }
const staffViewSchema = z.object({ success: z.literal(true), hiddenSubmissions: z.array(z.string()), hiddenMessages: z.array(z.string()), pendingCount: z.number().int().min(0) })

/**
 * Was Lehrkräfte aus ihrer Ansicht entfernt haben und wie viele Gespräche für sie noch offen sind.
 * Ohne Migration 57 (oder bei einem Ausfall) ist nichts ausgeblendet und der Zähler unbekannt.
 */
export async function loadStaffPronunciationView(client: Client): Promise<StaffPronunciationView> {
  try {
    const { data, error } = await client.rpc('get_staff_pronunciation_view')
    if (error) throw error
    const view = staffViewSchema.parse(data)
    return { hiddenSubmissions: new Set(view.hiddenSubmissions), hiddenMessages: new Set(view.hiddenMessages), pendingCount: view.pendingCount }
  } catch { console.error('Staff pronunciation view unavailable'); return { hiddenSubmissions: new Set(), hiddenMessages: new Set(), pendingCount: null } }
}
