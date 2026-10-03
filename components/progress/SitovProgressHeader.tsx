'use client'

import { Activity } from 'lucide-react'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import { learningProgressCopy } from '@/lib/learning-progress-i18n'
import { SitovProgressBeacon } from './SitovProgressGraphics'
import styles from './SitovProgressMotion.module.css'

export default function SitovProgressHeader({ lang }: { lang: string }) {
  const sitovCopy = learningProgressCopy(lang)
  return <SitovMotionStage className={styles.sitovHeaderStage}>
    <header className={styles.sitovPageHeader} data-sitov-surface="">
      <div className={styles.sitovHeaderAtmosphere} aria-hidden="true"><span /><i /></div>
      <div className={styles.sitovHeading}>
        <span className={styles.sitovHeaderMark} aria-hidden="true"><Activity size={22} /><i /><i /><i /></span>
        <h1 className={`st-path-hero__title ${styles.sitovPageTitle}`}>{sitovCopy('student_title')}</h1>
      </div>
      <SitovProgressBeacon />
      <p className={styles.sitovPageIntro}>{sitovCopy('student_intro')}</p>
    </header>
  </SitovMotionStage>
}
