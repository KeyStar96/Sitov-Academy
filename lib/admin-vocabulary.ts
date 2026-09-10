import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/database.types'
import type { VocabWriteInput } from '@/lib/types/vocabulary-admin'

export async function readAdminVocabulary(client: SupabaseClient<Database>) {
  // Page through the catalog so PostgREST's response limit cannot silently hide lessons.
  const rows: Database['public']['Tables']['vocabulary_cards']['Row'][] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('vocabulary_cards').select('*').order('created_at', { ascending: false }).order('id').range(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return rows
  }
}

export async function writeAdminVocabulary(client: SupabaseClient<Database>, payload: VocabWriteInput, id?: string) {
  const row = { ...payload, article: payload.article === 'none' ? null : payload.article }
  const query = id ? client.from('vocabulary_cards').update(row).eq('id', id) : client.from('vocabulary_cards').insert(row)
  const { data, error } = await query.select('*').single()
  if (error) throw error
  return data
}

export async function removeAdminVocabulary(client: SupabaseClient<Database>, id: string) {
  const { data, error } = await client.from('vocabulary_cards').delete().eq('id', id).select('id').single()
  if (error) throw error
  return data.id
}
