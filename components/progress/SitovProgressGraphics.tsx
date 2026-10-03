import { useId, type CSSProperties } from 'react'
import styles from './SitovProgressMotion.module.css'

/** Decorative learning instruments. The real accuracy ring remains above them. */
export function SitovProgressHalo() {
  return <div className={styles.sitovHalo} aria-hidden="true">
    <span className={styles.sitovHaloGlow} />
    <span className={styles.sitovHaloOrbit} />
    <span className={styles.sitovHaloOrbit} data-sitov-inner="true" />
    <span className={styles.sitovHaloSatellite}><i /></span>
    <span className={styles.sitovHaloSatellite} data-sitov-second="true"><i /></span>
    <svg className={styles.sitovHaloMarks} viewBox="0 0 180 180" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.1" opacity=".4">
        <path d="M90 8v8m0 148v8M8 90h8m148 0h8M32 32l5 5m106 106 5 5M32 148l5-5m106-106 5-5" />
        <path d="m154 58 4-2M22 124l4-2m130 4-4-2M26 58l-4-2m104-36-2 4M56 158l2-4m66 0 2 4M58 26l-2-4" />
      </g>
      <g className={styles.sitovHaloGem} transform="translate(151 35)">
        <rect x="-9" y="-9" width="18" height="18" rx="6" fill="var(--surface)" stroke="var(--accent-text)" strokeWidth="1" />
        <path d="m-3 0 2 2 4-4" fill="none" stroke="var(--accent-text)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g className={styles.sitovHaloGem} data-sitov-second="true" transform="translate(28 135)">
        <rect x="-8" y="-8" width="16" height="16" rx="5" fill="var(--surface)" stroke="var(--violet)" strokeWidth="1" />
        <path d="M-3 2h6M-3-2h4" fill="none" stroke="var(--violet)" strokeWidth="1.3" strokeLinecap="round" />
      </g>
    </svg>
  </div>
}

/** An optical instrument, deliberately without axes or invented data. */
export function SitovProgressScene() {
  const sitovId = useId().replace(/:/g, '')
  const sitovGlass = `sitov-progress-glass-${sitovId}`
  return <svg className={styles.sitovInstrument} viewBox="0 0 250 160" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={sitovGlass} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="var(--accent)" stopOpacity=".16" />
        <stop offset=".55" stopColor="var(--surface)" />
        <stop offset="1" stopColor="var(--violet)" stopOpacity=".12" />
      </linearGradient>
    </defs>
    <ellipse cx="135" cy="121" rx="100" ry="24" fill="none" stroke="var(--accent-text)" strokeOpacity=".13" />
    <ellipse cx="135" cy="121" rx="72" ry="17" fill="none" stroke="var(--violet)" strokeOpacity=".18" strokeDasharray="3 7" />
    <g className={styles.sitovInstrumentBack}>
      <path d="m66 46 114-15 14 82-114 15Z" fill={`url(#${sitovGlass})`} stroke="var(--violet)" strokeOpacity=".3" />
      <circle cx="132" cy="79" r="23" fill="none" stroke="var(--violet)" strokeOpacity=".18" />
    </g>
    <g className={styles.sitovInstrumentFront}>
      <path d="m51 57 121-6 8 84-121 6Z" fill={`url(#${sitovGlass})`} stroke="var(--accent-text)" strokeOpacity=".5" strokeLinejoin="round" />
      <path d="m52 59 119-6" stroke="var(--accent-text)" strokeWidth="2.4" strokeOpacity=".7" strokeLinecap="round" />
      <g transform="translate(115 94)">
        <circle r="26" fill="var(--surface)" stroke="var(--accent-text)" strokeOpacity=".25" />
        <circle r="18" fill="none" stroke="var(--accent-text)" strokeOpacity=".5" />
        <circle r="8" fill="var(--accent)" fillOpacity=".15" stroke="var(--accent-text)" strokeOpacity=".8" />
        <path d="M0-32v8M0 24v8M-32 0h8M24 0h8" stroke="var(--accent-text)" strokeOpacity=".5" />
      </g>
      <path d="M74 124h19m5-1h7" stroke="var(--accent-text)" strokeOpacity=".35" strokeLinecap="round" strokeWidth="1.5" />
    </g>
    <g className={styles.sitovInstrumentGem}>
      <path d="m179 63 15-9 15 9v18l-15 9-15-9Z" fill="var(--surface)" stroke="var(--success)" strokeOpacity=".6" />
      <path d="m188 72 4 4 8-9" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <circle className={styles.sitovInstrumentSpark} cx="53" cy="45" r="2.5" fill="var(--accent-text)" />
    <circle className={styles.sitovInstrumentSpark} data-sitov-second="true" cx="201" cy="108" r="2" fill="var(--violet)" />
  </svg>
}

