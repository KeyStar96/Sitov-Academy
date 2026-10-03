'use client'

import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Activity, ArrowUpRight, BookOpenText, ChevronDown, FileText, Film, Globe, Mic, Route, Sparkles, Waypoints, type LucideIcon } from 'lucide-react'
import TrendChart, { ChartLegend, type ChartPoint, type ChartSeries } from '@/components/charts/TrendChart'
import AccuracyRing from '@/components/charts/AccuracyRing'
import PhaseDistributionChart from '@/components/vocabulary/PhaseDistributionChart'
import { adminChip } from '@/components/admin/ui'
import {
  accuracyLine, answeredOn, learnedCurve, percent, rangeTotals, todaySummary, PROGRESS_MODES,
  studySeconds, type LearningProgress, type ProgressDay, type ProgressFocusWord, type ProgressMode,
} from '@/lib/learning-progress'
import { formatStudyTime, learningProgressCopy, type LearningProgressTranslator } from '@/lib/learning-progress-i18n'
import { getSitovVerbCopy } from '@/lib/verbs/i18n'
import type { VocabularyTranslations } from '@/lib/vocabulary-i18n'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import { SitovProgressHalo, SitovProgressScene } from './SitovProgressGraphics'
import styles from './SitovProgressMotion.module.css'

/**
 * Lernanalyse je Lernmodus (Phase 11.3) – eine Ansicht für zwei Oberflächen:
 * die sachliche Lernanalyse der Lehrkraft (`admin`) und „Mein Fortschritt"
 * der Lernenden (`student`, größere Schrift, weichere Karten). Aufbau von
 * oben nach unten: Heute (mit Prozent), Verlauf beantwortet vs. richtig,
 * dann je Lernmodus eigene Kennzahlen und Diagramme als Reiter.
 */
export type ProgressSkin = 'admin' | 'student'

const SKINS = {
  admin: {
    stack: 'space-y-4 sm:space-y-5',
    card: 'min-w-0 rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4 sm:p-5',
    tile: 'min-w-0 rounded-lg border border-[var(--admin-line)] bg-[var(--surface)] p-3',
    title: 'text-sm font-semibold text-[var(--foreground)]',
    hint: 'text-sm leading-relaxed text-[var(--muted)]',
    label: 'text-[0.8125rem] font-medium text-[var(--muted)]',
    value: 'text-2xl font-semibold leading-none tabular-nums',
    small: 'text-xs',
    tab: (active: boolean, extra = '') => adminChip(active, extra),
    table: 'text-sm',
  },
  student: {
    stack: 'space-y-5',
    card: `${styles.sitovCard} min-w-0 rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5`,
    tile: `${styles.sitovTile} min-w-0 rounded-2xl bg-[var(--surface-muted)] p-3`,
    title: 'text-lg font-bold text-[var(--foreground)]',
    hint: 'text-base leading-relaxed text-[var(--muted)]',
    label: 'text-sm font-semibold text-[var(--muted)]',
    value: 'text-2xl font-bold leading-none tabular-nums',
    small: 'text-sm',
    tab: (active: boolean, extra = '') => `${styles.sitovTab} ${extra} st-press inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border px-4 text-base font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${active ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--foreground)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]'}`,
    table: 'text-base',
  },
} as const
type Skin = typeof SKINS[ProgressSkin]

const MODE_ICONS: Record<ProgressMode, LucideIcon> = { vocabulary: BookOpenText, verbs: Waypoints, path: Route, pronunciation: Mic, media: Film }
const MODE_COLOR: Record<ProgressMode, string> = {
  vocabulary: 'var(--mode-vocabulary-text)', verbs: 'var(--mode-verbs-text)', path: 'var(--mode-path-text)',
  pronunciation: 'var(--mode-pronunciation-text)', media: 'var(--mode-media-text)',
}

