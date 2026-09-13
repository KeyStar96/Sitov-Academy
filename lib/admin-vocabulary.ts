import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/database.types'
import type { VocabWriteInput } from '@/lib/types/vocabulary-admin'
import { vocabularyCardSchema, saveLearningContent, deleteLearningContent, type VocabularyContentRow } from '@/lib/learning-content'

export async function readAdminVocabulary(client: SupabaseClient<Database>) {
  // Page through the catalog so PostgREST's response limit cannot silently hide lessons.
  const rows: VocabularyContentRow[] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('vocabulary_cards').select('*').order('created_at', { ascending: false }).order('id').range(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []).map(row => vocabularyCardSchema.parse(row)))
    if (!data || data.length < pageSize) return rows
  }
}

export async function writeAdminVocabulary(client: SupabaseClient<Database>, payload: VocabWriteInput, id?: string) {
  const row = { ...payload, article: payload.article === 'none' ? null : payload.article }
  return vocabularyCardSchema.parse(await saveLearningContent(client, 'vocabulary', row, id))
}

export async function removeAdminVocabulary(client: SupabaseClient<Database>, id: string) {
  await deleteLearningContent(client, 'vocabulary', id)
  return id
}