/** A rising stack of light and glass for the page title, without score claims. */
export function SitovProgressBeacon() {
  const sitovId = useId().replace(/:/g, '')
  const sitovGlass = `sitov-progress-beacon-${sitovId}`
  return <svg className={styles.sitovBeacon} viewBox="0 0 260 210" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={sitovGlass} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="var(--accent)" stopOpacity=".12" />
        <stop offset=".65" stopColor="var(--surface)" stopOpacity=".75" />
        <stop offset="1" stopColor="var(--violet)" stopOpacity=".2" />
      </linearGradient>
    </defs>
    <ellipse cx="128" cy="174" rx="106" ry="24" fill="none" stroke="var(--accent-text)" strokeOpacity=".15" />
    <ellipse cx="128" cy="174" rx="80" ry="15" fill="none" stroke="var(--violet)" strokeOpacity=".23" strokeDasharray="3 7" />
    <path d="M128 23v147" fill="none" stroke="var(--accent-text)" strokeOpacity=".18" strokeDasharray="2 6" />
    {[132, 100, 68].map((sitovY, sitovIndex) => <g key={sitovY} className={styles.sitovBeaconTier} style={{ '--sitov-tier-index': sitovIndex } as CSSProperties}>
      <path d={`m43 ${sitovY} 85-31 85 31-85 31Z`} fill={`url(#${sitovGlass})`} stroke={sitovIndex === 1 ? 'var(--violet)' : 'var(--accent-text)'} strokeOpacity={sitovIndex === 2 ? '.7' : '.35'} strokeLinejoin="round" />
      <path d={`m43 ${sitovY} 85 31 85-31v8l-85 31-85-31Z`} fill="var(--surface)" fillOpacity=".8" stroke="var(--accent-text)" strokeOpacity=".18" strokeLinejoin="round" />
      <path d={`m53 ${sitovY - 3} 75-27 74 27`} fill="none" stroke={sitovIndex === 1 ? 'var(--violet)' : 'var(--accent-text)'} strokeWidth="2" strokeOpacity=".6" strokeLinecap="round" />
    </g>)}
    <g className={styles.sitovBeaconCore}>
      <path d="m128 30 28 16v32l-28 16-28-16V46Z" fill="var(--surface)" stroke="var(--accent-text)" strokeWidth="1.5" />
      <path d="m128 30 28 16-28 16-28-16Z" fill="var(--accent)" fillOpacity=".3" />
      <path d="M128 62v32l28-16V46Z" fill="var(--accent)" fillOpacity=".15" />
      <path d="m116 58 9-9 9 9m-9-8v23" fill="none" stroke="var(--accent-text)" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    <g className={styles.sitovBeaconSpark}>
      <circle cx="67" cy="34" r="3" fill="var(--accent-text)" />
      <path d="M60 34h14m-7-7v14" stroke="var(--accent-text)" strokeOpacity=".4" />
    </g>
    <g className={styles.sitovBeaconSpark} data-sitov-second="true"><circle cx="212" cy="113" r="3" fill="var(--success)" /><circle cx="212" cy="113" r="8" fill="none" stroke="var(--success)" strokeOpacity=".25" /></g>
    <circle cx="35" cy="123" r="2.5" fill="var(--violet)" opacity=".5" />
  </svg>
}