export default function LearningProgressView({ progress, lang, skin = 'admin', translations, audience = 'teacher', focusAction }: {
  progress: LearningProgress
  lang: string
  skin?: ProgressSkin
  /** Vokabel-Texte für die Leitner-Verteilung. */
  translations: VocabularyTranslations
  audience?: 'teacher' | 'student'
  /** Lernende: Link zum Problemwörter-Training. */
  focusAction?: ReactNode
}) {
  const t = learningProgressCopy(lang)
  const s = SKINS[skin]
  const [mode, setMode] = useState<ProgressMode>('vocabulary')
  const content = <>
    <TodayCard progress={progress} lang={lang} t={t} s={s} />
    <OverviewCard progress={progress} lang={lang} t={t} s={s} />
    <ModeTabs mode={mode} onChange={setMode} t={t} s={s} />
    <div key={skin === 'student' ? mode : undefined} role="tabpanel" id={`progress-panel-${mode}`} aria-labelledby={`progress-tab-${mode}`} className={`${s.stack} ${skin === 'student' ? styles.sitovPanel : ''}`}>
      {mode === 'vocabulary' && <VocabularyPanel progress={progress} lang={lang} t={t} s={s} translations={translations} audience={audience} focusAction={focusAction} />}
      {mode === 'verbs' && <VerbPanel progress={progress} lang={lang} t={t} s={s} />}
      {mode === 'path' && <PathPanel progress={progress} lang={lang} t={t} s={s} />}
      {mode === 'pronunciation' && <PronunciationPanel progress={progress} lang={lang} t={t} s={s} />}
      {mode === 'media' && <MediaPanel progress={progress} lang={lang} t={t} s={s} />}
    </div>
    <DailyTable progress={progress} lang={lang} t={t} s={s} />
  </>
  return skin === 'student' ? <SitovMotionStage className={`${s.stack} ${styles.sitovProgress}`} data-sitov-progress="student">{content}</SitovMotionStage> : <div className={s.stack}>{content}</div>
}

type PanelProps = { progress: LearningProgress; lang: string; t: LearningProgressTranslator; s: Skin }

function Card({ s, title, hint, children, action, variant = 'standard', icon: Icon = Activity }: { s: Skin; title: string; hint?: string; children: ReactNode; action?: ReactNode; variant?: 'standard' | 'today' | 'overview'; icon?: LucideIcon }) {
  const id = useId()
  const student = s === SKINS.student
  const content = <section className={s.card} aria-labelledby={id} data-sitov-variant={student ? variant : undefined} data-sitov-surface={student ? '' : undefined}>
    {student && <div className={styles.sitovAtmosphere} aria-hidden="true"><span className={styles.sitovGlow} /><span className={styles.sitovRim} /><span className={styles.sitovPointerLight} />{variant === 'overview' && <SitovProgressScene />}</div>}
    <div className={`flex flex-wrap items-start justify-between gap-x-4 gap-y-2 ${student ? styles.sitovCardHeader : ''}`}>
      <div className="min-w-0"><h2 id={id} className={`${s.title} ${student ? styles.sitovCardTitle : ''}`}>{student && <span className={styles.sitovTitleIcon} aria-hidden="true"><Icon size={18} /></span>}{title}</h2>{hint && <p className={`mt-1 ${s.hint}`}>{hint}</p>}</div>
      {action}
    </div>
    <div className={`mt-4 ${student ? styles.sitovCardBody : ''}`}>{children}</div>
  </section>
  return student ? <SitovMotionStage className={styles.sitovCardStage}>{content}</SitovMotionStage> : content
}

function Kpi({ s, label, value, hint, tone }: { s: Skin; label: string; value: ReactNode; hint?: ReactNode; tone?: string }) {
  const student = s === SKINS.student
  return <div className={s.tile} style={student && tone ? { '--sitov-tile-tone': tone } as CSSProperties : undefined}>
    {student && <span className={styles.sitovTileLight} aria-hidden="true" />}
    <dt className={s.label}>{label}</dt>
    <dd key={student && (typeof value === 'string' || typeof value === 'number') ? value : undefined} className={`mt-2 ${s.value} ${student ? styles.sitovValue : ''}`} style={tone ? { color: tone } : undefined}>{value}</dd>
    {hint && <dd className={`mt-1.5 ${s.small} text-[var(--muted)]`}>{hint}</dd>}
  </div>
}

const number = (lang: string, value: number) => new Intl.NumberFormat(lang).format(value)
const shortDate = (lang: string, value: string) => new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })
  .format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))

