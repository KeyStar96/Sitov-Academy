'use client'

import { useId, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowUpRight, BookOpen, Check, CircleCheck, LockKeyhole, Route, Sparkles, Workflow } from 'lucide-react'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { sitovPronunciationProgress, type SitovPronunciationGoal } from '@/lib/sitov-pronunciation-progress'
import type { SitovPronunciationReadiness } from '@/lib/sitov-pronunciation-readiness'
import { sitovReadinessCopy, sitovReadinessFill as fill } from '@/lib/sitov-pronunciation-readiness-i18n'
import styles from './SitovPronunciationReadiness.module.css'

export { sitovReadinessCopy } from '@/lib/sitov-pronunciation-readiness-i18n'

function SitovGoalCount({ label, goal, lang }: { label: string; goal: SitovPronunciationGoal; lang: string }) {
  const copy = sitovReadinessCopy(lang)
  return <div className={styles.goalCount} data-met={goal.met}>
    <span>{label}</span><strong>{goal.current} / {goal.required}</strong>
    <small>{goal.met ? <><Check size={12} aria-hidden="true" />{copy.goalDone}</> : fill(copy.remaining, { count: goal.remaining })}</small>
  </div>
}

function SitovGoalTrack({ name, fraction }: { name: string; fraction: number }) {
  return <div role="progressbar" aria-label={name} aria-valuenow={Math.round(fraction * 100)} aria-valuemin={0} aria-valuemax={100} className={styles.track}>
    <span style={{ transform: `scaleX(${fraction})` }} />
  </div>
}

