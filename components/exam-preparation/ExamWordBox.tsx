import PressableCard from '@/components/motion/PressableCard'
import styles from './ExamTrainer.module.css'

/** German-only exam view; the existing learning box owns words and translations. */
export default function ExamWordBox({words,lang,level}: {words:{word:string;example:string}[];lang:string;level:string|null}) {
  return <details className={styles.details}><summary>Meine Wörter und Wendungen</summary>
    <p className={`${styles.muted} mb-3`}>Übe diese Wörter mit einem eigenen Beispielsatz. Du kannst sie in deiner vorhandenen Lernbox speichern.</p>
    {words.map(w=><div key={w.word} className={`${styles.card} mb-2`}><strong>{w.word}</strong><p>{w.example}</p>{level&&lang!=='de'&&<PressableCard className={styles.link} href={`/${lang}/dashboard/level/${encodeURIComponent(level)}/vocabulary/lessons?sitovWord=${encodeURIComponent(w.word)}&sitovExample=${encodeURIComponent(w.example)}`}>Zur Lernbox · Wort übernehmen</PressableCard>}</div>)}
    {lang==='de'&&<p className={styles.muted}>Die Lernbox verwendet die Erstsprache aus deinem Profil. Die Prüfungsvorbereitung bleibt auf Deutsch.</p>}
  </details>
}