function TodayCard({ progress, lang, t, s }: PanelProps) {
  const today = todaySummary(progress.daily)!
  const totals = rangeTotals(progress.daily)
  const ringLabel = today.percent === null ? t('accuracy_none') : t('accuracy_aria', { value: today.percent })
  const student = s === SKINS.student
  return <Card s={s} title={t('today')} hint={t('today_hint')} variant="today" icon={Sparkles}>
    <div className={`flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center ${student ? styles.sitovTodayLayout : ''}`}>
      <div className={`flex items-center gap-4 ${student ? styles.sitovAccuracyBlock : ''}`}>
        {student ? <div className={styles.sitovAccuracyScene} data-sitov-empty={today.percent === null}>
          <SitovProgressHalo />
          <span className={styles.sitovAccuracyCore}><AccuracyRing value={today.percent} label={ringLabel} size={skinSize(s)} /></span>
        </div> : <AccuracyRing value={today.percent} label={ringLabel} size={skinSize(s)} />}
        <div className="min-w-0">
          <p className={s.label}>{t('accuracy')}</p>
          <p className={`mt-1 ${s.small} text-[var(--muted)]`}>{today.averagePercent === null ? t('average_none') : t('average', { value: today.averagePercent })}</p>
        </div>
      </div>
      <dl className={`grid min-w-0 flex-1 grid-cols-2 gap-2.5 sm:grid-cols-4 ${student ? styles.sitovTodayTiles : ''}`}>
        <Kpi s={s} label={t('answered')} value={number(lang, today.answers)} />
        <Kpi s={s} label={t('correct')} value={number(lang, today.correct)} tone="var(--success)" />
        <Kpi s={s} label={t('wrong')} value={number(lang, today.wrong)} />
        <Kpi s={s} label={t('study_time')} value={formatStudyTime(today.seconds, t)} />
      </dl>
    </div>
    <p className={`mt-4 border-t border-[var(--border)] pt-3 ${s.small} text-[var(--muted)] ${student ? styles.sitovPeriodSummary : ''}`} style={{ borderColor: 'var(--admin-line, var(--border))' }}>
      {student && <ArrowUpRight size={18} aria-hidden="true" className={styles.sitovSummaryIcon} />}
      {t('period_summary', { days: progress.days, answers: number(lang, totals.answers), percent: totals.percent === null ? '–' : `${totals.percent} %`, active: totals.activeDays })}
    </p>
  </Card>
}
const skinSize = (s: Skin) => s === SKINS.student ? 108 : 84

function accuracySeries(t: LearningProgressTranslator, days: number): ChartSeries {
  return { key: 'percent', label: t(days > 7 ? 'accuracy_trend' : 'accuracy'), color: 'var(--violet)', type: 'line', axis: 'percent' }
}
/** Tooltip-Zusatz: die Quote des einzelnen Tages, wenn die Linie den 7-Tage-Wert zeigt. */
function dayAccuracy(t: LearningProgressTranslator, days: number, value: { answers: number; correct: number }) {
  const share = percent(value.correct, value.answers)
  return days > 7 && share !== null ? t('accuracy_day', { value: `${share} %` }) : null
}

function OverviewCard({ progress, lang, t, s }: PanelProps) {
  const series: ChartSeries[] = [
    { key: 'correct', label: t('correct'), color: 'var(--success)', type: 'bar', stack: 'answers' },
    { key: 'wrong', label: t('wrong'), color: 'var(--danger)', type: 'bar', stack: 'answers', opacity: 0.55 },
    accuracySeries(t, progress.days),
  ]
  const line = accuracyLine(progress.daily, answeredOn)
  const points: ChartPoint[] = progress.daily.map((day, index) => {
    const value = answeredOn(day)
    return { date: day.date, values: { correct: value.correct, wrong: value.wrong, percent: line[index] } }
  })
  return <Card s={s} title={t('overview_title')} hint={t('overview_hint')} variant="overview">
    <ChartLegend series={series} />
    <div className="mt-2"><TrendChart points={points} series={series} lang={lang} label={t('overview_title')} emptyLabel={t('empty_chart')}
      detail={index => { const value = answeredOn(progress.daily[index]); return [`${t('answered')}: ${number(lang, value.answers)}`, dayAccuracy(t, progress.days, value)].filter(Boolean).join(' · ') }} /></div>
  </Card>
}

function ModeTabs({ mode, onChange, t, s }: { mode: ProgressMode; onChange: (mode: ProgressMode) => void; t: LearningProgressTranslator; s: Skin }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  function key(event: KeyboardEvent<HTMLDivElement>) {
    const index = PROGRESS_MODES.indexOf(mode)
    const next = event.key === 'ArrowRight' ? PROGRESS_MODES[(index + 1) % PROGRESS_MODES.length]
      : event.key === 'ArrowLeft' ? PROGRESS_MODES[(index + PROGRESS_MODES.length - 1) % PROGRESS_MODES.length]
        : event.key === 'Home' ? PROGRESS_MODES[0] : event.key === 'End' ? PROGRESS_MODES[PROGRESS_MODES.length - 1] : null
    if (!next) return
    event.preventDefault()
    onChange(next)
    refs.current[next]?.focus()
  }
  return <div className={`min-w-0 ${s === SKINS.student ? styles.sitovModes : ''}`}>
    <h2 className={`mb-2 ${s.title}`}>{t('modes_title')}</h2>
    {/* Handy: zwei Spalten – alle fünf Modi auf einen Blick, nichts versteckt sich hinter einer Wischleiste. */}
    <div role="tablist" aria-label={t('modes_label')} onKeyDown={key} className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {PROGRESS_MODES.map(item => {
        const Icon = MODE_ICONS[item]
        return <button key={item} ref={element => { refs.current[item] = element }} type="button" role="tab" id={`progress-tab-${item}`}
          aria-selected={mode === item} aria-controls={`progress-panel-${item}`} tabIndex={mode === item ? 0 : -1}
          data-sitov-mode={s === SKINS.student ? item : undefined} data-sitov-surface={s === SKINS.student ? '' : undefined}
          className={s.tab(mode === item, 'min-w-0 justify-center whitespace-normal text-center leading-tight sm:justify-start')} onClick={() => onChange(item)}>
          <Icon size={17} aria-hidden="true" className="shrink-0" style={{ color: mode === item ? undefined : MODE_COLOR[item] }} />{t(`mode_${item}`)}
        </button>
      })}
    </div>
  </div>
}

