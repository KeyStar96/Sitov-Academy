import type { MediaFolder } from '@/lib/media'
import { mediaCopy } from '@/lib/media-i18n'
import VideoVisibilityToggle from '@/components/admin/VideoVisibilityToggle'
import MediaAssetViewer from './MediaAssetViewer'

export default function MediaFolders({ folders, lang, onVisibilityChanged }: { folders: MediaFolder[]; lang: string; onVisibilityChanged?: () => Promise<void> }) {
  const t = mediaCopy(lang)
  return <div className="space-y-6">{!folders.length && <p>{t.noFolders}</p>}{folders.map(folder => <section key={folder.folder_id} className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 sm:p-6">
    <h2 className="break-words text-xl font-semibold">{folder.title}</h2>
    {(['videos', 'presentations'] as const).map(kind => <section key={kind} className="space-y-3"><h3 className="text-lg font-medium">{t[kind]}</h3><div className="grid gap-3 lg:grid-cols-2">{folder.assets.filter(asset => asset.kind === kind).map(asset => <div key={asset.id} className="space-y-2"><MediaAssetViewer asset={asset} lang={lang} allowVideoDownload={!!onVisibilityChanged} />{onVisibilityChanged && asset.kind === 'videos' && <VideoVisibilityToggle id={asset.id} title={asset.title} isActive={asset.isActive ?? false} lang={lang} onChanged={onVisibilityChanged} />}</div>)}</div>{!folder.assets.some(asset => asset.kind === kind) && <p className="text-sm text-[var(--muted)]">{t.empty}</p>}</section>)}
  </section>)}</div>
}
