'use client'

import { useId, useSyncExternalStore } from 'react'
import { Check, Contrast, Moon, Sun } from 'lucide-react'
import { useAppearanceCopy } from './AppearanceProvider'
import {
  APPEARANCE_CHANGE_EVENT, getContrastPreference, getThemePreference,
  setContrastPreference, setThemePreference,
} from '@/lib/theme'

function subscribe(listener: () => void) {
  window.addEventListener(APPEARANCE_CHANGE_EVENT, listener)
  return () => window.removeEventListener(APPEARANCE_CHANGE_EVENT, listener)
}

function appearanceSnapshot() {
  const root = document.documentElement
  return `${root.dataset.theme ?? 'light'}:${root.dataset.contrast ?? 'standard'}:${getThemePreference() === 'system' && getContrastPreference() === 'system'}`
}

export function useAppearance() {
  const snapshot = useSyncExternalStore(subscribe, appearanceSnapshot, () => 'light:standard:true')
  const [theme, contrast, system] = snapshot.split(':')
  return { dark: theme === 'dark', high: contrast === 'high', system: system === 'true' }
}

export default function AppearanceOptions({ lightLabel, darkLabel }: { lightLabel?: string; darkLabel?: string }) {
  const copy = useAppearanceCopy()
  const state = useAppearance()
  const id = useId()
  return (
    <div className="academy-appearance-options min-w-0 space-y-4">
      <fieldset className="min-w-0">
        <legend className="mb-2 text-base font-semibold">{copy.theme}</legend>
        <div className="academy-appearance-theme-options grid grid-cols-2 gap-2">
          <button type="button" className="academy-appearance-theme-choice flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-base font-semibold" aria-label={lightLabel || copy.light} aria-pressed={!state.dark} onClick={() => setThemePreference('light')}>
            <Sun size={19} aria-hidden="true" /><span>{copy.light}</span>{!state.dark && <Check size={17} aria-hidden="true" className="shrink-0" />}
          </button>
          <button type="button" className="academy-appearance-theme-choice flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-base font-semibold" aria-label={darkLabel || copy.dark} aria-pressed={state.dark} onClick={() => setThemePreference('dark')}>
            <Moon size={19} aria-hidden="true" /><span>{copy.dark}</span>{state.dark && <Check size={17} aria-hidden="true" className="shrink-0" />}
          </button>
        </div>
      </fieldset>
      <div>
        <button type="button" role="switch" aria-checked={state.high} aria-labelledby={`${id}-contrast-label`} aria-describedby={`${id}-contrast-description`} onClick={() => setContrastPreference(state.high ? 'standard' : 'high')}
          className="academy-contrast-switch flex min-h-14 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-3 text-left text-base font-semibold">
          <span className="flex min-w-0 items-center gap-2"><Contrast size={21} className="shrink-0" aria-hidden="true" /><span id={`${id}-contrast-label`}>{copy.contrast}</span></span>
          <span className="academy-contrast-indicator relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-[var(--border)] bg-[var(--surface-muted)]" aria-hidden="true"><span className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--foreground)] text-[var(--surface)] transition-transform ${state.high ? 'translate-x-[22px]' : 'translate-x-0.5'}`}>{state.high && <Check size={14} />}</span></span>
        </button>
        <p id={`${id}-contrast-description`} className="mt-2 text-base leading-relaxed text-[var(--muted)]">{copy.contrast_description}</p>
      </div>
      <div className="border-t border-[var(--border)] pt-2">
        <button type="button" className="academy-appearance-system inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-2 py-2 text-center text-base font-semibold underline decoration-1 underline-offset-4" onClick={() => { setThemePreference('system'); setContrastPreference('system') }} aria-pressed={state.system}>
          {state.system && <Check size={18} className="shrink-0" aria-hidden="true" />}<span>{copy.system}</span>
        </button>
        {state.system && <p className="text-base leading-relaxed text-[var(--muted)]">{copy.system_description}</p>}
      </div>
    </div>
  )
}
