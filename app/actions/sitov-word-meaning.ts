'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { getPronunciationPrompts } from '@/app/actions/pronunciation'
import { vocabularyQuery } from '@/lib/learning-catalog'
import { rateLimit } from '@/lib/ratelimit'
import { sitovLocalWordMeaning, sitovLookupWord, sitovWordCandidates, type SitovWordMeaningResult } from '@/lib/sitov-word-meaning'

const sitovInput = z.object({ promptId: z.uuid(), level: z.string().trim().min(1).max(8),
  word: z.string().trim().min(1).max(80), locale: z.enum(['de', 'en', 'ru', 'uk', 'tr']) }).strict()

/** The word must belong to a currently accessible reading. RLS owns vocabulary visibility. */
export async function getSitovWordMeaning(input: { promptId: string; level: string; word: string; locale: string }): Promise<SitovWordMeaningResult> {
  const parsed = sitovInput.safeParse(input)
  if (!parsed.success) return { ok: false }
  const { promptId, level, word, locale } = parsed.data
  const normalized = sitovLookupWord(word)
  if (!/^[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*$/u.test(normalized)) return { ok: false }
  try {
    const client = await createClient()
    const { data: { user }, error: authError } = await client.auth.getUser()
    if (!user || authError) return { ok: false }
    if (!(await rateLimit(`sitov-word-meaning:${user.id}`, 120, '60 s')).success) return { ok: false }
    const prompt = (await getPronunciationPrompts(level)).find(value => value.id === promptId)
    if (!prompt || !prompt.sentenceDe.split(/\s+/u).some(token => sitovLookupWord(token) === normalized)) return { ok: false }
    const local = sitovLocalWordMeaning(word, locale)
    if (local) return { ok: true, meaning: local }
    const candidates = sitovWordCandidates(word)
    const filters = candidates.flatMap(value => [`word_de.ilike.${value}`, `plural.ilike.${value}`]).join(',')
    const { data, error } = await vocabularyQuery(client).or(filters).eq('unit.is_active', true).limit(12)
    if (error) return { ok: false }
    // Prefer the exact form over a possible declension with several meanings.
    const rows = [...(data ?? [])].sort((a, b) => Number(sitovLookupWord(b.word_de) === normalized || sitovLookupWord(b.plural ?? '') === normalized)
      - Number(sitovLookupWord(a.word_de) === normalized || sitovLookupWord(a.plural ?? '') === normalized))
    for (const row of rows) {
      const translation = locale === 'de' ? `${row.article && row.article !== 'none' ? `${row.article} ` : ''}${row.word_de}`
        : row.translations.find(value => value.locale === locale)?.translation
      if (translation?.trim()) return { ok: true, meaning: { word, base: row.word_de, translation: translation.trim(), locale } }
    }
    return { ok: true, meaning: null }
  } catch { return { ok: false } }
}
