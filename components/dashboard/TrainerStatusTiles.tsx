'use client'

import { useId } from 'react'
import { ArrowUpRight, Check, Lock, Waypoints } from 'lucide-react'
import PressableCard from '@/components/motion/PressableCard'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import SitovTrainerCardScene from './SitovTrainerCardScene'
import SitovTrainerCarousel from './SitovTrainerCarousel'
import { getSitovTrainerCarouselCopy } from '@/lib/sitov-trainer-carousel-i18n'
import styles from './TrainerStatusTiles.module.css'
import CountUp from '@/components/motion/CountUp'
import NewBadge from '@/components/motion/NewBadge'
import type { LevelLearningStatus } from '@/lib/learning-status-server'
import { modeHref, sitovLevelModes, type LearningMode } from '@/lib/mode-targets'
import { studentTranslator, type StudentMessageKey } from '@/lib/student-ui-i18n'

type Tone = 'action' | 'calm' | 'done' | 'locked'

interface Tile {
  id: LearningMode
  title: StudentMessageKey
  text: string
  tone: Tone
  badge: number
}

/**
 * Die fünf Modi eines Niveaus im gemeinsamen Karussell für Home und Lernen, je mit einer
 * Kennzahl: fällige Karten, Position auf dem Lernpfad, neue Antworten der
 * Lehrkraft, neue Medien. Was wartet, trägt eine Zahl und die Akzentfarbe;
 * was erledigt ist, bleibt ruhig mit Haken. Gesperrte Modi zeigen den Grund
 * und führen nirgendwohin.
 */
