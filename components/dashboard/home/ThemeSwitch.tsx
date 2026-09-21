'use client'

import { Moon, Sun } from 'lucide-react'
import { useAppearance } from '@/components/layout/AppearanceOptions'
import { useAppearanceCopy } from '@/components/layout/AppearanceProvider'
import { setThemePreference } from '@/lib/theme'

/**
 * Eleganter iOS-Schieberegler für Hell/Dunkel.
 *
 * Nutzt denselben Zustands- und Persistenz-Layer wie die übrige Oberfläche
 * (`useAppearance` + `setThemePreference`). Icon **und** Textbeschriftung sind
 * sichtbar – bewusst gut lesbar für die Zielgruppe 50+.
 */
export default function ThemeSwitch() {
  const copy = useAppearanceCopy()
  const { dark } = useAppearance()
  return (
    <div className="flex shrink-0 items-center gap-3">
      <span className="text-base font-semibold text-[var(--foreground)]">{dark ? copy.dark : copy.light}</span>
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-label={`${copy.theme}: ${dark ? copy.dark : copy.light}`}
        onClick={() => setThemePreference(dark ? 'light' : 'dark')}
        className="relative inline-flex h-11 w-[4.75rem] shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-1 transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
      >
        {/* Both destinations stay visible so the control reads as a slider, not an icon. */}
        <Sun size={18} aria-hidden="true" className={`absolute left-2 transition-opacity ${dark ? 'opacity-40 text-[var(--muted)]' : 'opacity-100 text-[var(--accent-text)]'}`} />
        <Moon size={18} aria-hidden="true" className={`absolute right-2 transition-opacity ${dark ? 'opacity-100 text-[var(--violet)]' : 'opacity-40 text-[var(--muted)]'}`} />
        <span className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none ${dark ? 'translate-x-[2.05rem]' : 'translate-x-0'}`}>
          {dark ? <Moon size={18} aria-hidden="true" className="text-[var(--violet)]" /> : <Sun size={18} aria-hidden="true" className="text-[var(--accent-text)]" />}
        </span>
      </button>
    </div>
  )
}
