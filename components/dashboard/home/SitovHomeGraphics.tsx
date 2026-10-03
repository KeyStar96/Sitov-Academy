import { BookOpen, Sparkles } from 'lucide-react'
import styles from './SitovHomeMotion.module.css'

/** Decorative learning objects: no data, targets or characters. */
export function SitovHomeJourney() {
  return <div className={styles.sitovJourney} aria-hidden="true">
    <span className={styles.sitovJourneyGrid} />
    <span className={styles.sitovJourneyOrbit} />
    <span className={styles.sitovJourneyOrbitInner} />
    <span className={styles.sitovJourneyGlow} />
    <div className={styles.sitovJourneyBook}>
      <svg viewBox="0 0 180 130" fill="none" focusable="false">
        <path d="M20 44 87 61 156 39 160 90 90 116 21 96Z" fill="var(--surface)" stroke="currentColor" strokeWidth="2" />
        <path d="m90 116-3-55M20 51l67 18 69-23M21 58l67 18 69-23" stroke="currentColor" strokeWidth="1.5" opacity=".4" />
        <path d="M21 27c23-1 46 6 65 24 17-22 43-29 67-29l3 56c-28-1-50 9-68 23C70 88 47 81 23 83Z" fill="var(--surface)" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="m86 51 2 50" stroke="currentColor" strokeWidth="2" />
        <path d="m37 47 31 9m-30 2 30 9m-29 2 21 6m45-17 31-10m-30 20 31-10m-30 20 22-7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".45" />
        <path d="m84 46 5-18 8 12 7-25" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
    <span className={`${styles.sitovJourneyChip} ${styles.sitovJourneyChipA}`}>Aa<span /></span>
    <span className={`${styles.sitovJourneyChip} ${styles.sitovJourneyChipB}`}><BookOpen size={20} /></span>
    <span className={`${styles.sitovJourneyChip} ${styles.sitovJourneyChipC}`}><Sparkles size={19} /></span>
    <span className={`${styles.sitovJourneyParticle} ${styles.sitovParticleA}`} />
    <span className={`${styles.sitovJourneyParticle} ${styles.sitovParticleB}`} />
    <span className={`${styles.sitovJourneyParticle} ${styles.sitovParticleC}`} />
  </div>
}

export function SitovHomeRingAtmosphere() {
  return <span className={styles.sitovRingAtmosphere} aria-hidden="true">
    <span className={styles.sitovRingTicks} />
    <span className={styles.sitovRingOrbit}><span /></span>
    <span className={styles.sitovRingOrbitSecond}><span /></span>
  </span>
}

export function SitovHomeRim() {
  return <span className={styles.sitovRim} aria-hidden="true"><span /></span>
}
