import type { CSSProperties } from 'react'
import { ArrowUpRight, BookOpen, Check, Clapperboard, Lock, Mic, Route } from 'lucide-react'
import PressableCard from '@/components/motion/PressableCard'
import CountUp from '@/components/motion/CountUp'
import type { LevelLearningStatus } from '@/lib/learning-status-server'
import { modeHref, type LearningMode } from '@/lib/mode-targets'
import { studentTranslator, type StudentMessageKey } from '@/lib/student-ui-i18n'

type Tone = 'action' | 'calm' | 'done' | 'locked'

interface Tile {
  id: LearningMode
  title: StudentMessageKey
  icon: typeof BookOpen
  text: string
  tone: Tone
  badge: number
}

/**
 * Die vier Modi eines Niveaus als gleich große Karten (Phase 2), je mit einer
 * Kennzahl: fällige Karten, Position auf dem Lernpfad, neue Antworten der
 * Lehrkraft, neue Medien. Was wartet, trägt eine Zahl und die Akzentfarbe;
 * was erledigt ist, bleibt ruhig mit Haken. Gesperrte Modi zeigen den Grund
 * und führen nirgendwohin.
 */
export default function TrainerStatusTiles({ lang, level, status, languageLocked, heading = true, title, continueLink, layout = 'compact' }: {
  lang: string
  level: string
  status: LevelLearningStatus | null
  languageLocked: boolean
  heading?: boolean
  /** Überschrift statt „Deine Lernbereiche" (Home: „Deine Lernbereiche · A1.2"). */
  title?: string
  /** Knopf neben der Überschrift, z. B. „Zum Lernpfad" oder zum zuletzt genutzten Modus. */
  continueLink?: { href: string; label: string }
  /** `modes`: vier Karten nebeneinander ab Tablet-Breite (Niveau-Seite). */
  layout?: 'compact' | 'modes'
}) {
  const t = studentTranslator(lang)
  const lockedText = (area: 'media' | 'other') => area === 'other' && languageLocked ? t('status_language') : t('status_locked')
  const tiles: Tile[] = []

  const vocab = status?.vocabulary
  tiles.push({ id: 'vocabulary', title: 'area_vocabulary', icon: BookOpen, badge: 0, ...(
    vocab?.locked ? { text: lockedText('other'), tone: 'locked' as const }
      : !vocab ? { text: t('status_open'), tone: 'calm' as const }
        : vocab.due > 0 ? { text: t.count('status_vocab_due', vocab.due), tone: 'action' as const, badge: vocab.due }
          : vocab.activeWords + vocab.learned === 0 ? { text: t('status_vocab_setup'), tone: 'action' as const }
            : { text: t('status_vocab_rest'), tone: 'done' as const }) })

  // Bis Phase 3 ist der Lernpfad die Grammatik: Position = erstes offenes Thema.
  const grammar = status?.grammar
  tiles.push({ id: 'path', title: 'area_path', icon: Route, badge: 0, ...(
    grammar?.locked ? { text: lockedText('other'), tone: 'locked' as const }
      : !grammar ? { text: t('status_open'), tone: 'calm' as const }
        : grammar.total === 0 || grammar.topics === 0 ? { text: t('status_empty'), tone: 'calm' as const }
          : grammar.openTopics > 0 ? { text: t('status_path_position', { current: grammar.topics - grammar.openTopics + 1, total: grammar.topics }), tone: 'action' as const }
            : { text: t('status_grammar_done'), tone: 'done' as const }) })

  const speech = status?.pronunciation
  tiles.push({ id: 'pronunciation', title: 'area_pronunciation', icon: Mic, badge: 0, ...(
    speech?.locked ? { text: lockedText('other'), tone: 'locked' as const }
      : !speech ? { text: t('status_open'), tone: 'calm' as const }
        : speech.unread > 0 ? { text: t.count('status_pron_unread', speech.unread), tone: 'action' as const, badge: speech.unread }
          : speech.texts === 0 ? { text: t('status_empty'), tone: 'calm' as const }
            : speech.open > 0 ? { text: t.count('status_pron_open', speech.open), tone: 'calm' as const }
              : speech.waiting > 0 ? { text: t('status_pron_waiting'), tone: 'calm' as const }
                : { text: t('status_pron_done'), tone: 'done' as const }) })

  const media = status?.media
  tiles.push({ id: 'media', title: 'area_media', icon: Clapperboard, badge: 0, ...(
    media?.locked ? { text: lockedText('media'), tone: 'locked' as const }
      : !media ? { text: t('status_open'), tone: 'calm' as const }
        : media.total === 0 ? { text: t('status_empty'), tone: 'calm' as const }
          : media.fresh > 0 ? { text: t.count('status_media_fresh', media.fresh), tone: 'action' as const, badge: media.fresh }
            : { text: t.count('status_media_total', media.total), tone: 'calm' as const }) })

  const headingId = `areas-${level}`
  return (
    <section aria-labelledby={heading ? headingId : undefined} aria-label={heading ? undefined : t('areas_title')} className="st-areas">
      {heading && (
        <div className="st-section-head">
          <div className="min-w-0">
            <h2 id={headingId} className="st-section-title">{title ?? t('areas_title')}</h2>
            {!title && <p className="st-section-sub">{t('areas_level', { level })}</p>}
          </div>
          {continueLink && (
            <PressableCard href={continueLink.href} className="st-link-pill">{continueLink.label}<ArrowUpRight size={18} aria-hidden="true" /></PressableCard>
          )}
        </div>
      )}
      <ul className={layout === 'modes' ? 'st-tiles st-tiles--modes' : 'st-tiles'}>
        {tiles.map((tile, index) => {
          const content = (
            <>
              <span className="st-tile__top">
                <span className="st-tile__icon" aria-hidden="true">{tile.tone === 'locked' ? <Lock size={24} /> : <tile.icon size={24} />}</span>
                {tile.badge > 0 && <span className="st-tile__badge" aria-hidden="true"><CountUp value={tile.badge} cap={999} /></span>}
                {tile.tone === 'done' && <span className="st-tile__check" aria-hidden="true"><Check size={16} strokeWidth={3} /></span>}
              </span>
              <span className="st-tile__title">{t(tile.title)}</span>
              <span className="st-tile__status">
                {tile.tone === 'action' && <span className="sl-due-dot" aria-hidden="true" />}
                {tile.text}
              </span>
            </>
          )
          return (
            <li key={tile.id} className="st-rise" style={{ '--i': index } as CSSProperties}>
              {tile.tone === 'locked'
                ? <div className="st-tile" data-tone="locked" data-area={tile.id} aria-disabled="true">{content}</div>
                : <PressableCard href={modeHref(lang, level, tile.id)} className="st-tile" data-tone={tile.tone} data-area={tile.id}>{content}</PressableCard>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