function VocabularyPanel({ progress, lang, t, s, translations, audience, focusAction }: PanelProps & { translations: VocabularyTranslations; audience: 'teacher' | 'student'; focusAction?: ReactNode }) {
  const totals = rangeTotals(progress.daily)
  const answers = totals.vocabulary.answers + totals.focus.answers
  const correct = totals.vocabulary.correct + totals.focus.correct
  const series: ChartSeries[] = [
    { key: 'box', label: t('vocab_answers'), color: MODE_COLOR.vocabulary, type: 'bar', stack: 'answers', opacity: 0.85 },
    { key: 'focus', label: t('focus_answers'), color: 'var(--violet)', type: 'bar', stack: 'answers', opacity: 0.75 },
    { ...accuracySeries(t, progress.days), color: 'var(--success)' },
  ]
  const vocabularyAnswers = (day: ProgressDay) => ({ answers: day.vocabulary.answers + day.focus.answers, correct: day.vocabulary.correct + day.focus.correct })
  const line = accuracyLine(progress.daily, vocabularyAnswers)
  const points = progress.daily.map((day, index) => ({ date: day.date, values: { box: day.vocabulary.answers, focus: day.focus.answers, percent: line[index] } }))
  const curve = learnedCurve(progress)
  const learnedSeries: ChartSeries[] = [
    { key: 'learned', label: t('learned_new'), color: 'var(--success)', type: 'bar', opacity: 0.7 },
    { key: 'total', label: t('learned_curve'), color: MODE_COLOR.vocabulary, type: 'line', area: true },
  ]
  const learnedPoints = progress.daily.map((day, index) => ({ date: day.date, values: { learned: day.vocabulary.learned, total: curve[index] } }))
  const v = progress.vocabulary
  return <>
    <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <Kpi s={s} label={t('answered')} value={number(lang, answers)} hint={percent(correct, answers) === null ? t('accuracy_none') : `${percent(correct, answers)} % ${t('correct').toLowerCase()}`} />
      <Kpi s={s} label={t('learned_new')} value={number(lang, totals.vocabulary.learned)} hint={t('period')} />
      <Kpi s={s} label={t('words_learned')} value={t('of_total', { value: number(lang, v.learnedWords), total: number(lang, v.totalWords) })} hint={`${v.overallPercent} %`} />
      <Kpi s={s} label={t('study_time_mode')} value={formatStudyTime(totals.vocabulary.seconds, t)} />
    </dl>
    <Card s={s} title={t('mode_vocabulary')} hint={t('vocab_chart_hint')} icon={BookOpenText}>
      <ChartLegend series={series} />
      <div className="mt-2"><TrendChart points={points} series={series} lang={lang} label={t('mode_vocabulary')} emptyLabel={t('empty_chart')}
        detail={index => { const value = vocabularyAnswers(progress.daily[index]); return [`${t('correct')}: ${number(lang, value.correct)}`, dayAccuracy(t, progress.days, value)].filter(Boolean).join(' · ') }} /></div>
    </Card>
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
      <Card s={s} title={t('learned_curve')} hint={t('learned_curve_hint')}>
        <ChartLegend series={learnedSeries} />
        <div className="mt-2"><TrendChart points={learnedPoints} series={learnedSeries} lang={lang} label={t('learned_curve')} height={190} emptyLabel={t('empty_chart')} /></div>
      </Card>
      <Card s={s} title={t('phases')} hint={t('phases_hint')}>
        <PhaseDistributionChart translations={translations}
          distribution={{ buckets: v.buckets, totalCards: v.totalWords, totalInBox: v.inBox, overallPercent: v.overallPercent }} />
      </Card>
    </div>
    <FocusCard progress={progress} lang={lang} t={t} s={s} audience={audience} action={focusAction} />
  </>
}

