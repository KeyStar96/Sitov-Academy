import { useId, type CSSProperties } from 'react'
import type { LearningMode } from '@/lib/mode-targets'
import styles from './SitovTrainerCardScene.module.css'

export type SitovTrainerSceneMode = Exclude<LearningMode, 'verbs'>
export type SitovTrainerSceneTone = 'action' | 'calm' | 'done' | 'locked'

const sitovRoute = 'M 20 89 C 20 63 65 74 66 46 S 106 45 108 22'
const sitovWaveHeights = [12, 22, 36, 25, 16, 10, 13, 25, 38, 28, 19, 11]

/** Pure decorative artwork: no learner state, controls, sound, or frame loop. */
export default function SitovTrainerCardScene({ mode, tone = 'calm', className }: {
  mode: SitovTrainerSceneMode
  tone?: SitovTrainerSceneTone
  className?: string
}) {
  const sitovId = useId().replace(/:/g, '')
  const sitovGradient = `sitov-scene-gradient-${sitovId}`
  return <span className={`${styles.sitovScene}${className ? ` ${className}` : ''}`} data-mode={mode} data-tone={tone} aria-hidden="true">
    <span className={styles.sitovHalo} />
    <span className={styles.sitovGround} />
    {mode === 'vocabulary' && <>
      <span className={styles.sitovWordDeck}>
        {(['der', 'die', 'das'] as const).map((article, index) => <span key={article} className={styles.sitovWordLayer} data-card={article}>
          <span className={styles.sitovWordCard}>
            <span className={styles.sitovWordGlint} />
            <span className={styles.sitovArticle}>{article}</span>
            <span className={styles.sitovWordLine} /><span className={styles.sitovWordLine} data-short="true" />
            <span className={styles.sitovCardSeal}>{index === 1 ? 'ä' : index === 2 ? 'ß' : 'ü'}</span>
          </span>
        </span>)}
      </span>
      <span className={styles.sitovEmber} data-spark="1" /><span className={styles.sitovEmber} data-spark="2" /><span className={styles.sitovEmber} data-spark="3" />
    </>}
    {mode === 'path' && <svg className={styles.sitovRouteArt} viewBox="0 0 128 112" fill="none" focusable="false">
      <defs><linearGradient id={sitovGradient} x1="20" y1="89" x2="108" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="currentColor" stopOpacity=".35" /><stop offset=".55" stopColor="currentColor" /><stop offset="1" stopColor="currentColor" stopOpacity=".6" />
      </linearGradient></defs>
      <path className={styles.sitovRouteEcho} d="M8 96C8 61 52 85 54 51S96 56 103 10" />
      <path className={styles.sitovRouteGlow} d={sitovRoute} />
      <path className={styles.sitovRouteTrack} d={sitovRoute} stroke={`url(#${sitovGradient})`} />
      <path className={styles.sitovRouteBeacon} d={sitovRoute} pathLength="100" />
      {[[20, 89], [66, 46], [108, 22]].map(([x, y], index) => <g key={index} className={styles.sitovRouteStation} style={{ '--sitov-scene-delay': `${index * -2.6}s` } as CSSProperties}>
        <circle className={styles.sitovStationAura} cx={x} cy={y} r="12" />
        <circle className={styles.sitovStationRing} cx={x} cy={y} r="7.5" />
        <circle className={styles.sitovStationCore} cx={x} cy={y} r="3" />
      </g>)}
      <path className={styles.sitovRouteStar} d="M103 71v8m-4-4h8M31 34v6m-3-3h6" />
    </svg>}
    {mode === 'pronunciation' && <>
      <span className={styles.sitovAudioOrbit}><span className={styles.sitovAudioSatellite} /></span>
      <span className={styles.sitovAudioOrbit} data-second="true" />
      <span className={styles.sitovWave}>
        {sitovWaveHeights.map((height, index) => <span key={index} className={styles.sitovWaveBar} style={{ '--sitov-scene-bar-height': `${height}px`, '--sitov-scene-delay': `${index * -.43}s` } as CSSProperties} />)}
      </span>
      <svg className={styles.sitovMicrophone} viewBox="0 0 48 72" fill="none" focusable="false">
        <defs><linearGradient id={sitovGradient} x1="13" y1="9" x2="39" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--surface)" /><stop offset=".7" stopColor="var(--sitov-scene-tint)" /><stop offset="1" stopColor="currentColor" stopOpacity=".24" />
        </linearGradient></defs>
        <rect className={styles.sitovMicBody} x="13" y="7" width="22" height="37" rx="11" fill={`url(#${sitovGradient})`} />
        <path className={styles.sitovMicShine} d="M18 18c0-4 2-6 5-6" />
        <path className={styles.sitovMicGrille} d="M19 23h10m-10 6h10m-10 6h10" />
        <path className={styles.sitovMicStand} d="M7 34v3a17 17 0 0 0 34 0v-3M24 55v10m-10 0h20" />
      </svg>
      <span className={styles.sitovAudioGlint} />
    </>}
    {mode === 'media' && <>
      <span className={styles.sitovFilmRear}>
        <span className={styles.sitovFilmHoles} />
        <span className={styles.sitovFilmFrames}><i /><i /><i /></span>
        <span className={styles.sitovFilmHoles} data-bottom="true" />
      </span>
      <span className={styles.sitovFilmFront}>
        <span className={styles.sitovFilmHoles} />
        <span className={styles.sitovFilmScreen}>
          <span className={styles.sitovFilmLandscape} />
          <span className={styles.sitovPlayOrb}><svg viewBox="0 0 24 24" fill="currentColor" focusable="false"><path d="M9 5.8c0-.8.9-1.3 1.6-.8l9 6.2a1 1 0 0 1 0 1.6l-9 6.2c-.7.5-1.6 0-1.6-.8z" /></svg></span>
          <span className={styles.sitovFilmSheen} />
        </span>
        <span className={styles.sitovFilmHoles} data-bottom="true" />
      </span>
      <span className={styles.sitovMediaStar} /><span className={styles.sitovMediaStar} data-second="true" />
    </>}
  </span>
}