export default function TrainerStatusTiles({ lang, level, status, heading = true, title, continueLink }: {
  lang: string
  level: string
  status: LevelLearningStatus | null
  languageLocked: boolean
  heading?: boolean
  /** Überschrift statt „Deine Lernbereiche" (Home: „Deine Lernbereiche · A1.2"). */
  title?: string
  /** Gemeinsame Kartenaktion unter dem Inhalt, z. B. zum zuletzt genutzten Modus. */
  continueLink?: { href: string; label: string }
  /** Bestehende Aufrufer dürfen beide Namen verwenden; Home und Lernen zeigen dasselbe Karussell. */
  layout?: 'compact' | 'modes'
}) {
  const t = studentTranslator(lang)
  const sitovCarouselCopy = getSitovTrainerCarouselCopy(lang)
  const sitovId = useId()
  const lockedText = () => t('status_locked')
  const tiles: Tile[] = []

  const vocab = status?.vocabulary
  tiles.push({ id: 'vocabulary', title: 'area_vocabulary', badge: 0, ...(
    vocab?.locked ? { text: lockedText(), tone: 'locked' as const }
      : !vocab ? { text: t('status_open'), tone: 'calm' as const }
        : vocab.due > 0 ? { text: t.count('status_vocab_due', vocab.due), tone: 'action' as const, badge: vocab.due }
          : vocab.activeWords + vocab.learned === 0 ? { text: t('status_vocab_setup'), tone: 'action' as const }
            : { text: t('status_vocab_rest'), tone: 'done' as const }) })

  // Position des ersten offenen Lernpfad-Themas, auch nach bestandenem
  // Einstufungstest eines späteren Themas.
  const grammar = status?.grammar
  tiles.push({ id: 'path', title: 'area_path', badge: 0, ...(
    grammar?.locked ? { text: lockedText(), tone: 'locked' as const }
      : !grammar ? { text: t('status_open'), tone: 'calm' as const }
        : grammar.total === 0 || grammar.topics === 0 ? { text: t('status_empty'), tone: 'calm' as const }
          : grammar.openTopics > 0 ? { text: t('status_path_position', { current: grammar.currentTopic ?? grammar.topics - grammar.openTopics + 1, total: grammar.topics }), tone: 'action' as const }
            : { text: t('status_grammar_done'), tone: 'done' as const }) })

  const speech = status?.pronunciation
  tiles.push({ id: 'pronunciation', title: 'area_pronunciation', badge: 0, ...(
    speech?.locked ? { text: lockedText(), tone: 'locked' as const }
      : !speech ? { text: t('status_open'), tone: 'calm' as const }
        : speech.unread > 0 ? { text: t.count('status_pron_unread', speech.unread), tone: 'action' as const, badge: speech.unread }
          : speech.texts === 0 ? { text: t('status_empty'), tone: 'calm' as const }
            : speech.open > 0 ? { text: t.count('status_pron_open', speech.open), tone: 'calm' as const }
              : speech.waiting > 0 ? { text: t('status_pron_waiting'), tone: 'calm' as const }
                : { text: t('status_pron_done'), tone: 'done' as const }) })

  const media = status?.media
  tiles.push({ id: 'media', title: 'area_media', badge: 0, ...(
    media?.locked ? { text: lockedText(), tone: 'locked' as const }
      : !media ? { text: t('status_open'), tone: 'calm' as const }
        : media.total === 0 ? { text: t('status_empty'), tone: 'calm' as const }
          : media.fresh > 0 ? { text: t.count('status_media_fresh', media.fresh), tone: 'action' as const, badge: media.fresh }
            : { text: t.count('status_media_total', media.total), tone: 'calm' as const }) })

  const verbs = status?.verbs
  tiles.push({ id: 'verbs', title: 'area_verbs', badge: 0, ...(
    verbs?.locked ? { text: t('status_locked'), tone: 'locked' as const }
      : !verbs ? { text: t('status_open'), tone: 'calm' as const }
        : verbs.total === 0 ? { text: t('status_empty'), tone: 'calm' as const }
          : verbs.due > 0 ? { text: t.count('status_verbs_due', verbs.due), tone: 'action' as const, badge: verbs.due }
            : verbs.selected > 0 ? { text: t.count('status_verbs_selected', verbs.selected), tone: 'calm' as const }
              : { text: t.count('status_verbs_total', verbs.total), tone: 'action' as const }) })

  const sitovSlides = sitovLevelModes(level).map(mode => tiles.find(tile => tile.id === mode)!).map(tile => {
    const sitovVerbArt = <span className={styles.sitovVerbOrbit} aria-hidden="true"><span className={styles.sitovOrbitRing} /><span className={styles.sitovOrbitRing} /><span className={styles.sitovOrbitWord}>ich</span><span className={styles.sitovOrbitWord}>du</span><span className={styles.sitovOrbitWord}>wir</span><Waypoints size={30} /></span>
    const content = (
            <>
              <span className={styles.sitovAtmosphere} aria-hidden="true"><span className={styles.sitovRim} /><span className={styles.sitovLight} /></span>
              <span className={`st-tile__top ${styles.sitovSceneMeta}`}>
                {tile.tone === 'locked' && <span className="st-tile__icon" aria-hidden="true"><Lock size={20} /></span>}
                {tile.badge > 0 && <span className="st-tile__badge" aria-hidden="true"><CountUp value={tile.badge} cap={999} /></span>}
                {tile.tone !== 'locked' && status?.fresh?.[tile.id] && <NewBadge label={t('media_new')} className="st-tile__new" />}
                {tile.tone === 'done' && <span className="st-tile__check" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>}
              </span>
              {tile.id !== 'verbs' ? <SitovTrainerCardScene mode={tile.id} tone={tile.tone} className={styles.sitovCardArt} /> : sitovVerbArt}
              <span className="st-tile__title">{t(tile.title)}</span>
              <span className={styles.sitovDescription}>{sitovCarouselCopy.descriptions[tile.id]}</span>
              <span className="st-tile__status">
                {tile.tone === 'action' && <span className="sl-due-dot" aria-hidden="true" />}
                {tile.text}
              </span>
              {tile.tone !== 'locked' && <span className={styles.sitovArrow} aria-hidden="true"><ArrowUpRight size={20} /></span>}
            </>
          )
    const sitovClass = `st-tile ${styles.sitovTile} ${styles.sitovCarouselCard}`
    const card = tile.tone === 'locked'
      ? <div className={sitovClass} data-sitov-surface="" data-tone="locked" data-area={tile.id} aria-disabled="true">{content}</div>
      : <PressableCard href={modeHref(lang, level, tile.id)} className={sitovClass} data-sitov-surface="" data-tone={tile.tone} data-area={tile.id}>{content}</PressableCard>
    return { id: tile.id, label: t(tile.title), locked: tile.tone === 'locked', card }
  })

  const headingId = `sitov-areas-${level}-${sitovId.replace(/:/g, '')}`
  return (
    <section aria-labelledby={heading ? headingId : undefined} aria-label={heading ? undefined : t('areas_title')} className={`st-areas ${styles.sitovAreasPanel}`}>
      {heading && (
        <div className="st-section-head">
          <div className="min-w-0">
            <h2 id={headingId} className="st-section-title">{title ?? t('areas_title')}</h2>
            {!title && <p className="st-section-sub">{t('areas_level', { level })}</p>}
          </div>
        </div>
      )}
      <SitovMotionStage className={styles.sitovStage}>
        <SitovTrainerCarousel items={sitovSlides} lang={lang} label={t('areas_title')} />
      </SitovMotionStage>
      {continueLink && <footer className={styles.sitovAreasFooter}>
        <PressableCard href={continueLink.href} className="st-link-pill">{continueLink.label}<ArrowUpRight size={18} aria-hidden="true" /></PressableCard>
      </footer>}
    </section>
  )
}