function FocusCard({ progress, lang, t, s, audience, action }: PanelProps & { audience: 'teacher' | 'student'; action?: ReactNode }) {
  const focus = progress.focus
  const shown = focus.words.filter(word => word.status === 'active').slice(0, 8)
  const mastered = focus.words.filter(word => word.status === 'mastered')
  const hidden = focus.words.filter(word => word.status === 'active').length - shown.length
  return <Card s={s} title={t('focus_title')} hint={t('focus_explain')} action={action}>
    <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <Kpi s={s} label={t('focus_active')} value={number(lang, focus.active)} />
      <Kpi s={s} label={t('focus_due')} value={number(lang, focus.due)} tone={focus.due ? 'var(--accent-text)' : undefined} />
      <Kpi s={s} label={t('focus_article_words')} value={number(lang, focus.articleWords)} />
      <Kpi s={s} label={t('focus_mastered')} value={number(lang, focus.mastered)} tone={focus.mastered ? 'var(--success)' : undefined} />
    </dl>
    {focus.active + focus.mastered === 0 ? <p className={`mt-4 ${s.hint}`}>{t('focus_empty')}</p> : <>
      {shown.length > 0 && <ul className="mt-4 divide-y divide-[var(--border)]" style={{ borderColor: 'var(--admin-line, var(--border))' }}>
        {shown.map(word => <FocusRow key={word.cardId} word={word} lang={lang} t={t} s={s} />)}
      </ul>}
      {hidden > 0 && <p className={`mt-2 ${s.small} text-[var(--muted)]`}>{t('focus_more', { count: hidden })}</p>}
      {mastered.length > 0 && <p className={`mt-3 ${s.small} text-[var(--muted)]`}>
        <span className="font-semibold text-[var(--success)]">{t('focus_mastered')}:</span>{' '}
        <span lang="de">{mastered.slice(0, 12).map(word => [word.article, word.word].filter(Boolean).join(' ')).join(', ')}</span>
        {mastered.length > 12 ? ` ${t('focus_more', { count: mastered.length - 12 })}` : ''}
      </p>}
      {audience === 'teacher' && focus.words.length < focus.active + focus.mastered && <p className={`mt-2 ${s.small} text-[var(--muted)]`}>{t('focus_more', { count: focus.active + focus.mastered - focus.words.length })}</p>}
    </>}
  </Card>
}

function FocusRow({ word, lang, t, s }: { word: ProgressFocusWord; lang: string; t: LearningProgressTranslator; s: Skin }) {
  const due = !word.due && word.dueAt ? t('due_on', { date: shortDate(lang, word.dueAt) }) : t('due_now')
  const article = word.articleErrors >= 2 && word.article
  return <li className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5 first:pt-0 last:pb-0">
    <div className="min-w-0">
      <p className="break-words font-semibold" lang="de">{word.article && <span className="font-normal text-[var(--muted)]">{word.article} </span>}{word.word}
        <span className={`ml-2 font-normal ${s.small} text-[var(--muted)]`}>{word.level}</span></p>
      <p className={`mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 ${s.small} text-[var(--muted)]`}>
        {article && <span className="font-medium text-[var(--accent-text)]">{t('article_errors', { count: word.articleErrors })}</span>}
        <span>{t('errors', { count: word.wrongCount })}</span>
        {word.practiceCount > 0 && <span>{t('practice', { correct: word.practiceCorrect, total: word.practiceCount })}</span>}
      </p>
    </div>
    <div className="flex shrink-0 flex-col items-end gap-1">
      <StageDots stage={word.stage} label={t('stage', { value: word.stage })} />
      <span className={`${s.small} tabular-nums text-[var(--muted)]`}>{due}</span>
    </div>
  </li>
}

export function StageDots({ stage, label }: { stage: number; label: string }) {
  return <span className="flex items-center gap-1" role="img" aria-label={label}>
    {Array.from({ length: 4 }, (_, index) => <span key={index} className="h-2 w-4 rounded-full"
      style={{ background: index < stage ? 'var(--success)' : 'var(--surface-muted)', boxShadow: index < stage ? undefined : 'inset 0 0 0 1px var(--border)' }} />)}
  </span>
}

