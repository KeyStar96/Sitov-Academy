import Link from 'next/link'
import type { CSSProperties } from 'react'
import { Activity, ChevronRight, Target } from 'lucide-react'
import AccuracyRing from '@/components/charts/AccuracyRing'
import { answeredOn, todaySummary, type LearningProgress } from '@/lib/learning-progress'
import { formatStudyTime, learningProgressCopy } from '@/lib/learning-progress-i18n'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import { SitovHomeRingAtmosphere, SitovHomeRim } from './SitovHomeGraphics'
import styles from './SitovHomeMotion.module.css'

/**
 * Startseite: der heutige Tag in Zahlen (beantwortet, richtig, Prozent), die
 * letzten sieben Tage als Mini-Balken und – falls fällig – der Weg zu den
 * Problemwörtern. Führt zu „Mein Fortschritt".
 */
export default function ProgressTeaser({ progress, lang, focus }: {
  progress: LearningProgress
  lang: string
  /** Fällige Problemwörter des empfohlenen Niveaus und der Weg dorthin. */
  focus: { href: string; due: number } | null
}) {
  const t = learningProgressCopy(lang)
  const today = todaySummary(progress.daily)!
  const week = progress.daily.slice(-7).map(day => ({ date: day.date, ...answeredOn(day) }))
  const maximum = Math.max(1, ...week.map(day => day.answers))
  const weekday = (date: string) => new Intl.DateTimeFormat(lang, { weekday: 'narrow', timeZone: 'Europe/Berlin' }).format(new Date(`${date}T12:00:00Z`))
  const number = (value: number) => new Intl.NumberFormat(lang).format(value)
  return <SitovMotionStage className={styles.sitovStage}><section className={styles.sitovTeaser} data-sitov-surface="" aria-labelledby="progress-teaser-title">
    <SitovHomeRim />
    <div className={styles.sitovContent}>
    <div className={styles.sitovTeaserHead}>
      <h2 id="progress-teaser-title">{t('teaser_title')}</h2>
      <span className={styles.sitovTeaserIcon} aria-hidden="true"><Activity size={21} /></span>
    </div>
    <div className={styles.sitovTodayStats}>
      <div className={styles.sitovRingFrame}>
      <SitovHomeRingAtmosphere />
      <AccuracyRing value={today.percent} label={today.percent === null ? t('accuracy_none') : t('accuracy_aria', { value: today.percent })} size={88} />
      </div>
      <dl className={styles.sitovStats}>
        <div className={styles.sitovStat}><dt>{t('answered')}</dt><dd>{number(today.answers)}</dd></div>
        <div className={styles.sitovStat}><dt>{t('correct')}</dt><dd className={styles.sitovCorrect}>{number(today.correct)}</dd></div>
        <div className={styles.sitovStudy}><dt className="sr-only">{t('study_time')}</dt><dd>{t('study_time')}: {formatStudyTime(today.seconds, t)}</dd></div>
      </dl>
    </div>
    {today.answers === 0 && <p className={styles.sitovEmpty}>{t('teaser_empty')}</p>}
    <ol className={styles.sitovWeekChart} aria-label={t('overview_title')}>
      {week.map((day, index) => <li key={day.date} data-today={day.date === progress.today} style={{ '--sitov-day': index } as CSSProperties}>
        <span className={styles.sitovBarWell} aria-hidden="true">
          <span className={styles.sitovBar} style={{ height: `${day.answers ? Math.max(8, day.answers / maximum * 100) : 0}%`, opacity: day.percent === null ? 0 : 0.45 + day.percent / 200 }} />
        </span>
        <span className={styles.sitovDayName} aria-hidden="true">{weekday(day.date)}</span>
        <span className="sr-only">{new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'Europe/Berlin' }).format(new Date(`${day.date}T12:00:00Z`))}: {t('answered')} {day.answers}, {day.percent === null ? t('accuracy_none') : t('accuracy_aria', { value: day.percent })}</span>
      </li>)}
    </ol>
    <div className={styles.sitovLinks}>
      <Link href={`/${lang}/dashboard/progress`} className="st-link-pill st-press">{t('progress_link')}<ChevronRight size={18} aria-hidden="true" /></Link>
      {focus && focus.due > 0 && <Link href={focus.href} className="st-link-pill st-press"><Target size={18} aria-hidden="true" />{t('focus_cta')} ({number(focus.due)})</Link>}
    </div>
    </div>
  </section></SitovMotionStage>
}
