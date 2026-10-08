'use client'

import type { CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, Check, History, Lock, Play, Route, Sparkles, Star, Target, Trophy, BookOpen, Repeat } from 'lucide-react'
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

/** Stand in Worten, nur für Screenreader; sichtbar sprechen Medaille, Sterne und Chips. */
function stopStatus(node: PathNode, state: StopState, t: ReturnType<typeof pathTranslator>): string {
  if (node.kind !== 'test') return t(state === 'locked' ? 'locked' : isDone(node) ? 'completed' : node.status === 'in_progress' ? 'resume' : 'ready')
  if (isDone(node)) return t('completed')
  return node.tests.some(attempt => attempt.status === 'active') ? t('resume') : t('ready')
}

/** Kompakter Test-Chip: Ziel 80 %, letzter Versuch oder bestandenes Ergebnis (Versuche kommen neueste zuerst). */
function TestChip({ node, t }: { node: PathNode; t: ReturnType<typeof pathTranslator> }) {
  const passed = node.tests.find(attempt => attempt.passed)
  if (isDone(node)) return <span className={styles.chip} data-tone="success"><Check size={15} strokeWidth={3} aria-hidden="true" />{Math.floor(passed?.percentage ?? 100)}&thinsp;%</span>
  const last = node.tests.find(attempt => attempt.status === 'completed' && attempt.percentage !== null)
  return <>
    <span className={styles.chip} data-tone="gold"><Target size={15} aria-hidden="true" /><span className="sr-only">{t('goal')}</span><span aria-hidden="true">80&thinsp;%</span></span>
    {last?.percentage != null && <span className={styles.chip} data-tone="muted"><History size={15} aria-hidden="true" />
      <span className="sr-only">{t('test_last', { value: Math.floor(last.percentage) })}</span><span aria-hidden="true">{Math.floor(last.percentage)}&thinsp;%</span></span>}
  </>
}

function Stars({ count, label }: { count: number; label: string }) {
  return <span className={styles.stars} role="img" aria-label={label}>
    {[0, 1, 2].map(index => <Star key={index} size={16} aria-hidden="true" fill={index < count ? 'currentColor' : 'none'} data-empty={index < count ? undefined : ''} />)}
  </span>
}

function MedalIcon({ node, state }: { node: PathNode; state: StopState }) {
  if (node.kind === 'test') return <Trophy size={30} strokeWidth={2.4} aria-hidden="true" />
  if (state === 'locked') return <Lock size={node.kind === 'special' ? 18 : 24} aria-hidden="true" />
  if (node.kind === 'special') return <Sparkles size={20} aria-hidden="true" />
  if (state === 'completed') return <Check size={30} strokeWidth={3} aria-hidden="true" />
  if (node.kind === 'review') return <Repeat size={26} strokeWidth={2.6} aria-hidden="true" />
  return state === 'current' ? <BookOpen size={26} strokeWidth={2.4} aria-hidden="true" /> : <>{node.sort_order}</>
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

  return <div className={styles.trailRoot}>
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
          {pathLessons.length > 0 && <div className={styles.meter}>
            <div className={styles.bar} role="img" aria-label={t('path_progress', { done: pathDone, total: pathLessons.length })}>
              <div className={styles.barFill} style={{ '--p': String(pathDone / pathLessons.length) } as CSSProperties} />
            </div>
            <span className={styles.meterValue} aria-hidden="true">{pathDone}/{pathLessons.length}</span>
          </div>}
        </header>

        <ol className={styles.trail}>{path.nodes.map((node, index) => {
          const state = stopState(node, currentId)
          const wave = WAVE[index % WAVE.length]
          const previousWave = WAVE[(index + WAVE.length - 1) % WAVE.length]
          const status = stopStatus(node, state, t)
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
                <span className={styles.medalWrap}>
                  {state === 'current' && <span className={styles.sitovMedalOrbit} aria-hidden="true"><span /></span>}
                  <span className={styles.medal}>
                    <MedalIcon node={node} state={state} />
                    {node.kind === 'test' && <span className={styles.shine} aria-hidden="true" />}
                  </span>
                  {node.kind === 'test' && isDone(node) && <span className={styles.badge} aria-hidden="true"><Check size={14} strokeWidth={3.5} /></span>}
                </span>
                <span className={styles.stopCard}>
                  <span className={styles.stopTitle}>
                    {node.title}{isNewBranch(node.id) && <NewBadge label={newLabel} className="ml-2 align-middle" />}
                  </span>
                  <span className="sr-only">{t(node.kind)}, {status}</span>
                  {(state === 'current' || node.kind === 'test' || node.stars > 0) && <span className={styles.stopMeta}>
                    {state === 'current' && <span className={styles.chip} data-tone="accent"><Play size={14} fill="currentColor" aria-hidden="true" />{t('start_here')}</span>}
                    {node.kind === 'test' && <TestChip node={node} t={t} />}
                    {node.stars > 0 && <Stars count={node.stars} label={t('stars', { count: node.stars })} />}
                  </span>}
                </span>
                {node.available && <ArrowUpRight className={styles.sitovStopArrow} size={18} aria-hidden="true" />}
              </motion.button>
            </div>
            </SitovMotionStage>
          </li>
        })}</ol>
      </section>
    })}
  </div>
}
