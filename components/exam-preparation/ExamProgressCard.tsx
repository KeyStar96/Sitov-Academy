import { ArrowUpRight } from 'lucide-react'
import PressableCard from '@/components/motion/PressableCard'
import { EXAM_SKILL_LABELS } from '@/lib/exam-preparation/profiles'
import { getExamProgress, isExamTaskCompleted, isExamTaskIndependent } from '@/lib/exam-preparation/progression'
import type { ExamModule, ExamState } from '@/lib/exam-preparation/types'
import styles from './ExamTrainer.module.css'

export default function ExamProgressCard({lang,state,modules,workshops=[]}: {lang:string;state:ExamState;modules:ExamModule[];workshops?:ExamModule[]}) {
  const progress=getExamProgress(state,modules,workshops)
  const tasks=[...modules,...workshops].flatMap(m=>m.units).filter(u=>u.releaseStatus==='published').flatMap(u=>u.tasks)
  const formats=[{label:'Bildbeschreibung',families:['bildbeschreibung']},{label:'Kurzpräsentation',families:['kurzpraesentation','rueckfragen','rueckmeldung']},{label:'Interaktion und Planung',families:['planung','themengespraech','gefuehrter_dialog']}]
  const publishedUnits=[...modules,...workshops].flatMap(m=>m.units).filter(u=>u.releaseStatus==='published').length
  return <section className={styles.panel} aria-labelledby="sitov-exam-progress-heading">
    <div className={styles.row}><h2 id="sitov-exam-progress-heading">B1-Prüfungsvorbereitung</h2><span className={styles.badge}>Globales B1-Training · Pilot</span></div>
    <p className={`${styles.muted} mb-4`}>Gesamtstand über alle Lerntage · {Math.round(progress.seconds/60)} Minuten dokumentierte Lernzeit. Bearbeitung und selbstständige Leistung sind getrennte Werte.</p>
    {!state.available&&<p className={styles.warning} role="status">{state.error??'Der Prüfungsfortschritt konnte noch nicht geladen werden.'}</p>}
    <div className={styles.stats}>
      <div className={styles.stat}><strong>{progress.completedUnits}/{publishedUnits}</strong><span>Verfügbare Einheiten bearbeitet</span></div>
      <div className={styles.stat}><strong>{progress.completedTasks}</strong><span>Aufgaben mit Rückmeldung</span></div>
      <div className={styles.stat}><strong>{progress.independentTasks}</strong><span>Neue Aufgaben selbstständig geschafft</span></div>
      <div className={styles.stat}><strong>{progress.pendingFeedback}</strong><span>Rückmeldungen ausstehend</span></div>
    </div>
    <div className={`${styles.grid} mt-4`}>{progress.skills.map(s=><div className={styles.skill} key={s.skill}>
      <div className={styles.row}><strong>{EXAM_SKILL_LABELS[s.skill]}</strong><span>{s.completed}/{s.total} bearbeitet</span></div>
      <div className={styles.meter} role="progressbar" aria-label={`${EXAM_SKILL_LABELS[s.skill]}: Bearbeitung`} aria-valuemin={0} aria-valuemax={Math.max(1,s.total)} aria-valuenow={s.completed}><span style={{width:`${s.total?s.completed/s.total*100:0}%`}}/></div>
      <p className={styles.muted}>{s.independent} selbstständig · Hilfen und Rückmeldungen bleiben sichtbar.</p>
    </div>)}</div>
    <details className={`${styles.details} mt-4`}><summary>Bildbeschreibung, Präsentation und Interaktion</summary><div className={styles.grid}>{formats.map(f=>{
      const own=tasks.filter(t=>f.families.includes(t.formatFamily))
      return <div className={styles.stat} key={f.label}><strong>{own.filter(t=>isExamTaskCompleted(t,state)).length}/{own.length}</strong><span>{f.label} · {own.filter(t=>isExamTaskIndependent(t,state)).length} selbstständig</span></div>
    })}</div></details>
    <details className={`${styles.details} mt-3`}><summary>Lernchecks und nächste Schritte</summary><div className={styles.grid}>{progress.modules.map(m=>{
      const courseModule=modules.find(item=>item.id===m.moduleId)
      return <div className={styles.card} key={m.moduleId}><strong>{courseModule?.title}</strong><span>{courseModule?.releaseStatus==='draft'?'In Vorbereitung':`${m.completedUnits}/${m.totalUnits} Einheiten bearbeitet`}</span>
        {m.checkpointPercent!==null&&<span>Neuer Lerncheck: {Math.round(m.checkpointPercent)} %</span>}
        <span>{m.independent?'Selbstständig geschafft':m.repeatNeeded?'Wiederholen':m.unlocksNext?'Nächster Schritt offen':'Weiter üben'}</span>
        {m.missingEvidence.length>0&&courseModule?.releaseStatus!=='draft'&&<span>Noch nötig: {m.missingEvidence.map(e=>e==='checkpoint'?'Lerncheck':EXAM_SKILL_LABELS[e as keyof typeof EXAM_SKILL_LABELS]??e).join(', ')}</span>}
      </div>
    })}</div></details>
    <p className={`${styles.muted} mt-4`}>Der Lernweg misst deine Bearbeitung. Er zeigt keine Bestehenswahrscheinlichkeit. Eine selbstständige offene Leistung braucht eine verlässliche Rückmeldung.</p>
    <PressableCard className={styles.link} href={`/${lang}/dashboard/exam-preparation?level=B1&area=progress`}>Zum Prüfungstrainer<ArrowUpRight size={18}/></PressableCard>
  </section>
}
