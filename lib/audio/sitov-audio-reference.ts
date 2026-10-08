import { z } from 'zod'
import type { NeuralAudioLanguage } from '@/lib/types/audio'

const part = z.string().min(1).max(180).regex(/^[a-zA-Z0-9_:-]+$/)
/** Authored identities only: callers cannot authorize a storage path or free text. */
export const sitovAudioReferenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('vocabulary_card'), id: z.string().uuid(), part }).strict(),
  z.object({ kind: z.literal('reading_text'), id: z.string().uuid(), part: z.literal('reference') }).strict(),
  z.object({ kind: z.literal('daily_quest'), id: z.string().uuid(), part }).strict(),
  z.object({ kind: z.literal('daily_quest_preview'), id: z.string().min(1).max(120).regex(/^sitov-[a-z0-9-]+$/),
    level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']), part }).strict(),
])
export type SitovAudioReference = z.infer<typeof sitovAudioReferenceSchema>

export const sitovAudioRequestSchema = z.object({
  reference: sitovAudioReferenceSchema,
  language: z.enum(['de', 'en', 'ru', 'uk', 'tr']),
  textSha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict()

/** No secrets or storage keys; cookie authentication and live access repeat on GET/HEAD/Range. */
export function sitovAudioGatewayUrl(reference: SitovAudioReference, language: NeuralAudioLanguage, textSha256: string): string {
  const request = sitovAudioRequestSchema.parse({ reference, language, textSha256 })
  const query = new URLSearchParams({ reference: JSON.stringify(request.reference), language, textSha256 })
  return `/api/sitov-audio?${query}`
}

export interface SitovAudioByteRange { start: number; end: number }
/** A single HTTP byte range. Reject multi-range and malformed values before copying audio bytes. */
export function sitovAudioByteRange(value: string | null, length: number): SitovAudioByteRange | null | 'unsatisfiable' {
  if (value === null) return null
  if (!Number.isSafeInteger(length) || length <= 0) return 'unsatisfiable'
  const match = /^bytes=(\d*)-(\d*)$/.exec(value)
  if (!match || (!match[1] && !match[2])) return 'unsatisfiable'
  const first = match[1] ? Number(match[1]) : undefined
  const last = match[2] ? Number(match[2]) : undefined
  if ((first !== undefined && !Number.isSafeInteger(first)) || (last !== undefined && !Number.isSafeInteger(last))) return 'unsatisfiable'
  if (first === undefined) {
    if (!last) return 'unsatisfiable'
    return { start: Math.max(0, length - last), end: length - 1 }
  }
  if (first >= length || (last !== undefined && last < first)) return 'unsatisfiable'
  return { start: first, end: Math.min(last ?? length - 1, length - 1) }
}
