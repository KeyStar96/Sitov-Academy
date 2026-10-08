'use client'

import { Zap } from 'lucide-react'
import styles from './VerbTrainer.module.css'

/** The same familiar verb family, sized to the shared trainer graphic slot. */
export default function SitovVerbScene() {
  return <div className={styles.sitovOrbit} aria-hidden="true" lang="de" translate="no">
    <div className={styles.sitovOrbitRing} /><div className={styles.sitovOrbitRingInner} />
    <span className={styles.sitovOrbitCore}><Zap size={30} strokeWidth={1.8} /></span>
    <span className={styles.sitovWord} data-word="1">fahren</span>
    <span className={styles.sitovWord} data-word="2">fährt</span>
    <span className={styles.sitovWord} data-word="3">gefahren</span>
    <span className={styles.sitovOrbitSpark} /><span className={styles.sitovOrbitSpark} data-second="true" />
  </div>
}
