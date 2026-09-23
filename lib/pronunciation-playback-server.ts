import 'server-only'

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

/** Namen der Lehrkräfte, die der angemeldeten Person geantwortet haben. Ohne Migration 24 bleibt die Liste leer. */
export async function loadReplySenderNames(client: Client): Promise<Map<string, string>> {
  try {
    const { data, error } = await client.rpc('pronunciation_reply_senders')
    if (error) throw error
    return new Map((data ?? []).flatMap(row => row.display_name ? [[row.sender_id, row.display_name] as [string, string]] : []))
  } catch { console.error('Reply sender names unavailable'); return new Map() }
}
