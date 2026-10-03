'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { APPEARANCE_CHANGE_EVENT, applyContrast, applyTheme } from '@/lib/theme'

function sitovSubscribe(onChange: () => void) {
  window.addEventListener(APPEARANCE_CHANGE_EVENT, onChange)
  return () => window.removeEventListener(APPEARANCE_CHANGE_EVENT, onChange)
}
function sitovRead() { return `${document.documentElement.dataset.theme}:${document.documentElement.dataset.contrast}` }

/** Development previews change only this document, never saved preferences. */
export default function SitovPreviewAppearance() {
  const sitovAppearance = useSyncExternalStore(sitovSubscribe, sitovRead, () => 'unknown')
  const [sitovTheme, sitovContrast] = sitovAppearance.split(':')
  useEffect(() => {
    const root = document.documentElement
    const initialTheme = root.classList.contains('dark') ? 'dark' : 'light'
    const initialContrast = root.classList.contains('high-contrast') ? 'high' : 'standard'
    return () => { applyTheme(initialTheme); applyContrast(initialContrast) }
  }, [])

  return <div aria-label="Preview appearance" className="flex flex-wrap gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
    {(['light', 'dark'] as const).map(theme => <button key={theme} type="button" aria-pressed={sitovTheme === theme} onClick={() => applyTheme(theme)} className="st-button st-button--soft !min-h-11 !px-4 !py-2">{theme === 'light' ? 'Light' : 'Dark'}</button>)}
    {(['standard', 'high'] as const).map(contrast => <button key={contrast} type="button" aria-pressed={sitovContrast === contrast} onClick={() => applyContrast(contrast)} className="st-button st-button--soft !min-h-11 !px-4 !py-2">{contrast === 'standard' ? 'Standard' : 'High contrast'}</button>)}
  </div>
}