function VerbPanel({ progress, lang, t, s }: PanelProps) {
  const totals = rangeTotals(progress.daily).verbs
  const verbs = progress.verbs
  const copy = getSitovVerbCopy(lang)
  const tenses = ['present', 'perfect', 'past'] as const
  const tenseColors = [MODE_COLOR.verbs, 'var(--violet)', 'var(--mode-path-text)']
  const series: ChartSeries[] = tenses.map((tense, index) => ({ key: tense, label: copy[tense], color: tenseColors[index], type: 'bar', stack: 'answers', opacity: .8 }))
  series.push({ ...accuracySeries(t, progress.days), color: 'var(--success)' })
  const line = accuracyLine(progress.daily, day => day.verbs)
  const points = progress.daily.map((day, index) => ({ date: day.date, values: {
    present: day.verbs.present.answers, perfect: day.verbs.perfect.answers, past: day.verbs.past.answers, percent: line[index],
  } }))
  const maxBucket = Math.max(1, ...verbs.buckets.map(bucket => bucket.count))
  return <>
    <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
      <Kpi s={s} label={t('answered')} value={number(lang, totals.answers)} hint={percent(totals.correct, totals.answers) === null ? t('accuracy_none') : `${percent(totals.correct, totals.answers)} % ${t('correct').toLowerCase()}`} tone={MODE_COLOR.verbs} />
      <Kpi s={s} label={t('verb_box')} value={t('of_total', { value: number(lang, verbs.inBox), total: number(lang, verbs.totalVerbs) })} />
      <Kpi s={s} label={t('verb_practiced')} value={t('of_total', { value: number(lang, verbs.practicedForms), total: number(lang, verbs.totalForms) })} />
      <Kpi s={s} label={t('verb_confident')} value={t('of_total', { value: number(lang, verbs.confidentForms), total: number(lang, verbs.totalForms) })} tone="var(--success)" />
      <Kpi s={s} label={t('verb_due')} value={number(lang, verbs.dueForms)} />
      <Kpi s={s} label={t('study_time_mode')} value={formatStudyTime(totals.seconds, t)} />
    </dl>
    <Card s={s} title={t('mode_verbs')} hint={t('verb_chart_hint')} icon={Waypoints}>
      <ChartLegend series={series} />
      <div className="mt-2"><TrendChart points={points} series={series} lang={lang} label={t('mode_verbs')} emptyLabel={t('empty_chart')}
        detail={index => [`${t('correct')}: ${number(lang, progress.daily[index].verbs.correct)}`, dayAccuracy(t, progress.days, progress.daily[index].verbs)].filter(Boolean).join(' · ')} /></div>
    </Card>
    <Card s={s} title={t('verb_tenses')} hint={t('verb_tenses_hint')} icon={Waypoints}>
      <div className="grid min-w-0 gap-3 md:grid-cols-3">
        {verbs.tenses.map(tense => {
          const answers = progress.daily.reduce((sum, day) => sum + day.verbs[tense.tense].answers, 0)
          const correct = progress.daily.reduce((sum, day) => sum + day.verbs[tense.tense].correct, 0)
          return <section key={tense.tense} className={s.tile} aria-label={copy[tense.tense]}>
            <h3 className="font-bold" style={{ color: MODE_COLOR.verbs }}>{copy[tense.tense]}</h3>
            <dl className={`mt-3 space-y-2 ${s.small}`}>
              {[[t('verb_practiced'), t('of_total', { value: number(lang, tense.practicedForms), total: number(lang, tense.totalForms) })],
                [t('verb_confident'), number(lang, tense.confidentForms)], [t('verb_due'), number(lang, tense.dueForms)]].map(([label, value]) =>
                <div className="flex min-w-0 justify-between gap-3" key={label}><dt className="text-[var(--muted)]">{label}</dt><dd className="shrink-0 font-semibold tabular-nums">{value}</dd></div>)}
            </dl>
            <p className={`mt-3 border-t border-[var(--border)] pt-3 ${s.small} text-[var(--muted)]`}>{t('period')}: {number(lang, answers)} · {percent(correct, answers) === null ? t('accuracy_none') : `${percent(correct, answers)} % ${t('correct').toLowerCase()}`}</p>
          </section>
        })}
      </div>
    </Card>
    <Card s={s} title={t('verb_boxes')} hint={t('verb_boxes_hint')} icon={Waypoints}>
      <ol className={styles.sitovVerbDistribution} aria-label={t('verb_boxes')}>
        {verbs.buckets.map(bucket => <li key={bucket.box} data-confident={bucket.box >= 6}>
          <span className={styles.sitovVerbCount}>{number(lang, bucket.count)}</span>
          <span className={styles.sitovVerbTrack} aria-hidden="true"><i style={{ '--sitov-verb-fill': `${bucket.count / maxBucket * 100}%`, '--sitov-verb-delay': `${bucket.box * 45}ms` } as CSSProperties} /></span>
          <span className={styles.sitovVerbStageLabel}>{bucket.box === 0 ? t('verb_new') : t('verb_box_number', { value: bucket.box })}</span>
        </li>)}
      </ol>
    </Card>
  </>
}

