'use client'

import { useEffect } from 'react'
import { applyTheme, getPreferredTheme } from '@/lib/theme'

/** Keep route changes, other tabs and system theme changes on the same canvas. */
export function ThemeInit() {
  useEffect(() => {
    const root = document.documentElement
    const sync = () => applyTheme(getPreferredTheme())
    // The head script already applied the preference. Preserve it during hydration,
    // including an in-tab choice made while localStorage is unavailable.
    if (root.dataset.theme !== 'dark' && root.dataset.theme !== 'light') sync()
    else applyTheme(root.dataset.theme)
    const system = window.matchMedia('(prefers-color-scheme: dark)')
    system.addEventListener('change', sync)
    window.addEventListener('storage', sync)
    return () => {
      system.removeEventListener('change', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return null
}
