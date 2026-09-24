import type { MediaFolder } from '@/lib/media'
import { learningResourceUrl, type VideoRecord } from '@/lib/video-links'

export interface LibraryLink { id: string; title: string; description: string | null; url: string; createdAt: string | null }
export interface LibraryGroup { id: string; title: string; createdAt: string | null; assets: MediaFolder['assets']; links: LibraryLink[] }

/**
 * Setzt die Mediathek aus Unterrichtsordnern und Video-Einträgen zusammen:
 * Ordner behalten ihre Reihenfolge und zeigen ihre eigenen Links, veröffentlichte
 * Uploads ohne Ordner landen in „Weitere Videos", Links ohne Ordner in der
 * Link-Liste. Entwürfe und ausgeblendete Einträge erscheinen nie.
 */
export function buildMediaLibrary({ videos, folders, looseTitle }: {
  videos: readonly VideoRecord[]
  folders: readonly MediaFolder[]
  looseTitle: string
}): { groups: LibraryGroup[]; links: LibraryLink[] } {
  const groups: LibraryGroup[] = folders.map(folder => ({ id: folder.folder_id, title: folder.title, createdAt: folder.created_at ?? null,
    assets: folder.assets.filter(asset => asset.kind !== 'videos' || asset.isActive !== false),
    links: folder.links.filter(link => link.isActive).map(({ id, title, description, url, createdAt }) => ({ id, title, description, url, createdAt })) }))
  const inFolders = new Set(folders.flatMap(folder => [...folder.assets, ...folder.links].map(item => item.id)))
  const loose = videos.filter(video => video.is_active && video.storage_path && video.file_size && !inFolders.has(video.id))
  if (loose.length) groups.push({ id: 'loose', title: looseTitle, createdAt: null, links: [], assets: loose.map(video => ({
    id: video.id, title: video.title, path: video.storage_path!, bytes: video.file_size!, mime: video.storage_path!.endsWith('.webm') ? 'video/webm' : 'video/mp4',
    kind: 'videos' as const, createdAt: video.created_at })) })
  const links = videos.flatMap(video => {
    const url = video.is_active && !video.storage_path && !inFolders.has(video.id) ? learningResourceUrl(video.source_url) : null
    return url ? [{ id: video.id, title: video.title, description: video.description, url, createdAt: video.created_at }] : []
  })
  return { groups, links }
}
