import PressableCard from '@/components/motion/PressableCard'
import { getExamPrepUi } from '@/lib/exam-preparation/ui-copy'
import styles from './ExamTrainer.module.css'

/** German words stay authored content; navigation follows the interface language. */
export default function ExamWordBox({words,lang,level}: {words:{word:string;example:string}[];lang:string;level:string|null}) {
  const { t } = getExamPrepUi(lang)
  return <details className={styles.details}><summary>{t("Meine Wörter und Wendungen")}</summary>
    <p className={`${styles.muted} mb-3`}>{t("Übe diese Wörter mit einem eigenen Beispielsatz. Du kannst sie in deiner vorhandenen Lernbox speichern.")}</p>
    {words.map(w=><div key={w.word} className={`${styles.card} mb-2`}><strong lang="de" translate="no">{w.word}</strong><p lang="de" translate="no">{w.example}</p>{level&&lang!=='de'&&<PressableCard className={styles.link} href={`/${lang}/dashboard/level/${encodeURIComponent(level)}/vocabulary/lessons?sitovWord=${encodeURIComponent(w.word)}&sitovExample=${encodeURIComponent(w.example)}`}>{t("Zur Lernbox · Wort übernehmen")}</PressableCard>}</div>)}
    {lang==='de'&&<p className={styles.muted}>{t("Die Lernbox verwendet die Erstsprache aus deinem Profil.")}</p>}
  </details>
}
