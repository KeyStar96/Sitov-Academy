import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/database.types'

type ProgressSummary = Pick<Database['public']['Tables']['vocabulary_direction_progress']['Row'],
  'card_id' | 'box_number' | 'direction' | 'next_review_date'>

/** Two directions can exceed PostgREST's default 1,000-row response limit. */
export async function readVocabularyProgress(supabase: SupabaseClient<Database>, userId: string): Promise<ProgressSummary[]> {
  const rows: ProgressSummary[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('vocabulary_direction_progress')
      .select('card_id,box_number,direction,next_review_date').eq('user_id', userId)
      .order('id').range(offset, offset + 499)
    if (error) throw new Error(`Vocabulary progress read failed: ${error.code}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 500) return rows
  }
}