function PathPanel({ progress, lang, t, s }: PanelProps) {
  const totals = rangeTotals(progress.daily)
  const path = progress.path
  const series: ChartSeries[] = [
    { key: 'correct', label: t('correct'), color: MODE_COLOR.path, type: 'bar', stack: 'answers', opacity: 0.9 },
    { key: 'wrong', label: t('wrong'), color: MODE_COLOR.path, type: 'bar', stack: 'answers', opacity: 0.35 },
    { ...accuracySeries(t, progress.days), color: 'var(--success)' },
    { key: 'stations', label: t('stations'), color: 'var(--violet)', type: 'bar', hidden: true },
  ]
  const line = accuracyLine(progress.daily, day => day.path)
  const points = progress.daily.map((day, index) => ({ date: day.date, values: {
    correct: day.path.correct, wrong: day.path.answers - day.path.correct, percent: line[index], stations: day.path.stations,
  } }))
  const last = path.tests.at(-1)
  return <>
    <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <Kpi s={s} label={t('path_answers')} value={number(lang, totals.path.answers)} hint={percent(totals.path.correct, totals.path.answers) === null ? t('accuracy_none') : `${percent(totals.path.correct, totals.path.answers)} % ${t('correct').toLowerCase()}`} />
      <Kpi s={s} label={t('stations_done')} value={t('of_total', { value: number(lang, path.completedStations), total: number(lang, path.totalStations) })} hint={`${t('period')}: ${number(lang, totals.path.stations)}`} />
      <Kpi s={s} label={t('units_passed')} value={t('of_total', { value: number(lang, path.completedUnits), total: number(lang, path.totalUnits) })} />
      <Kpi s={s} label={t('last_test')} value={last ? `${Math.round(last.percentage)} %` : '–'} hint={last ? t(last.passed ? 'passed' : 'not_passed') : undefined} tone={last ? (last.passed ? 'var(--success)' : 'var(--danger)') : undefined} />
    </dl>
    <Card s={s} title={t('mode_path')} hint={t('path_chart_hint')} icon={Route}>
      <ChartLegend series={series} />
      <div className="mt-2"><TrendChart points={points} series={series} lang={lang} label={t('mode_path')} emptyLabel={t('empty_chart')}
        detail={index => dayAccuracy(t, progress.days, progress.daily[index].path)} /></div>
    </Card>
    <Card s={s} title={t('tests')} hint={t('tests_hint')}>
      {path.tests.length === 0 ? <p className={s.hint}>{t('no_tests')}</p> : <ol className="space-y-3">
        {path.tests.slice().reverse().map(test => <li key={test.completedAt} className="min-w-0">
          <div className={`flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 ${s.small}`}>
            <span className="min-w-0 break-words font-medium text-[var(--foreground)]">{test.title ?? t('tests')}</span>
            <span className="shrink-0 tabular-nums text-[var(--muted)]">{shortDate(lang, test.completedAt)} · <span className="font-semibold" style={{ color: test.passed ? 'var(--success)' : 'var(--danger)' }}>{Math.round(test.percentage)} %</span></span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]" role="img" aria-label={`${Math.round(test.percentage)} % · ${t(test.passed ? 'passed' : 'not_passed')}`}>
            <div className="h-full rounded-full" style={{ width: `${test.percentage}%`, background: test.passed ? 'var(--success)' : 'var(--danger)' }} />
          </div>
        </li>)}
      </ol>}
    </Card>
  </>
}

function PronunciationPanel({ progress, lang, t, s }: PanelProps) {
  const totals = rangeTotals(progress.daily)
  const pron = progress.pronunciation
  const series: ChartSeries[] = [
    { key: 'recordings', label: t('recordings'), color: MODE_COLOR.pronunciation, type: 'bar', opacity: 0.85 },
    { key: 'replies', label: t('replies'), color: 'var(--success)', type: 'bar', opacity: 0.6 },
  ]
  const points = progress.daily.map(day => ({ date: day.date, values: { recordings: day.pronunciation.recordings, replies: day.pronunciation.replies } }))
  return <>
    <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <Kpi s={s} label={t('recordings')} value={number(lang, totals.pronunciation.recordings)} hint={t('period')} />
      <Kpi s={s} label={t('texts_practiced')} value={t('of_total', { value: number(lang, pron.practicedTexts), total: number(lang, pron.totalTexts) })} />
      <Kpi s={s} label={t('replies')} value={number(lang, totals.pronunciation.replies)} hint={t('period')} />
      <Kpi s={s} label={t('awaiting')} value={number(lang, pron.awaitingReply)} tone={pron.awaitingReply ? 'var(--accent-text)' : undefined} />
    </dl>
    <Card s={s} title={t('mode_pronunciation')} hint={t('pron_chart_hint')} icon={Mic}>
      <ChartLegend series={series} />
      <div className="mt-2"><TrendChart points={points} series={series} lang={lang} label={t('mode_pronunciation')} emptyLabel={t('empty_chart')}
        detail={index => progress.daily[index].pronunciation.seconds ? `${t('study_time')}: ${formatStudyTime(progress.daily[index].pronunciation.seconds, t)}` : null} /></div>
    </Card>
  </>
}

