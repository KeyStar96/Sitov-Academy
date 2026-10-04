import { ArrowRight, BookOpen, ClipboardCheck } from 'lucide-react'
import PressableCard from '@/components/motion/PressableCard'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import { getSitovExamEntryCopy } from '@/lib/exam-entry-i18n'
import { toUiLocale } from '@/lib/locale-routing'
import SitovExamEntryGraphics from './SitovExamEntryGraphics'
import styles from './ExamEntry.module.css'

export default function ExamEntry({ lang, reference = false }: { lang: string; reference?: boolean }) {
  const sitovLevel = reference ? '?level=B1' : ''
  const copy = getSitovExamEntryCopy(lang)
  return <section className={styles.root} aria-label={copy.region} lang={toUiLocale(lang)} translate="no">
    <SitovMotionStage className={styles.sitovStage}>
    <PressableCard href={`/${lang}/dashboard/exam-simulation${sitovLevel}`} className={styles.card} data-sitov-surface="" data-sitov-exam-entry="">
      <span className={styles.sitovSpotlight} aria-hidden="true" />
      <span className={styles.sitovEdge} aria-hidden="true" />
      <div className={styles.content}>
        <span className={styles.eyebrow}><ClipboardCheck size={19} aria-hidden="true" /> {copy.simulation}</span>
        <h2>{reference ? copy.referenceTitle : copy.title}</h2>
        <p>{copy.description}</p>
        <span className={styles.action}>{copy.action} <span className={styles.sitovActionArrow}><ArrowRight size={20} aria-hidden="true" /></span></span>
      </div>
      <SitovExamEntryGraphics copy={copy} />
    </PressableCard>
    </SitovMotionStage>
    <PressableCard href={`/${lang}/dashboard/exam-preparation${sitovLevel}`} className={`${styles.card} ${styles.practice}`}>
      <div className={styles.content}>
        <span className={styles.eyebrow}><BookOpen size={19} aria-hidden="true" /> {copy.preparation}</span>
        <h2>{copy.preparationTitle}</h2>
        <p>{copy.preparationDescription}</p>
        <span className={styles.action}>{copy.preparationAction} <ArrowRight size={20} aria-hidden="true" /></span>
      </div>
    </PressableCard>
  </section>
}
