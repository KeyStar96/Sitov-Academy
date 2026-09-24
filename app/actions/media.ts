'use server'

import { z } from 'zod'
import { withBackendSession, checkDatabaseError, checkRpcError, BackendError, revalidateBackendPages, type BackendContext } from '@/lib/actions/backend'
import { folderWriteSchema, completeUploadSchema, mediaLinkSchema, mediaPath, type LooseMediaLink, type MediaFolder } from '@/lib/media'
import { readAllRows } from '@/lib/supabase-read'
import { learningResourceUrl } from '@/lib/video-links'
import { saveLearningContent, deleteLearningContent } from '@/lib/learning-writes'

export async function getMediaFolders(level?: string) {
  return withBackendSession(async ({ supabase }) => {
    const requestedLevel = level === undefined ? undefined : z.string().min(1).max(10).parse(level)
    const folders = await readAllRows((from, to) => {
      let query = supabase.from('lms_media_folder').select('folder_id,level,course_id,title,sort_order,created_at').order('sort_order').order('title').order('folder_id')
      if (requestedLevel !== undefined) query = query.eq('level', requestedLevel)
      return query.range(from, to)
    })
    if (!folders?.length) return [] as MediaFolder[]
    const result: MediaFolder[] = []
    // Bound URL lengths and paginate each asset query: a folder may hold more
    // than PostgREST's default row limit. Cookie-client RLS stays in effect.
    for (let offset = 0; offset < folders.length; offset += 100) {
      const batch = folders.slice(offset, offset + 100), ids = batch.map(folder => folder.folder_id)
      const [videos, presentations] = await Promise.all([
        // Uploads and web links share learning_videos: a link is a row without a file.
        readAllRows((from, to) => supabase.from('learning_videos').select('id,folder_id,title,description,source_url,storage_path,file_size,created_at,unit:learning_units!inner(is_active)').in('folder_id', ids).order('created_at').order('id').range(from, to)),
        readAllRows((from, to) => supabase.from('lms_presentation_asset').select('asset_id,folder_id,file_name,storage_path,mime_type,file_size,created_at').in('folder_id', ids).order('sort_order').order('file_name').order('asset_id').range(from, to)),
      ])
      const uploads = videos.filter(video => video.storage_path !== null)
      result.push(...batch.map(folder => ({ ...folder, assets: [
        ...uploads.filter(asset => asset.folder_id === folder.folder_id).map(asset => ({ id: asset.id, title: asset.title!, path: asset.storage_path!, bytes: asset.file_size!, mime: asset.storage_path!.endsWith('.webm') ? 'video/webm' : 'video/mp4', kind: 'videos' as const, isActive: asset.unit.is_active, createdAt: asset.created_at })),
        ...presentations.filter(asset => asset.folder_id === folder.folder_id).map(asset => ({ id: asset.asset_id, title: asset.file_name, path: asset.storage_path, bytes: asset.file_size, mime: asset.mime_type, kind: 'presentations' as const, createdAt: asset.created_at })),
      ], links: videos.flatMap(video => {
        const url = video.folder_id === folder.folder_id && video.storage_path === null ? learningResourceUrl(video.source_url) : null
        return url ? [{ id: video.id, title: video.title ?? url, description: video.description, url, isActive: video.unit.is_active, createdAt: video.created_at }] : []
      }) })))
    }
    return result
  })
}

/** Links from the former video management that were never put into a folder. */
export async function getLooseMediaLinks() {
  return withBackendSession(async ({ supabase }) => {
    const rows = await readAllRows((from, to) => supabase.from('learning_videos').select('id,title,description,source_url,created_at,unit:learning_units!inner(level,is_active)')
      .is('folder_id', null).is('storage_path', null).order('created_at').order('id').range(from, to))
    return rows.flatMap(row => {
      const url = learningResourceUrl(row.source_url)
      return url ? [{ id: row.id, title: row.title ?? url, description: row.description, url, isActive: row.unit.is_active, createdAt: row.created_at, level: row.unit.level }] : []
    }) satisfies LooseMediaLink[]
  }, 'staff')
}