const KIND_ICONS = { video: Film, link: Globe, presentation: FileText } as const

function MediaPanel({ progress, lang, t, s }: PanelProps) {
  const totals = rangeTotals(progress.daily)
  const media = progress.media
  const series: ChartSeries[] = [{ key: 'views', label: t('views'), color: MODE_COLOR.media, type: 'bar', opacity: 0.85 }]
  const points = progress.daily.map(day => ({ date: day.date, values: { views: day.media.views } }))
  return <>
    <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      <Kpi s={s} label={t('views')} value={number(lang, totals.media.views)} hint={t('period')} />
      <Kpi s={s} label={t('media_viewed')} value={t('of_total', { value: number(lang, media.viewedMedia), total: number(lang, media.totalMedia) })}
        hint={media.totalMedia ? `${percent(media.viewedMedia, media.totalMedia)} %` : undefined} />
    </dl>
    <Card s={s} title={t('mode_media')} hint={`${t('media_chart_hint')} ${t('media_since')}`} icon={Film}>
      <TrendChart points={points} series={series} lang={lang} label={t('mode_media')} height={180} emptyLabel={t('empty_chart')} />
    </Card>
    <Card s={s} title={t('media_recent')}>
      {media.recent.length === 0 ? <p className={s.hint}>{t('media_none')}</p> : <ul className="divide-y divide-[var(--border)]" style={{ borderColor: 'var(--admin-line, var(--border))' }}>
        {media.recent.map(item => {
          const Icon = KIND_ICONS[item.kind]
          return <li key={`${item.kind}-${item.title}-${item.viewedAt}`} className="flex min-w-0 items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--mode-media-surface)] text-[var(--mode-media-text)]"><Icon size={17} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{item.title}</p>
              <p className={`${s.small} text-[var(--muted)]`}>{t(`kind_${item.kind}`)} · {shortDate(lang, item.viewedAt)} · {t('times', { count: item.views })}</p></div>
          </li>
        })}
      </ul>}
    </Card>
  </>
}

function DailyTable({ progress, lang, t, s }: PanelProps) {
  const rows = progress.daily.slice().reverse()
  return <details className={`${s.card} ${s === SKINS.student ? styles.sitovDailyTable : ''}`}>
    <summary className={`flex min-h-12 cursor-pointer items-center ${s.title}`}>
      {s === SKINS.student && <span className={styles.sitovTitleIcon} aria-hidden="true"><FileText size={18} /></span>}{t('table')}
      {s === SKINS.student && <ChevronDown size={20} aria-hidden="true" className={styles.sitovTableChevron} />}
    </summary>
    <div className="admin-scroll-x mt-2 overflow-x-auto">
      <table className={`w-full min-w-[34rem] text-left ${s.table}`}>
        <caption className="sr-only">{t('table')}</caption>
        <thead><tr>{[t('date'), t('answered'), t('verb_answers'), t('correct'), t('accuracy'), t('recordings'), t('views'), t('study_time')].map(label =>
          <th key={label} scope="col" className="py-2 pr-3 text-xs font-semibold text-[var(--muted)]">{label}</th>)}</tr></thead>
        <tbody>{rows.map(day => {
          const value = answeredOn(day)
          return <tr key={day.date} className="border-t border-[var(--border)]" style={{ borderColor: 'var(--admin-line, var(--border))' }}>
            <th scope="row" className="py-2 pr-3 font-normal tabular-nums"><time dateTime={day.date}>{shortDate(lang, day.date)}</time></th>
            <td className="pr-3 tabular-nums">{value.answers}</td>
            <td className="pr-3 tabular-nums">{day.verbs.answers}</td>
            <td className="pr-3 tabular-nums">{value.correct}</td>
            <td className="pr-3 tabular-nums">{value.percent === null ? '–' : `${value.percent} %`}</td>
            <td className="pr-3 tabular-nums">{day.pronunciation.recordings}</td>
            <td className="pr-3 tabular-nums">{day.media.views}</td>
            <td className="tabular-nums">{formatStudyTime(studySeconds(day), t)}</td>
          </tr>
        })}</tbody>
      </table>
    </div>
  </details>
}
