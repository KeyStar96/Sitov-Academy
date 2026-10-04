import { ArrowUpRight } from 'lucide-react'
import PressableCard from '@/components/motion/PressableCard'
import { getExamPrepUi, examPrepError } from '@/lib/exam-preparation/ui-copy'
import { getExamProgress, isExamTaskCompleted, isExamTaskIndependent } from '@/lib/exam-preparation/progression'
import type { ExamModule, ExamState } from '@/lib/exam-preparation/types'
import styles from './ExamTrainer.module.css'

export default function ExamProgressCard({lang,state,modules,workshops=[]}: {lang:string;state:ExamState;modules:ExamModule[];workshops?:ExamModule[]}) {
  const { t, skillLabels } = getExamPrepUi(lang)
  const progress=getExamProgress(state,modules,workshops)
  const tasks=[...modules,...workshops].flatMap(m=>m.units).filter(u=>u.releaseStatus==='published').flatMap(u=>u.tasks)
  const formats=[{label:t('Bildbeschreibung'),families:['bildbeschreibung']},{label:t('Kurzpräsentation'),families:['kurzpraesentation','rueckfragen','rueckmeldung']},{label:t('Interaktion und Planung'),families:['planung','themengespraech','gefuehrter_dialog']}]
  const publishedUnits=[...modules,...workshops].flatMap(m=>m.units).filter(u=>u.releaseStatus==='published').length
  return <section className={styles.panel} aria-labelledby="sitov-exam-progress-heading">
    <div className={styles.row}><h2 id="sitov-exam-progress-heading">{t("B1-Prüfungsvorbereitung")}</h2><span className={styles.badge}>{t("Globales B1-Training · Pilot")}</span></div>
    <p className={`${styles.muted} mb-4`}>{t('Gesamtstand über alle Lerntage · {minutes} Minuten dokumentierte Lernzeit. Bearbeitung und selbstständige Leistung sind getrennte Werte.', {minutes:Math.round(progress.seconds/60)})}</p>
    {!state.available&&<p className={styles.warning} role="status">{examPrepError(lang,state.error,'Der Prüfungsfortschritt konnte noch nicht geladen werden.')}</p>}
    <div className={styles.stats}>
      <div className={styles.stat}><strong>{progress.completedUnits}/{publishedUnits}</strong><span>{t("Verfügbare Einheiten bearbeitet")}</span></div>
      <div className={styles.stat}><strong>{progress.completedTasks}</strong><span>{t("Aufgaben mit Rückmeldung")}</span></div>
      <div className={styles.stat}><strong>{progress.independentTasks}</strong><span>{t("Neue Aufgaben selbstständig geschafft")}</span></div>
      <div className={styles.stat}><strong>{progress.pendingFeedback}</strong><span>{t("Rückmeldungen ausstehend")}</span></div>
    </div>
    <div className={`${styles.grid} mt-4`}>{progress.skills.map(s=><div className={styles.skill} key={s.skill}>
      <div className={styles.row}><strong>{skillLabels[s.skill]}</strong><span>{t('{completed}/{total} bearbeitet', {completed:s.completed,total:s.total})}</span></div>
      <div className={styles.meter} role="progressbar" aria-label={t('{skill}: Bearbeitung', {skill:skillLabels[s.skill]})} aria-valuemin={0} aria-valuemax={Math.max(1,s.total)} aria-valuenow={s.completed}><span style={{width:`${s.total?s.completed/s.total*100:0}%`}}/></div>
      <p className={styles.muted}>{t('{count} selbstständig · Hilfen und Rückmeldungen bleiben sichtbar.', {count:s.independent})}</p>
    </div>)}</div>
    <details className={`${styles.details} mt-4`}><summary>{t("Bildbeschreibung, Präsentation und Interaktion")}</summary><div className={styles.grid}>{formats.map(f=>{
      const own=tasks.filter(t=>f.families.includes(t.formatFamily))
      return <div className={styles.stat} key={f.label}><strong>{own.filter(t=>isExamTaskCompleted(t,state)).length}/{own.length}</strong><span>{t('{format} · {count} selbstständig', {format:f.label,count:own.filter(t=>isExamTaskIndependent(t,state)).length})}</span></div>
    })}</div></details>
    <details className={`${styles.details} mt-3`}><summary>{t("Lernchecks und nächste Schritte")}</summary><div className={styles.grid}>{progress.modules.map(m=>{
      const courseModule=modules.find(item=>item.id===m.moduleId)
      return <div className={styles.card} key={m.moduleId}><strong>{t(courseModule?.title??'')}</strong><span>{courseModule?.releaseStatus==='draft'?t('In Vorbereitung'):t('{completed}/{total} Einheiten bearbeitet', {completed:m.completedUnits,total:m.totalUnits})}</span>
        {m.checkpointPercent!==null&&<span>{t('Neuer Lerncheck: {percent} %', {percent:Math.round(m.checkpointPercent)})}</span>}
        <span>{m.independent?t('Selbstständig geschafft'):m.repeatNeeded?t('Wiederholen'):m.unlocksNext?t('Nächster Schritt offen'):t('Weiter üben')}</span>
        {m.missingEvidence.length>0&&courseModule?.releaseStatus!=='draft'&&<span>{t('Noch nötig: {items}', {items:m.missingEvidence.map(e=>e==='checkpoint'?t('Lerncheck'):skillLabels[e as keyof typeof skillLabels]??e).join(', ')})}</span>}
      </div>
    })}</div></details>
    <p className={`${styles.muted} mt-4`}>{t("Der Lernweg misst deine Bearbeitung. Er zeigt keine Bestehenswahrscheinlichkeit. Eine selbstständige offene Leistung braucht eine verlässliche Rückmeldung.")}</p>
    <PressableCard className={styles.link} href={`/${lang}/dashboard/exam-preparation?level=B1&area=progress`}>{t("Zum Prüfungstrainer")}<ArrowUpRight size={18}/></PressableCard>
  </section>
}
