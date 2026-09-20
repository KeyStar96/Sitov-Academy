import { z } from 'zod'
import { ACCESS_LEVELS } from '@/lib/access/levels'

export const MEDIA_BUCKET = 'course-assets'
export const MAX_MEDIA_BYTES = 512 * 1024 * 1024
export const MEDIA_FORMATS = {
  mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  key: 'application/vnd.apple.keynote',
} as const
export type MediaFormat = keyof typeof MEDIA_FORMATS
export const mediaFileSchema = z.object({
  name: z.string().trim().min(1).max(255).refine(v => !/[\x00-\x1f/\\]/.test(v)),
  size: z.number().int().positive().max(MAX_MEDIA_BYTES),
  type: z.string(),
}).transform((file, ctx) => {
  const format = file.name.split('.').pop()?.toLowerCase() as MediaFormat
  const mime = MEDIA_FORMATS[format]
  // Browsers commonly leave .key/.pptx MIME blank or report ZIP/octet-stream.
  const genericOfficeMime = ['key', 'pptx'].includes(format) && ['', 'application/octet-stream', 'application/zip'].includes(file.type)
  if (!mime || (file.type !== mime && !genericOfficeMime)) {
    ctx.addIssue({ code: 'custom', message: 'Unsupported file type' }); return z.NEVER
  }
  return { ...file, type: mime, format, kind: (format === 'mp4' || format === 'webm' ? 'videos' : 'presentations') as 'videos' | 'presentations' }
})
export const folderWriteSchema = z.object({
  folder_id: z.string().uuid().optional(), level: z.enum(ACCESS_LEVELS),
  title: z.string().trim().min(1).max(180),
  sort_order: z.number().int().min(0).max(100000),
}).strict()
export const completeUploadSchema = z.object({
  asset_id: z.string().uuid(), folder_id: z.string().uuid(),
  title: z.string().trim().min(1).max(180), file: mediaFileSchema,
}).strict()
export interface MediaAsset { id: string; title: string; path: string; mime: string; bytes: number; kind: 'videos' | 'presentations'; isActive?: boolean }
export interface MediaFolder { folder_id: string; level: string; course_id: string | null; title: string; sort_order: number; assets: MediaAsset[] }
export function mediaPath(level: string, folderId: string, assetId: string, format: MediaFormat) {
  return `${level}/${folderId}/${format === 'mp4' || format === 'webm' ? 'videos' : 'presentations'}/${assetId}.${format}`
}
