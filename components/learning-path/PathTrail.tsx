'use client'

import type { CSSProperties } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Flag, History, Lock, Play, Route, Sparkles, Star, Target, Trophy, BookOpen, Repeat } from 'lucide-react'
import type { PathMap, PathNode } from '@/lib/learning-path-contract'
import { pathTranslator } from '@/lib/learning-path-i18n'
import { sitovTrainerHeroCopy } from '@/lib/sitov-trainer-hero-i18n'
import { MOTION, PRESS_SCALE, useReducedMotionSafe } from '@/lib/motion'
import NewBadge from '@/components/motion/NewBadge'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import SitovTrainerHero from '@/components/motion/SitovTrainerHero'
import SitovPathScene from './SitovPathScene'
import styles from './learning-path.module.css'

type Path = PathMap['paths'][number]
export type StopState = 'completed' | 'current' | 'open' | 'locked'

/** S-Kurve des Weges: Ausschlag je Halt, 0 = links, 1 = ganz ausgeschwungen. */
const WAVE = [0, 0.55, 1, 0.55]
const isLesson = (node: PathNode) => node.kind === 'practice' || node.kind === 'review'
const isDone = (node: PathNode) => node.status === 'completed'

/**
 * Zuerst der letzte verfügbare Server-Checkpoint, sonst die erste offene,
 * nicht geschaffte Station. Ohne Checkpoint liegen Extras neben dem Weg.
 */
export function currentNodeId(map: PathMap): string | null {
  const checkpoint = map.paths.flatMap(path => path.nodes).find(node => node.id === map.resume_node_id && node.available)
  if (checkpoint) return checkpoint.id
  for (const path of map.paths) {
    for (const node of path.nodes) {
      if (node.kind !== 'special' && node.available && !isDone(node)) return node.id
    }
  }
  return null
}

export function stopState(node: PathNode, currentId: string | null): StopState {
  if (!node.available) return 'locked'
  if (node.id === currentId) return 'current'
  return isDone(node) ? 'completed' : 'open'
}

/** Ein Abschnitt gilt als erreicht, wenn der Halt darunter begehbar ist; ein Test erst, wenn alles davor offen ist. */
function reached(path: Path, index: number): boolean {
  const node = path.nodes[index]
  if (isDone(node)) return true
  if (node.kind !== 'test') return node.available
  return path.nodes.slice(0, index).every(before => before.available)
}

/** Sichtbarer Status folgt weiterhin ausschließlich dem gespeicherten Lernstand. */
function stopStatus(node: PathNode, state: StopState, t: ReturnType<typeof pathTranslator>): string {
  if (node.kind !== 'test') return t(state === 'locked' ? 'locked' : isDone(node) ? 'completed' : node.status === 'in_progress' ? 'resume' : 'ready')
  if (isDone(node)) return t('completed')
  return node.tests.some(attempt => attempt.status === 'active') ? t('resume') : t('ready')
}

/** Bestehensgrenze und persönliches Ergebnis sind ausdrücklich getrennt. */
function SitovTestDetails({ node, t }: { node: PathNode; t: ReturnType<typeof pathTranslator> }) {
  const passed = node.tests.find(attempt => attempt.passed)
  const last = node.tests.find(attempt => attempt.status === 'completed' && attempt.percentage !== null)
  return <span className={styles.sitovTestDetails}>
    <span className={styles.sitovTestGoal} data-testid={`sitov-test-goal-${node.id}`}>
      <span className={styles.sitovTestGoalNumber} aria-hidden="true">80<span>%</span></span>
      <span className={styles.sitovTestGoalCopy}>
        <span className={styles.sitovTestGoalLabel}><Target size={15} aria-hidden="true" />{t('sitov_test_goal_label')}</span>
        <span className={styles.sitovTestGoalText}>{t('sitov_test_goal')}</span>
      </span>
      <span className={styles.sitovTestGoalScale} aria-hidden="true">{Array.from({ length: 10 }, (_, index) => <span key={index} data-required={index < 8} />)}</span>
    </span>
    {isDone(node) ? <span className={styles.sitovTestResult} data-passed="true"><Check size={17} aria-hidden="true" />
      {passed?.percentage != null ? t('sitov_test_passed', { value: Math.floor(passed.percentage) }) : t('passed')}
    </span> : last?.percentage != null && <span className={styles.sitovTestResult} data-passed="false"><History size={16} aria-hidden="true" />
      {t('sitov_test_last', { value: Math.floor(last.percentage) })}
    </span>}
  </span>
}

function Stars({ count, label }: { count: number; label: string }) {
  return <span className={styles.stars} role="img" aria-label={label}>
    {[0, 1, 2].map(index => <Star key={index} size={16} aria-hidden="true" fill={index < count ? 'currentColor' : 'none'} data-empty={index < count ? undefined : ''} />)}
  </span>
}