export async function saveMediaFolder(input: unknown) {
  return withBackendSession(async ({ supabase }) => {
    const { folder_id, ...fields } = folderWriteSchema.parse(input)
    const query = folder_id ? supabase.from('lms_media_folder').update(fields).eq('folder_id', folder_id) : supabase.from('lms_media_folder').insert(fields)
    const { data, error } = await query.select('folder_id,level,course_id,title,sort_order').single()
    checkDatabaseError(error); revalidateBackendPages(); return data!
  }, 'staff')
}

/** Saves a YouTube, video or website link into a folder. The level always
 * follows the persisted folder, and uploaded files can never be overwritten. */
export async function saveMediaLink(input: unknown) {
  return withBackendSession(async ({ supabase }) => {
    const { video_id, folder_id, url, ...fields } = mediaLinkSchema.parse(input)
    const folder = await supabase.from('lms_media_folder').select('level').eq('folder_id', folder_id).single()
    checkDatabaseError(folder.error)
    if (video_id) await requireLinkRow(supabase, video_id)
    let saved: unknown
    try {
      saved = await saveLearningContent(supabase, 'videos', { ...fields, level: folder.data!.level, source_url: url, folder_id, storage_path: null, file_size: null }, video_id)
    } catch { throw new BackendError('invalid_input') }
    revalidateBackendPages()
    return z.object({ id: z.string().uuid() }).parse(saved)
  }, 'staff')
}

export async function deleteMediaLink(input: unknown) {
  return withBackendSession(async ({ supabase }) => {
    const { video_id } = z.object({ video_id: z.string().uuid() }).strict().parse(input)
    await requireLinkRow(supabase, video_id)
    try { await deleteLearningContent(supabase, 'videos', video_id) } catch { throw new BackendError('request_failed') }
    revalidateBackendPages()
    return { video_id }
  }, 'staff')
}

async function requireLinkRow(supabase: BackendContext['supabase'], id: string) {
  const { data, error } = await supabase.from('learning_videos').select('storage_path').eq('id', id).single()
  checkDatabaseError(error)
  if (!data) throw new BackendError('not_found')
  if (data.storage_path !== null) throw new BackendError('invalid_input')
}

export async function completeMediaUpload(input: unknown) {
  return withBackendSession(async ({ supabase }) => {
    const asset = completeUploadSchema.parse(input)
    const folder = await supabase.from('lms_media_folder').select('level').eq('folder_id', asset.folder_id).single()
    checkDatabaseError(folder.error)
    const { data, error } = await supabase.rpc('complete_media_upload', { p_payload: {
      asset_id: asset.asset_id, folder_id: asset.folder_id, title: asset.title,
      file_name: asset.file.name, file_size: asset.file.size, mime_type: asset.file.type,
      storage_path: mediaPath(folder.data!.level, asset.folder_id, asset.asset_id, asset.file.format),
    } })
    checkDatabaseError(error); checkRpcError(data)
    const result = z.object({ asset_id: z.string().uuid() }).parse(data)
    revalidateBackendPages(); return result
  }, 'staff')
}

/** Publication uses the existing video unit flag; learner access remains in RLS. */
export async function setVideoVisibility(input: unknown) {
  return withBackendSession(async ({ supabase }) => {
    const fields = z.object({ video_id: z.string().uuid(), is_active: z.boolean() }).strict().parse(input)
    const { data: video, error } = await supabase.from('learning_videos').select('unit_id,source_url,storage_path').eq('id', fields.video_id).single()
    checkDatabaseError(error)
    if (!video) throw new BackendError('not_found')
    if (fields.is_active && !video.storage_path && !video.source_url) throw new BackendError('invalid_input')
    const updated = await supabase.from('learning_units').update({ is_active: fields.is_active }).eq('id', video.unit_id).select('is_active').single()
    checkDatabaseError(updated.error)
    if (!updated.data) throw new BackendError('not_found')
    revalidateBackendPages()
    return { video_id: fields.video_id, is_active: updated.data.is_active }
  }, 'staff')
}
