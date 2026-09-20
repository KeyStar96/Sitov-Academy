'use client'

import { Upload, DefaultHttpStack } from 'tus-js-client'
import { createClient } from '@/utils/supabase/client'
import { readSupabasePublicConfig } from '@/lib/supabase-env'
import { MEDIA_BUCKET, mediaPath, mediaFileSchema } from '@/lib/media'

export interface UploadTicket { assetId: string; completed: boolean; title: string }
/** TUS Location may contain Storage's internal host. Never send browser credentials
 * to it: constrain requests to this deployment's configured public API and path. */
export function publicTusUrl(value: string, endpoint: string) {
  const url = new URL(value, endpoint)
  const match = url.pathname.match(/(?:\/storage\/v1)?\/upload\/resumable(\/[^?#]*)?$/)
  if (!match || url.username || url.password || url.hash) throw new Error('Invalid upload URL')
  return endpoint + (match[1] ?? '') + url.search
}
export function uploadTicketKey(userId: string, folderId: string, file: File) {
  return `sitov-media:${userId}:${folderId}:${encodeURIComponent(file.name)}:${file.size}:${file.lastModified}`
}
export function readUploadTicket(key: string, title: string): UploadTicket {
  const stored = localStorage.getItem(key)
  if (stored) {
    try {
      const value = JSON.parse(stored)
      if (/^[0-9a-f-]{36}$/.test(value.assetId) && typeof value.completed === 'boolean' && typeof value.title === 'string') return value
    } catch { /* Invalid browser state is replaced, never used as authorization. */ }
  }
  const ticket = { assetId: crypto.randomUUID(), completed: false, title }
  localStorage.setItem(key, JSON.stringify(ticket))
  return ticket
}
export async function createMediaUpload(file: File, folder: { folder_id: string; level: string }, ticket: UploadTicket, userId: string, callbacks: {
  onProgress: (percent: number) => void; onSuccess: () => void; onError: () => void
}) {
  const parsed = mediaFileSchema.parse({ name: file.name, size: file.size, type: file.type })
  const client = createClient()
  const config = readSupabasePublicConfig({ NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY })
  const endpoint = `${config.url}/storage/v1/upload/resumable`
  const stack = new DefaultHttpStack({})
  let refreshRequired = false
  const upload = new Upload(file, {
    endpoint, chunkSize: 6 * 1024 * 1024, parallelUploads: 1,
    uploadDataDuringCreation: true, removeFingerprintOnSuccess: true,
    retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
    fingerprint: async () => `sitov-tus:${config.url}:${userId}:${ticket.assetId}`,
    metadata: { bucketName: MEDIA_BUCKET, objectName: mediaPath(folder.level, folder.folder_id, ticket.assetId, parsed.format), contentType: parsed.type, cacheControl: '60' },
    httpStack: { createRequest: (method, url) => stack.createRequest(method, publicTusUrl(url, endpoint)), getName: () => 'SelfHostedTus' },
    onBeforeRequest: async request => {
      const initial = await client.auth.getSession()
      let session = initial.data.session
      if (initial.error || !session) throw new Error('not_authenticated')
      if (refreshRequired || !session.expires_at || session.expires_at * 1000 < Date.now() + 60000) {
        const refreshed = await client.auth.refreshSession()
        if (refreshed.error || !refreshed.data.session) throw new Error('not_authenticated')
        session = refreshed.data.session; refreshRequired = false
      }
      if (session.user.id !== userId) throw new Error('session_changed')
      request.setHeader('authorization', `Bearer ${session.access_token}`)
      request.setHeader('apikey', config.anonKey)
      // Never overwrite another completed object, even during a resumed upload.
      request.setHeader('x-upsert', 'false')
    },
    onShouldRetry: error => {
      const status = error.originalResponse?.getStatus() ?? 0
      if (status === 401) refreshRequired = true
      return [0, 401, 408, 409, 423, 429].includes(status) || status >= 500
    },
    onProgress: (sent, total) => callbacks.onProgress(total ? Math.round(sent / total * 100) : 0),
    onSuccess: callbacks.onSuccess, onError: callbacks.onError,
  })
  const previous = await upload.findPreviousUploads()
  if (previous.length) upload.resumeFromPreviousUpload(previous[0])
  return upload
}
