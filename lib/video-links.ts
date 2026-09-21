import { z } from 'zod'
import { ACCESS_LEVELS } from '@/lib/access/levels'

export const videoRecordSchema = z.object({
  id: z.string(), title: z.string(), level: z.string(), unit_id: z.string().uuid(),
  description: z.string().nullable(), source_url: z.string().nullable(),
  is_active: z.boolean(), created_at: z.string().nullable(),
  folder_id: z.string().uuid().nullable().optional(), storage_path: z.string().nullable().optional(), file_size: z.number().nullable().optional(),
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

/** Accept real outbound learning resources; preserve authored URLs and normalize YouTube. */
export function learningResourceUrl(input: string | null | undefined): string | null {
  if (!input?.trim()) return null
  const value = input.trim()
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || /\s/.test(value)) return null
    return youtubeWatchUrl(value) ?? value
  } catch { return null }
}

export const videoInputSchema = z.object({
  level: z.enum(ACCESS_LEVELS),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1200).default(''),
  source_url: z.string().trim().refine(value => value === '' || learningResourceUrl(value) !== null).transform(learningResourceUrl),
  is_active: z.boolean(),
  folder_id: z.string().uuid().nullable().optional(),
  storage_path: z.string().min(1).nullable().optional(),
  file_size: z.number().int().positive().max(536870912).nullable().optional(),
}).refine(value => !value.storage_path || (!!value.folder_id && !!value.file_size), { message: 'Uploaded files require a folder and size' })
.refine(value => !value.is_active || value.source_url !== null || !!value.storage_path, { path: ['source_url'], message: 'Published resources require a URL' })
export interface VideoWriteInput { level: string; title: string; description: string; source_url: string; is_active: boolean; folder_id?: string | null; storage_path?: string | null; file_size?: number | null }
/** `code` trägt den maschinenlesbaren RPC-/SQLSTATE-Code (R10); `error` bleibt
 * die schmale UI-Kategorie, damit bestehende i18n-Zuordnungen gültig bleiben. */
export interface VideoWriteResult { success: boolean; data?: VideoRecord; error?: 'invalid_input' | 'save_failed'; code?: string }
export interface VideoDeleteResult { success: boolean; error?: 'invalid_input' | 'delete_failed'; code?: string }
