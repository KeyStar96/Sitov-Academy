'use client'

import { useEffect } from 'react'
import { applyContrast, applyTheme, getPreferredContrast, getPreferredTheme, syncAppearanceFromStorage } from '@/lib/theme'

/** Keep route changes, other tabs and system preferences on the same canvas. */
export function ThemeInit() {
  useEffect(() => {
    const root = document.documentElement
    // Preserve the parser-blocking result during hydration, including in-tab choices.
    applyTheme(root.dataset.theme === 'dark' || root.dataset.theme === 'light' ? root.dataset.theme : getPreferredTheme())
    applyContrast(root.dataset.contrast === 'high' || root.dataset.contrast === 'standard' ? root.dataset.contrast : getPreferredContrast())
    const themeSystem = window.matchMedia('(prefers-color-scheme: dark)')
    const contrastSystem = window.matchMedia('(prefers-contrast: more)')
    const syncTheme = () => applyTheme(getPreferredTheme())
    const syncContrast = () => applyContrast(getPreferredContrast())
    const syncStorage = (event: StorageEvent) => {
      // Session storage and unrelated preferences must not override these choices.
      try { if (event.storageArea && event.storageArea !== window.localStorage) return }
      catch { return }
      syncAppearanceFromStorage(event.key)
    }
    themeSystem.addEventListener('change', syncTheme)
    contrastSystem.addEventListener('change', syncContrast)
    window.addEventListener('storage', syncStorage)
    return () => {
      themeSystem.removeEventListener('change', syncTheme)
      contrastSystem.removeEventListener('change', syncContrast)
      window.removeEventListener('storage', syncStorage)
    }
  }, [])
  return null
}
