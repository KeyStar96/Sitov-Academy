'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { getRpcError } from '@/lib/rpc-errors'
import {
  focusAnswerInputSchema, focusAnswerResultSchema, vocabularyFocusSchema,
  type FocusAnswerResult, type FocusFailure, type VocabularyFocus,
} from '@/lib/vocabulary-focus'

type FocusResult<T> = { success: true; data: T } | { success: false; error: FocusFailure }

function failure(code: string | undefined): FocusFailure {
  if (code === 'review_not_due' || code === 'conflict') return 'not_due'
  if (code === 'not_found' || code === 'trainer_access_denied') return 'not_found'
  if (code === 'invalid_learning_language') return 'language'
  if (code === 'not_authenticated') return 'not_authenticated'
  return 'failed'
}

/** Problemwörter der angemeldeten Person (ein Niveau) mit der nächsten Übungsrunde. */
export async function getVocabularyFocus(level: string, lang: string): Promise<FocusResult<VocabularyFocus>> {
  const parsed = z.object({ level: z.string().trim().min(1).max(30), lang: z.enum(['en', 'ru', 'uk', 'tr']) }).safeParse({ level, lang })
  if (!parsed.success) return { success: false, error: lang === 'de' ? 'language' : 'failed' }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_vocabulary_focus', { p_level: parsed.data.level, p_ui_language: parsed.data.lang })
    if (error) { console.error('[vocabulary-focus] load_failed'); return { success: false, error: 'failed' } }
    const rpcError = getRpcError(data)
    if (rpcError) return { success: false, error: failure(rpcError.error) }
    return { success: true, data: vocabularyFocusSchema.parse(data) }
  } catch { console.error('[vocabulary-focus] load_failed'); return { success: false, error: 'failed' } }
}

/** Eine Antwort im Problemwörter-Training; bewertet wird ausschließlich in PostgreSQL. */
export async function submitVocabularyFocusAnswer(input: unknown): Promise<FocusResult<FocusAnswerResult>> {
  const parsed = focusAnswerInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'failed' }
  const { requestId, cardId, format, answer, lang, expectedLearnerId } = parsed.data
  try {
    const supabase = await createClient()
    if (expectedLearnerId) {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || user?.id !== expectedLearnerId) return { success: false, error: 'not_authenticated' }
    }
    const { data, error } = await supabase.rpc('submit_vocabulary_focus_answer', {
      p_request_id: requestId, p_card_id: cardId, p_format: format, p_answer: answer, p_ui_language: lang,
    })
    if (error) { console.error('[vocabulary-focus] answer_failed'); return { success: false, error: 'failed' } }
    const rpcError = getRpcError(data)
    if (rpcError) return { success: false, error: failure(rpcError.error) }
    return { success: true, data: focusAnswerResultSchema.parse(data) }
  } catch { console.error('[vocabulary-focus] answer_failed'); return { success: false, error: 'failed' } }
}
