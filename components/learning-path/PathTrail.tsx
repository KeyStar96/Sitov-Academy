'use client'

import type { CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { Check, Lock, Route, Sparkles, Star, Trophy, BookOpen, Repeat } from 'lucide-react'
import type { PathMap, PathNode } from '@/lib/learning-path-contract'
import { pathTranslator } from '@/lib/learning-path-i18n'
import { MOTION, PRESS_SCALE, useReducedMotionSafe } from '@/lib/motion'
import NewBadge from '@/components/motion/NewBadge'
import styles from './learning-path.module.css'

type Path = PathMap['paths'][number]
export type StopState = 'completed' | 'current' | 'open' | 'locked'

/** S-Kurve des Weges: Ausschlag je Halt, 0 = links, 1 = ganz ausgeschwungen. */
const WAVE = [0, 0.55, 1, 0.55]
const isLesson = (node: PathNode) => node.kind === 'practice' || node.kind === 'review'
const isDone = (node: PathNode) => node.status === 'completed'

/**
 * Der eine Halt, an dem es weitergeht: die erste offene, nicht geschaffte
 * Lektion des Niveaus, sonst der erste noch nicht bestandene Test. Extras
 * zählen nicht, sie liegen neben dem Weg.
 */
export function currentNodeId(map: PathMap): string | null {
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

/** Stand in Worten; ein Test nennt sein letztes Ergebnis (Attempts kommen neueste zuerst). */
function stopStatus(node: PathNode, state: StopState, t: ReturnType<typeof pathTranslator>): string {
  if (node.kind !== 'test') return t(state === 'locked' ? 'locked' : isDone(node) ? 'completed' : node.status === 'in_progress' ? 'resume' : 'ready')
  const passed = node.tests.find(attempt => attempt.passed)
  if (isDone(node)) return t('test_passed', { value: Math.floor(passed?.percentage ?? 100) })
  if (node.tests.some(attempt => attempt.status === 'active')) return t('resume')
  const last = node.tests.find(attempt => attempt.status === 'completed' && attempt.percentage !== null)
  return last?.percentage != null ? t('test_last', { value: Math.floor(last.percentage) }) : t('ready')
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

export default function PathTrail({ map, lang, busy, onOpen, isNewPath, isNewBranch, newLabel }: {
  map: PathMap; lang: string; busy: boolean
  onOpen: (node: PathNode, path: Path) => void
  isNewPath: (id: string) => boolean
  isNewBranch: (id: string) => boolean
  newLabel: string
}) {
  const t = pathTranslator(lang)
  const reduced = useReducedMotionSafe()
  const currentId = currentNodeId(map)
  const lessons = map.paths.flatMap(path => path.nodes.filter(isLesson))
  const levelDone = lessons.filter(isDone).length

  return <div className={styles.trailRoot}>
    {lessons.length > 0 && <div data-testid="path-level-progress">
      <p className="!m-0 text-base font-semibold text-[var(--muted)]">{t('level_progress', { done: levelDone, total: lessons.length })}</p>
      <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={lessons.length} aria-valuenow={levelDone} aria-label={t('title')}>
        <div className={styles.barFill} style={{ '--p': String(levelDone / lessons.length) } as CSSProperties} />
      </div>
    </div>}

    {map.paths.map(path => {
      const pathLessons = path.nodes.filter(isLesson)
      const pathDone = pathLessons.filter(isDone).length
      const bannerState = path.completed ? 'completed' : path.available ? 'open' : 'locked'
      return <section key={path.id} aria-labelledby={`path-title-${path.id}`}>
        <header className={styles.banner} data-state={bannerState}>
          <Route className={styles.bannerArt} aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-2">
            <span className={styles.chip} data-tone="path"><Route size={16} aria-hidden="true" />{t('path', { number: path.sort_order })}</span>
            {path.completed ? <span className={styles.chip} data-tone="gold"><Trophy size={16} aria-hidden="true" />{t('completed')}</span>
              : !path.available && <span className={styles.chip} data-tone="muted"><Lock size={16} aria-hidden="true" />{t('locked')}</span>}
          </div>
          <h3 id={`path-title-${path.id}`} className="!mt-3 !text-2xl !font-extrabold !leading-tight">
            {path.title}{isNewPath(path.id) && <NewBadge label={newLabel} className="ml-2 align-middle" />}
          </h3>
          {pathLessons.length > 0 && <>
            <p className="!mb-0 !mt-2 text-base font-semibold text-[var(--muted)]">{t('path_progress', { done: pathDone, total: pathLessons.length })}</p>
            <div className={styles.bar} aria-hidden="true"><div className={styles.barFill} style={{ '--p': String(pathDone / pathLessons.length) } as CSSProperties} /></div>
          </>}
          {!path.available && <p className="!mb-0 !mt-3 text-base text-[var(--foreground)]">{t('path_locked_hint')}</p>}
        </header>

        <ol className={styles.trail}>{path.nodes.map((node, index) => {
          const state = stopState(node, currentId)
          const wave = WAVE[index % WAVE.length]
          const previousWave = WAVE[(index + WAVE.length - 1) % WAVE.length]
          const status = stopStatus(node, state, t)
          return <li key={node.id} className={styles.stop} data-state={state} data-kind={node.kind}
            style={{ '--wave': String(wave), '--i': String(index) } as CSSProperties}>
            {index > 0 && <div className={styles.connector} data-reached={reached(path, index)} aria-hidden="true">
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" focusable="false">
                <path vectorEffect="non-scaling-stroke" d={`M${previousWave * 100} 0 C${previousWave * 100} 22 ${wave * 100} 18 ${wave * 100} 40`} />
              </svg>
            </div>}
            <div className={styles.row}>
              {index < path.nodes.length - 1 && <span className={styles.rail} data-reached={reached(path, index + 1)} aria-hidden="true" />}
              <motion.button type="button" className={styles.step} data-testid={`path-node-${node.id}`} data-node-kind={node.kind} data-state={state}
                disabled={busy || !node.available} aria-current={state === 'current' ? 'step' : undefined}
                whileTap={reduced ? undefined : { scale: PRESS_SCALE }} transition={{ duration: reduced ? 0 : MOTION.fast }}
                onClick={() => onOpen(node, path)}>
                <span className={styles.medalWrap}>
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
                  <span className={styles.stopMeta}>
                    {state === 'current' && <span className={styles.chip} data-tone="accent">{t('start_here')}</span>}
                    {node.kind === 'test' && !isDone(node) && <span className={styles.chip} data-tone="gold">{t('test_open')}</span>}
                    <span>{t(node.kind)} · {status}</span>
                    {node.stars > 0 && <Stars count={node.stars} label={t('stars', { count: node.stars })} />}
                  </span>
                  {node.kind === 'test' && !isDone(node) && <span className={`${styles.stopMeta} !font-medium`}>{t('test_hint')}</span>}
                </span>
              </motion.button>
            </div>
          </li>
        })}</ol>
      </section>
    })}
  </div>
}
