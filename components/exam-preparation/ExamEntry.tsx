import { ArrowRight, BookOpen, ClipboardCheck } from 'lucide-react'
import PressableCard from '@/components/motion/PressableCard'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import SitovExamEntryGraphics from './SitovExamEntryGraphics'
import styles from './ExamEntry.module.css'

export default function ExamEntry({ lang, reference = false }: { lang: string; reference?: boolean }) {
  const sitovLevel = reference ? '?level=B1' : ''
  return <section className={styles.root} aria-label="Prüfungen" lang="de" translate="no">
    <SitovMotionStage className={styles.sitovStage}>
    <PressableCard href={`/${lang}/dashboard/exam-simulation${sitovLevel}`} className={styles.card} data-sitov-surface="" data-sitov-exam-entry="">
      <span className={styles.sitovSpotlight} aria-hidden="true" />
      <span className={styles.sitovEdge} aria-hidden="true" />
      <div className={styles.content}>
        <span className={styles.eyebrow}><ClipboardCheck size={19} aria-hidden="true" /> Simulierte Prüfung</span>
        <h2>{reference ? 'Bist du bereit für deine B1-Prüfung?' : 'Wie gut bist du auf deine Prüfung vorbereitet?'}</h2>
        <p>Niveau wählen. Lesen, Hören, Schreiben und Sprechen bearbeiten. Stärken und Fehler verstehen.</p>
        <span className={styles.action}>Prüfung simulieren <span className={styles.sitovActionArrow}><ArrowRight size={20} aria-hidden="true" /></span></span>
      </div>
      <SitovExamEntryGraphics />
    </PressableCard>
    </SitovMotionStage>
    <PressableCard href={`/${lang}/dashboard/exam-preparation${sitovLevel}`} className={`${styles.card} ${styles.practice}`}>
      <div className={styles.content}>
        <span className={styles.eyebrow}><BookOpen size={19} aria-hidden="true" /> Prüfungsvorbereitung</span>
        <h2>Schritt für Schritt üben</h2>
        <p>Einzelne Bereiche trainieren und Rückmeldung erhalten.</p>
        <span className={styles.action}>Vorbereitung öffnen <ArrowRight size={20} aria-hidden="true" /></span>
      </div>
    </PressableCard>
  </section>
}
