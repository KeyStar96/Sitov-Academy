import styles from './SitovLevelSupport.module.css'

/** A decorative miniature: each level is a new step, never invented progress. */
export default function SitovLevelArt({ id, index, locked }: { id: string; index: number; locked: boolean }) {
  const sitovGradient = `sitov-level-${id.replace(/[^a-z0-9]/gi, '')}-${index}`
  return (
    <div className={styles.sitovLevelArt} aria-hidden="true">
      <span className={styles.sitovArtGlow} />
      <svg viewBox="0 0 240 142" fill="none" focusable="false">
        <defs>
          <linearGradient id={`${sitovGradient}-top`} x1="50" y1="38" x2="187" y2="108" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--sitov-level-tone)" stopOpacity=".48" />
            <stop offset="1" stopColor="var(--surface)" />
          </linearGradient>
          <linearGradient id={`${sitovGradient}-side`} x1="60" y1="54" x2="187" y2="130" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--sitov-level-tone)" stopOpacity=".12" />
            <stop offset="1" stopColor="var(--surface)" />
          </linearGradient>
        </defs>
        <g className={styles.sitovFloor} stroke="currentColor">
          <path d="m21 111 91-45 105 44-94 26Z" fill="currentColor" fillOpacity=".025" />
          <path d="m42 102 103 27M66 90l105 28M89 78l105 28M59 122l96-40M90 131l99-38" />
          <ellipse cx="119" cy="110" rx="98" ry="24" strokeDasharray="2 8" />
        </g>
        <ellipse className={styles.sitovLevelHalo} cx="124" cy="110" rx="74" ry="15" fill="currentColor" />
        <g className={styles.sitovStair} data-step="1">
          <path d="m48 83 31-17 32 17-32 17Z" fill={`url(#${sitovGradient}-top)`} />
          <path d="m48 83 31 17 32-17v20l-32 17-31-17Z" fill={`url(#${sitovGradient}-side)`} />
          <path d="m48 83 31-17 32 17v20l-32 17-31-17Zm0 0 31 17 32-17M79 100v20" stroke="currentColor" strokeWidth="1.2" />
          <path d="m62 84 17 9 17-9" className={styles.sitovStepLight} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className={styles.sitovStair} data-step="2">
          <path d="m92 63 31-17 32 17-32 17Z" fill={`url(#${sitovGradient}-top)`} />
          <path d="m92 63 31 17 32-17v31l-32 17-31-17Z" fill={`url(#${sitovGradient}-side)`} />
          <path d="m92 63 31-17 32 17v31l-32 17-31-17Zm0 0 31 17 32-17M123 80v31" stroke="currentColor" strokeWidth="1.2" />
          <path d="m106 64 17 9 17-9" className={styles.sitovStepLight} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className={styles.sitovStair} data-step="3">
          <path d="m137 42 31-17 32 17-32 17Z" fill={`url(#${sitovGradient}-top)`} />
          <path d="m137 42 31 17 32-17v42l-32 17-31-17Z" fill={`url(#${sitovGradient}-side)`} />
          <path d="m137 42 31-17 32 17v42l-32 17-31-17Zm0 0 31 17 32-17M168 59v42" stroke="currentColor" strokeWidth="1.2" />
          <path d="m151 43 17 9 17-9" className={styles.sitovStepLight} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className={styles.sitovBeacon}>
          <rect x="148" y="9" width="39" height="39" rx="12" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
          {locked ? <>
            <rect x="161" y="26" width="13" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
            <path d="M164 26v-4a3.5 3.5 0 0 1 7 0v4" stroke="currentColor" strokeWidth="1.8" />
          </> : <path d="M159 34 176 19m-12 0h12v12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
        </g>
        {!locked && <g className={styles.sitovLevelSpark} fill="currentColor">
          <circle cx="54" cy="50" r="2" /><circle cx="119" cy="21" r="1.6" /><circle cx="213" cy="65" r="1.8" />
          <path d="M45 42v8m-4-4h8M210 28v7m-3.5-3.5h7" stroke="currentColor" strokeWidth="1.2" />
        </g>}
      </svg>
    </div>
  )
}
