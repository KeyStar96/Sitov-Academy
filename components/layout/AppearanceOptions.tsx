'use client'

import { useId, useSyncExternalStore } from 'react'
import { Check, Contrast, Moon, Sun } from 'lucide-react'
import styles from './SitovAppearance.module.css'
import { useAppearanceCopy } from './AppearanceProvider'
import {
  APPEARANCE_CHANGE_EVENT,
  setContrastPreference, setThemePreference,
} from '@/lib/theme'

function subscribe(listener: () => void) {
  window.addEventListener(APPEARANCE_CHANGE_EVENT, listener)
  return () => window.removeEventListener(APPEARANCE_CHANGE_EVENT, listener)
}

function appearanceSnapshot() {
  const root = document.documentElement
  return `${root.dataset.theme ?? 'light'}:${root.dataset.contrast ?? 'standard'}`
}

export function useAppearance() {
  const snapshot = useSyncExternalStore(subscribe, appearanceSnapshot, () => 'light:standard')
  const [theme, contrast] = snapshot.split(':')
  return { dark: theme === 'dark', high: contrast === 'high' }
}

export default function AppearanceOptions({ lightLabel, darkLabel }: { lightLabel?: string; darkLabel?: string }) {
  const copy = useAppearanceCopy()
  const state = useAppearance()
  const id = useId()
  return (
    <div className={`academy-appearance-options min-w-0 ${styles.options}`} data-sitov-appearance-theme={state.dark ? 'dark' : 'light'}>
      <fieldset className="min-w-0">
        <legend className={styles.legend}>{copy.theme}</legend>
        <div className={`academy-appearance-theme-options ${styles.themes}`}>
          <button type="button" className={styles.themeChoice} data-sitov-scheme="light" aria-label={lightLabel || copy.light} aria-pressed={!state.dark} onClick={() => setThemePreference('light')}>
            <SitovAppearanceScene scheme="light" />
            <span className={styles.choiceLabel}><Sun size={18} aria-hidden="true" /><span>{copy.light}</span><span className={styles.selection} aria-hidden="true">{!state.dark && <Check size={14} />}</span></span>
          </button>
          <button type="button" className={styles.themeChoice} data-sitov-scheme="dark" aria-label={darkLabel || copy.dark} aria-pressed={state.dark} onClick={() => setThemePreference('dark')}>
            <SitovAppearanceScene scheme="dark" />
            <span className={styles.choiceLabel}><Moon size={18} aria-hidden="true" /><span>{copy.dark}</span><span className={styles.selection} aria-hidden="true">{state.dark && <Check size={14} />}</span></span>
          </button>
        </div>
      </fieldset>
      <div>
        <button type="button" role="switch" aria-checked={state.high} aria-labelledby={`${id}-contrast-label`} onClick={() => setContrastPreference(state.high ? 'standard' : 'high')}
          className={`academy-contrast-switch ${styles.contrastSwitch}`}>
          <span className="flex min-w-0 items-center gap-2"><Contrast size={21} className="shrink-0" aria-hidden="true" /><span id={`${id}-contrast-label`}>{copy.contrast}</span></span>
          <span className={`academy-contrast-indicator ${styles.switchTrack}`} aria-hidden="true"><span className={styles.switchThumb}>{state.high && <Check size={13} />}</span></span>
        </button>
      </div>
    </div>
  )
}

/** Original miniature learning worlds, animated with CSS and no external artwork. */
function SitovAppearanceScene({ scheme }: { scheme: 'light' | 'dark' }) {
  return <span className={styles.scene} aria-hidden="true" data-scheme={scheme}>
    <span className={styles.sceneHalo} /><span className={styles.sceneOrb}>{scheme === 'light' ? <Sun size={27} /> : <Moon size={26} />}</span>
    <span className={styles.sceneOrbit} /><span className={styles.sceneSpark} /><span className={styles.sceneSpark} />
    <span className={styles.sceneCard}><i /><i /><span><b /><b /><b /></span></span>
  </span>
}
