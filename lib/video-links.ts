import { z } from 'zod'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import type { Database } from '@/supabase/database.types'

export const videoRecordSchema = z.object({
  id: z.string(), title: z.string(), lesson: z.string(), level: z.string(), unit_id: z.string().optional(),
  description: z.string().nullable(), video_url: z.string().nullable(), external_url: z.string().nullable(),
  is_external: z.boolean().nullable(), created_at: z.string().nullable(),
})
export type VideoRecord = z.infer<typeof videoRecordSchema>

/** Canonical watch links only: no embeds, trackers, open redirects or arbitrary hosts. */
export function youtubeWatchUrl(input: string | null | undefined): string | null {
  if (!input) return null
  try {
    const url = new URL(input)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
    const host = url.hostname.toLowerCase()
    let id: string | null = null
    if (host === 'youtu.be') id = url.pathname.slice(1)
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v')
      else id = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)\/?$/)?.[1] ?? null
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : null
  } catch { return null }
}

export const videoInputSchema = z.object({
  level: z.enum(ACCESS_LEVELS),
  title: z.string().trim().min(2).max(180),
  lesson: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1200).default(''),
  external_url: z.string().transform(youtubeWatchUrl).refine((value): value is string => value !== null),
})
export interface VideoWriteInput { level: string; title: string; lesson: string; description: string; external_url: string }
export interface VideoWriteResult { success: boolean; data?: VideoRecord; error?: 'invalid_input' | 'save_failed' }
export interface VideoDeleteResult { success: boolean; error?: 'invalid_input' | 'delete_failed' }