function MedalIcon({ node }: { node: PathNode }) {
  if (node.kind === 'special') return <Sparkles size={26} aria-hidden="true" />
  if (node.kind === 'review') return <Repeat size={26} strokeWidth={2.6} aria-hidden="true" />
  return <BookOpen size={28} strokeWidth={2.2} aria-hidden="true" />
}

export default function PathTrail({ map, lang, busy, onOpen, onContinue, isNewPath, isNewBranch, newLabel }: {
  map: PathMap; lang: string; busy: boolean
  onOpen: (node: PathNode, path: Path) => void
  onContinue?: (node: PathNode, path: Path) => void
  isNewPath: (id: string) => boolean
  isNewBranch: (id: string) => boolean
  newLabel: string
}) {
  const t = pathTranslator(lang)
  const heroCopy = sitovTrainerHeroCopy(lang)
  const reduced = useReducedMotionSafe()
  const currentId = currentNodeId(map)
  const currentPath = map.paths.find(path => path.nodes.some(node => node.id === currentId))
  const currentNode = currentPath?.nodes.find(node => node.id === currentId)
  const hasCheckpoint = currentNode?.id === map.resume_node_id
  const lessons = map.paths.flatMap(path => path.nodes.filter(isLesson))
  const levelDone = lessons.filter(isDone).length
  const progressLabel = t('level_progress', { done: levelDone, total: lessons.length })

  return <div className={styles.trailRoot} lang={lang} aria-busy={busy}>
    <SitovTrainerHero mode="path" eyebrow="Sitov Academy" level={map.level} title={t('title')}
      className={styles.sitovPathHero} testId="path-level-progress"
      graphic={<SitovPathScene nodes={map.paths.flatMap(path => path.nodes)} currentId={currentId} />}
      action={(!map.completed || hasCheckpoint) && currentPath && currentNode ? {
        label: heroCopy.pathAction, disabled: busy, busy,
        onClick: () => (onContinue ?? onOpen)(currentNode, currentPath),
      } : undefined}>
      {lessons.length > 0 && <div className={styles.sitovHeroProgress}>
        <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={lessons.length} aria-valuenow={levelDone}
          aria-label={progressLabel}>
          <div className={styles.barFill} style={{ '--p': String(levelDone / lessons.length) } as CSSProperties} />
        </div>
        <span className={styles.sitovHeroProgressLabel} aria-hidden="true">{progressLabel}</span>
      </div>}
    </SitovTrainerHero>

    {map.paths.map(path => {
      const pathLessons = path.nodes.filter(isLesson)
      const pathDone = pathLessons.filter(isDone).length
      const bannerState = path.completed ? 'completed' : path.available ? 'open' : 'locked'
      return <section key={path.id} className={styles.sitovPathSection} aria-labelledby={`path-title-${path.id}`}>
        <header className={styles.banner} data-state={bannerState} data-sitov-surface>
          <Route className={styles.bannerArt} aria-hidden="true" />
          <span className={styles.sitovBannerLine} aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-2">
            <span className={styles.chip} data-tone="path"><Route size={16} aria-hidden="true" />{t('path', { number: path.sort_order })}</span>
            {path.completed ? <span className={styles.chip} data-tone="gold" role="img" aria-label={t('completed')}><Trophy size={16} aria-hidden="true" /></span>
              : !path.available && <span className={styles.chip} data-tone="muted" role="img" aria-label={t('locked')}><Lock size={16} aria-hidden="true" /></span>}
          </div>
          <h3 id={`path-title-${path.id}`} className="!mt-3 !text-2xl !font-extrabold !leading-tight">
            {path.title}{isNewPath(path.id) && <NewBadge label={newLabel} className="ml-2 align-middle" />}
          </h3>
          {pathLessons.length > 0 && <div className={styles.sitovPathProgress}>
            <span className={styles.sitovPathProgressLabel}>{t('sitov_stations_done', { done: pathDone, total: pathLessons.length })}</span>
            <span className={styles.sitovPathSegments} aria-hidden="true">{pathLessons.map(lesson => <span key={lesson.id} data-completed={isDone(lesson)} />)}</span>
          </div>}
        </header>

        <ol className={styles.trail}>{path.nodes.map((node, index) => {
          const state = stopState(node, currentId)
          const wave = WAVE[index % WAVE.length]
          const previousWave = WAVE[(index + WAVE.length - 1) % WAVE.length]
          const status = stopStatus(node, state, t)
          const test = node.kind === 'test'
          const activeTest = node.tests.some(attempt => attempt.status === 'active')
          const hasTestResult = node.tests.some(attempt => attempt.status === 'completed')
          const action = test ? t(hasTestResult ? 'review_open' : activeTest ? 'sitov_test_resume' : 'sitov_test_action')
            : t(node.status === 'in_progress' ? 'sitov_stage_continue' : isDone(node) ? 'review' : 'sitov_station_action')
          return <li key={node.id} className={styles.stop} data-state={state} data-kind={node.kind}
            style={{ '--wave': String(wave), '--i': String(index) } as CSSProperties}>
            <SitovMotionStage className={styles.sitovStopStage}>
            {index > 0 && <div className={styles.connector} data-reached={reached(path, index)} aria-hidden="true">
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" focusable="false">
                <path vectorEffect="non-scaling-stroke" d={`M${previousWave * 100} 0 C${previousWave * 100} 22 ${wave * 100} 18 ${wave * 100} 40`} />
              </svg>
            </div>}
            <div className={styles.row}>
              {index < path.nodes.length - 1 && <span className={styles.rail} data-reached={reached(path, index + 1)} aria-hidden="true" />}
              <motion.button type="button" className={styles.step} data-testid={`path-node-${node.id}`} data-node-kind={node.kind} data-state={state}
                data-sitov-surface aria-disabled={busy || !node.available}
                disabled={busy || !node.available} aria-current={state === 'current' ? 'step' : undefined}
                whileTap={reduced ? undefined : { scale: PRESS_SCALE }} transition={{ duration: reduced ? 0 : MOTION.fast }}
                onClick={() => onOpen(node, path)}>
                <span className={styles.medalWrap} aria-hidden="true">
                  {test ? <span className={styles.sitovTrophyScene}>
                    <Image src="/Bilder/learning-path/sitov-path-trophy.webp" alt="" width={176} height={200} sizes="(max-width: 640px) 96px, 150px" className={styles.sitovTrophyImage} />
                    <Sparkles className={styles.sitovTrophySpark} size={20} />
                  </span> : <>
                    {state === 'current' && <span className={styles.sitovMedalOrbit}><span /></span>}
                    <span className={styles.medal}><MedalIcon node={node} /></span>
                    <span className={styles.sitovMedalStatus} data-state={state}>
                      {state === 'locked' ? <Lock size={12} strokeWidth={2.5} /> : isDone(node) ? <Check size={13} strokeWidth={3} /> : String(node.sort_order).padStart(2, '0')}
                    </span>
                  </>}
                </span>
                <span className={styles.stopCard}>
                  <span className={styles.sitovStationEyebrow}>
                    {test ? <><Flag size={14} aria-hidden="true" />{t('sitov_test_eyebrow')}</> : <>{t('sitov_stage', { number: String(node.sort_order).padStart(2, '0') })}<span aria-hidden="true">·</span>{t(node.kind)}</>}
                  </span>
                  <span className={styles.stopTitle}>
                    {node.title}{isNewBranch(node.id) && <NewBadge label={newLabel} className="ml-2 align-middle" />}
                  </span>
                  {test ? <>
                    <span className={styles.sitovStationHint}>{t('sitov_test_goal_hint')}</span>
                    <SitovTestDetails node={node} t={t} />
                    <span className={styles.sitovTestFooter}>
                      <span className={styles.sitovStationAction}>{action}<ArrowRight size={17} aria-hidden="true" /></span>
                      <span className={styles.sitovTestAvailability}>{node.available ? t('sitov_test_available') : t('locked')}</span>
                    </span>
                  </> : <>
                    <span className={styles.stopMeta}>
                      {state === 'current' ? <span className={styles.sitovCurrentLabel}><Play size={12} fill="currentColor" aria-hidden="true" />{t('start_here')}</span>
                        : <span className={styles.sitovStationStatus} data-state={state}>
                          {state === 'locked' ? <Lock size={13} aria-hidden="true" /> : isDone(node) ? <Check size={14} aria-hidden="true" /> : <span className={styles.sitovReadyDot} aria-hidden="true" />}{status}
                        </span>}
                      {node.stars > 0 && <Stars count={node.stars} label={t('stars', { count: node.stars })} />}
                    </span>
                    {state === 'locked' && <span className={styles.sitovStationHint}>{t('sitov_stage_locked')}</span>}
                    {state === 'current' && <span className={styles.sitovStationAction}>{action}<ArrowRight size={17} aria-hidden="true" /></span>}
                  </>}
                </span>
                {!test && node.available && state !== 'current' && <span className={styles.sitovStationOpen} aria-hidden="true"><ArrowRight size={18} /></span>}
              </motion.button>
            </div>
            </SitovMotionStage>
          </li>
        })}</ol>
      </section>
    })}
  </div>
}
