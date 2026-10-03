import { ArrowUpRight } from 'lucide-react'
import PressableCard from '@/components/motion/PressableCard'
import ExamGraphics from './ExamGraphics'
import styles from './ExamTrainer.module.css'

export default function ExamEntry({ lang, reference = false }: { lang: string; reference?: boolean }) {
  return <section className={styles.entry} aria-label="Prüfungsvorbereitung">
    <div><span className={styles.eyebrow}>Prüfungsvorbereitung</span><h2>{reference ? 'Fühlst du dich bereit für die B1-Prüfung?' : 'Dein Weg zur B1-Prüfung'}</h2>
      <p>{reference ? 'Übe hier für die gesamte B1-Prüfung.' : 'Hören, Lesen, Schreiben und Sprechen. Gemeinsam lernen, gezielt üben.'}</p>
      <PressableCard href={`/${lang}/dashboard/exam-preparation${reference ? '?level=B1' : ''}`} className={styles.link}>{reference ? 'Teste es hier' : 'Prüfungsniveau wählen'}<ArrowUpRight size={20} aria-hidden="true" /></PressableCard>
    </div><ExamGraphics />
  </section>
}