export default function SitovPronunciationReadinessCard({ readiness, lang, level, onRetry }: {
  readiness: SitovPronunciationReadiness | null; lang: string; level: string; onRetry: () => void
}) {
  const copy = sitovReadinessCopy(lang)
  const s = studentTranslator(lang)
  const titleId = useId()
  const detailsId = useId()
  const [selectedTier, setSelectedTier] = useState<number | null>(null)
  if (!readiness) return <section className={styles.card} role="status" data-sitov-pronunciation-readiness><LockKeyhole size={24} aria-hidden="true" /><h3>{copy.unavailable}</h3><p>{copy.unavailableHint}</p><button className="st-button st-button--quiet" onClick={onRetry}>{copy.retry}</button></section>
  if (readiness.mode === 'hard') return <section className={`${styles.card} ${styles.hard}`} data-sitov-pronunciation-readiness><Sparkles size={24} aria-hidden="true" /><div><h3>{copy.hard}</h3><p>{copy.hardHint}</p></div></section>
  const nextTier = Math.min(3, readiness.tier + 1)
  const progress = sitovPronunciationProgress(readiness, selectedTier ?? nextTier)
  if (!progress) return null
  const { requirement, words, verbs } = progress
  const base = `/${lang}/dashboard/level/${encodeURIComponent(level)}`
  const names = [copy.short, copy.medium, copy.long]
  const readyCount = readiness.texts.filter(row => row.ready).length
  const showHistoricalGrammar = readiness.stats.legacyGrammarExercises > 0 || readiness.stats.legacyGrammarTopics > 0
  const items = [
    { icon: BookOpen, title: copy.words, goal: words, fraction: words.fraction, hint: copy.wordHint, remaining: copy.remainingWords, href: `${base}/vocabulary`, link: s('area_vocabulary') },
    { icon: Route, title: copy.grammar, goal: null, fraction: progress.grammarFraction, hint: showHistoricalGrammar ? copy.grammarHint : copy.pathHint, remaining: '', href: `${base}/path`, link: s('area_path') },
    ...(verbs ? [{ icon: Workflow, title: copy.verbs, goal: verbs, fraction: verbs.fraction, hint: copy.verbHint, remaining: copy.remainingVerbs, href: `${base}/verbs`, link: s('area_verbs') }] : []),
  ]
  return <SitovMotionStage className={styles.stage} data-sitov-pronunciation-readiness>
    <section className={styles.card} aria-labelledby={titleId} data-sitov-surface>
      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>{readiness.tier === 3 ? copy.complete : fill(copy.stage, { tier: nextTier })}</span>
          <h3 id={titleId}>{copy.title}</h3><p>{copy.hint}</p>
          <span className={styles.ready} data-empty={readyCount === 0}>{readyCount ? <CircleCheck size={16} aria-hidden="true" /> : <LockKeyhole size={16} aria-hidden="true" />}{fill(copy.ready, { count: readyCount })}</span>
        </div>
        <div className={styles.gauge} role="progressbar" aria-label={`${copy.progress} · ${fill(copy.step, { tier: requirement.tier })}`} aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${progress.percent} % · ${fill(copy.goals, { done: progress.completed, total: progress.total })}`}>
          <svg viewBox="0 0 180 180" aria-hidden="true"><circle className={styles.gaugeTrack} cx="90" cy="90" r="73" /><circle className={styles.gaugeFill} cx="90" cy="90" r="73" pathLength="100" strokeDasharray={`${progress.percent} 100`} data-complete={progress.percent === 100} /></svg>
          <div className={styles.gaugeValue} aria-hidden="true"><strong>{progress.percent}<span>%</span></strong><span>{fill(copy.step, { tier: requirement.tier })}</span><div className={styles.sound} aria-hidden="true">{[.35, .65, .85, 1, .7, .5, .3].map((height, index) => <i key={index} style={{ '--sitov-sound-height': height, '--sitov-sound-delay': `${index * -.18}s` } as CSSProperties} />)}</div></div>
          <span className={styles.gaugeNode} data-met={words.met} data-position="words" aria-hidden="true">{words.met ? <Check size={16} /> : <BookOpen size={16} />}</span>
          <span className={styles.gaugeNode} data-met={progress.grammarMet} data-position="grammar" aria-hidden="true">{progress.grammarMet ? <Check size={16} /> : <Route size={16} />}</span>
          {verbs && <span className={styles.gaugeNode} data-met={verbs.met} data-position="verbs" aria-hidden="true">{verbs.met ? <Check size={16} /> : <Workflow size={16} />}</span>}
        </div>
      </div>
      <div className={styles.roadmap} role="group" aria-label={copy.roadmap}>
        {readiness.requirements.map(row => <button key={row.tier} type="button" onClick={() => setSelectedTier(row.tier)} aria-pressed={requirement.tier === row.tier} aria-controls={detailsId} data-complete={readiness.tier >= row.tier}>
          <span className={styles.stepNumber} aria-hidden="true">{readiness.tier >= row.tier ? <Check size={17} /> : row.tier}</span>
          <span><strong>{names[row.tier - 1]}</strong><small>{readiness.tier >= row.tier ? copy.achieved : row.tier === nextTier ? copy.upcoming : copy.later}</small></span>
        </button>)}
      </div>
      <div id={detailsId} className={styles.details}>
        <div className={styles.detailsHead}><h4>{requirement.tier === nextTier ? readiness.tier === 0 ? copy.first : readiness.tier === 3 ? copy.complete : copy.next : fill(copy.selectedStage, { tier: requirement.tier })}</h4><span>{fill(copy.goals, { done: progress.completed, total: progress.total })}</span></div>
        <div className={styles.milestones} data-columns={items.length}>{items.map(item => <div key={item.title} className={styles.milestone} data-ready={item.fraction >= 1}>
          <div className={styles.milestoneHeading}><span className={styles.goalIcon}><item.icon size={19} aria-hidden="true" /></span><strong>{item.title}</strong>{item.fraction >= 1 && <CircleCheck size={18} aria-label={copy.goalDone} />}</div>
          {item.goal ? <><div className={styles.number}>{item.goal.current}<span>/ {item.goal.required}</span></div><strong className={styles.remaining}>{item.goal.met ? copy.goalDone : fill(item.remaining, { count: item.goal.remaining })}</strong></> : <><strong className={styles.remaining}>{progress.grammarMet ? copy.goalDone : copy.path}</strong><SitovGoalCount label={copy.nodes} goal={progress.nodes} lang={lang} />{requirement.passedTests > 0 && <SitovGoalCount label={copy.tests} goal={progress.tests} lang={lang} />}{showHistoricalGrammar && <div className={styles.alternative}><strong>{copy.alternative}</strong><SitovGoalCount label={copy.exercises} goal={progress.exercises} lang={lang} /><SitovGoalCount label={copy.topics} goal={progress.topics} lang={lang} /></div>}</>}
          <SitovGoalTrack name={item.title} fraction={item.fraction} /><p>{item.hint}</p><Link href={item.href}>{item.link}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>)}</div>
      </div>
      <p className={styles.coverage}><BookOpen size={17} aria-hidden="true" /><span>{copy.coverage}<small>{copy.progressHint}</small></span></p>
      {readiness.tier === 3 && <p className={styles.allReady}>{copy.allReady}</p>}
    </section>
  </SitovMotionStage>
}

export function SitovLockedReadings({ readiness, lang }: { readiness: SitovPronunciationReadiness; lang: string }) {
  const copy = sitovReadinessCopy(lang)
  const rows = readiness.texts.filter(row => !row.ready)
  if (!rows.length) return null
  const base = `/${lang}/dashboard/level/${encodeURIComponent(readiness.level)}`
  return <ul className={styles.lockedReadings} aria-label={copy.locked}>{rows.map(row => {
    const tierMet = readiness.mode === 'hard' || readiness.tier >= row.tier
    const coverageMet = readiness.mode === 'hard' || row.coveragePercent >= row.requiredCoveragePercent
    return <li key={row.id}>
      <LockKeyhole size={19} aria-hidden="true" /><div className={styles.lockedBody}>
        <h3 lang="de" translate="no">{row.title}</h3>
        <p className={styles.textGate} data-met={tierMet}>{tierMet && <Check size={13} aria-hidden="true" />}{fill(tierMet ? copy.tierDone : copy.textTier, { tier: row.tier })}</p>
        {readiness.mode !== 'hard' && <><p>{fill(copy.textCoverage, { known: row.coveragePercent, needed: row.requiredCoveragePercent })}</p><SitovGoalTrack name={`${row.title} · ${copy.words}`} fraction={row.requiredCoveragePercent > 0 ? Math.min(1, row.coveragePercent / row.requiredCoveragePercent) : 1} /><p className={styles.textGate} data-met={coverageMet}>{coverageMet ? <><Check size={13} aria-hidden="true" />{copy.coverageDone}</> : fill(copy.coverageRemaining, { count: row.requiredCoveragePercent - row.coveragePercent })}</p></>}
        {tierMet && coverageMet ? <p>{copy.pending}</p> : !coverageMet && <Link href={`${base}/vocabulary`}>{copy.practiceWords}<ArrowUpRight size={14} aria-hidden="true" /></Link>}
      </div>
    </li>
  })}</ul>
}
