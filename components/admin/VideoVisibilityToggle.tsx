'use client'

import { useEffect, useState } from 'react'
import { setVideoVisibility } from '@/app/actions/media'
import { mediaCopy } from '@/lib/media-i18n'

export default function VideoVisibilityToggle({ id, title, isActive, lang, onChanged }: {
  id: string; title: string; isActive: boolean; lang: string; onChanged?: (visible: boolean) => void | Promise<void>
}) {
  const t = mediaCopy(lang)
  const [visible, setVisible] = useState(isActive)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => { setVisible(isActive) }, [isActive])
  async function toggle() {
    if (busy) return
    setBusy(true); setFailed(false)
    try {
      const result = await setVideoVisibility({ video_id: id, is_active: !visible })
      if (!result.success) throw new Error('save_failed')
      setVisible(result.data.is_active)
      await onChanged?.(result.data.is_active)
    } catch { setFailed(true) } finally { setBusy(false) }
  }
  return <div className="space-y-2"><button type="button" role="switch" aria-checked={visible} aria-label={`${t.visibility}: ${title}`} disabled={busy} onClick={() => void toggle()} className="inline-flex min-h-11 items-center gap-3 rounded-lg px-1 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-60">
    <span aria-hidden="true" className={`flex h-6 w-10 shrink-0 items-center rounded-full border p-0.5 transition-colors ${visible ? 'border-[var(--accent-strong)] bg-[var(--accent-strong)]' : 'border-[var(--border)] bg-[var(--surface-muted)]'}`}><span className={`h-[1.125rem] w-[1.125rem] rounded-full bg-[var(--surface)] shadow-sm transition-transform ${visible ? 'translate-x-4' : ''}`} /></span>
    <span>{busy ? t.finalizing : visible ? t.visible : t.hidden}</span>
  </button>{failed && <p role="alert" className="text-sm text-[var(--danger)]">{t.failed}</p>}</div>
}
