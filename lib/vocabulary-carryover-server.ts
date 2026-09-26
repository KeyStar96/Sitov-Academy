import 'server-only'

import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/supabase/database.types'
import { mapVocabularyCard } from '@/lib/learning-catalog'
import { getRpcError } from '@/lib/rpc-errors'

export const carryoverLevelSchema = z.string().trim().min(1).max(40)
export const carryoverStateSchema = z.object({
  success: z.literal(true), targetLevel: carryoverLevelSchema, enabled: z.boolean(),
  decidedAt: z.string().nullable(), startedAt: z.string().nullable(), promptRequired: z.boolean(),
  cards: z.array(z.object({ cardId: z.string().uuid(), originLevel: carryoverLevelSchema })),
})
export type CarryoverState = z.infer<typeof carryoverStateSchema>

const progressSchema = z.object({
  id: z.string().uuid(), auth_user_id: z.string().uuid(), card_id: z.string().uuid(),
  direction: z.enum(['de_to_native', 'native_to_de']), box_number: z.number().int().min(1).max(7),
  next_review_date: z.string().nullable(),
})
const catalogPageSchema = z.object({ success: z.literal(true), cards: z.array(z.unknown()), progress: z.array(progressSchema) })
type Client = SupabaseClient<Database>

export async function readCarryoverState(client: Client, level: string): Promise<CarryoverState> {
  const { data, error } = await client.rpc('get_vocabulary_carryover', { p_target_level: level })
  const parsed = carryoverStateSchema.safeParse(data)
  if (error || getRpcError(data) || !parsed.success || parsed.data.targetLevel !== level) {
    throw new Error(`vocabulary_carryover_unavailable: ${error?.code ?? 'invalid_result'}`)
  }
  return parsed.data
}

/** The narrow RPC can read the learner's started source cards after source
 * access expires. Direct table policies remain unchanged. Never copy progress. */
export async function readCarryoverCatalog(client: Client, state: CarryoverState, userId: string) {
  const cards = new Map<string, ReturnType<typeof mapVocabularyCard>>()
  const progress = new Map<string, z.infer<typeof progressSchema>>()
  const eligible = new Map(state.cards.map(card => [card.cardId, card.originLevel]))
  if (!eligible.size) return { cards: [], progress: [] }
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.rpc('get_vocabulary_carryover_cards', {
      p_target_level: state.targetLevel, p_offset: offset, p_limit: 500,
    })
    const parsed = catalogPageSchema.safeParse(data)
    if (error || getRpcError(data) || !parsed.success) throw new Error(`vocabulary_carryover_unavailable: ${error?.code ?? 'invalid_catalog'}`)
    for (const raw of parsed.data.cards) {
      // mapVocabularyCard validates the resulting catalog DTO with Zod.
      const card = mapVocabularyCard(raw as Parameters<typeof mapVocabularyCard>[0])
      if (eligible.get(card.id) === card.level) cards.set(card.id, card)
    }
    for (const row of parsed.data.progress) {
      if (row.auth_user_id === userId && eligible.has(row.card_id)) progress.set(row.id, row)
    }
    if (parsed.data.cards.length < 500) return { cards: [...cards.values()], progress: [...progress.values()] }
  }
}
