import { Check, Headphones } from 'lucide-react'
import styles from './PronunciationStudio.module.css'

export type SitovPronunciationSceneState = 'idle' | 'listening' | 'recording' | 'review' | 'submitted'

/** Decorative sound sculpture. The actual microphone signal remains in LiveWaveform. */
export default function SitovPronunciationScene({ state = 'idle', compact = false }: {
  state?: SitovPronunciationSceneState
  compact?: boolean
}) {
  return <div className={styles.sitovScene} data-sitov-state={state} data-sitov-compact={compact} aria-hidden="true" inert>
    <span className={styles.sitovSceneGlow} />
    <span className={styles.sitovOrbit} />
    <span className={styles.sitovOrbitInner} />
    <span className={styles.sitovOrbitLight} />
    <span className={styles.sitovSoundHalo} />
    <span className={styles.sitovSoundHalo} data-sitov-second="true" />
    <span className={styles.sitovSoundHalo} data-sitov-third="true" />
    <span className={styles.sitovSoundRibbon} data-sitov-side="left"><svg viewBox="0 0 100 60" fill="none"><path d="M0 30C12 30 12 30 18 30S26 7 34 7 40 53 48 53 56 16 64 16 72 44 80 44 87 30 100 30" /></svg></span>
    <span className={styles.sitovSoundRibbon} data-sitov-side="right"><svg viewBox="0 0 100 60" fill="none"><path d="M0 30C12 30 12 30 18 30S26 7 34 7 40 53 48 53 56 16 64 16 72 44 80 44 87 30 100 30" /></svg></span>
    <span className={styles.sitovMicShadow} />
    <span className={styles.sitovMicSculpture}>
      <span className={styles.sitovMicCapsule}><span className={styles.sitovMicGrille} /><span className={styles.sitovMicLight} /></span>
      <svg viewBox="0 0 120 160" className={styles.sitovMicStand} fill="none">
        <path d="M22 53v18c0 49 76 49 76 0V53" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
        <path d="M60 110v27m-23 0h46" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      </svg>
    </span>
    <span className={styles.sitovSoundTile} data-sitov-tile="letter">ü</span>
    <span className={styles.sitovSoundTile} data-sitov-tile="symbol">{state === 'review' || state === 'submitted' ? <Check size={22} strokeWidth={2.5} /> : <Headphones size={22} />}</span>
    <span className={styles.sitovSceneSpark} data-sitov-spark="one" />
    <span className={styles.sitovSceneSpark} data-sitov-spark="two" />
  </div>
}
