import Link from 'next/link'
import type { CSSProperties } from 'react'
import { ArrowUpRight, BookOpen, Check, Clapperboard, Lock, Mic, PenTool } from 'lucide-react'
import type { LevelLearningStatus } from '@/lib/learning-status-server'
import { studentTranslator, type StudentMessageKey } from '@/lib/student-ui-i18n'

type Tone = 'action' | 'calm' | 'done' | 'locked'

interface Tile {
  id: 'vocabulary' | 'grammar' | 'pronunciation' | 'media'
  path: string
  title: StudentMessageKey
  icon: typeof BookOpen
  text: string
  tone: Tone
  badge: number
}

/**
 * Die vier Lernbereiche als Kacheln mit Stand — wie die Lektionskarten der
 * Lernbox: Was wartet, trägt die Akzentfarbe und eine Zahl; was erledigt
 * ist, bleibt ruhig mit Haken. So sieht man ohne Tippen, wo es weitergeht.
 */
export default function TrainerStatusTiles({ lang, level, status, languageLocked, heading = true, showPathLink = false }: {
  lang: string
  level: string
  status: LevelLearningStatus | null
  languageLocked: boolean
  heading?: boolean
  showPathLink?: boolean
}) {
  const t = studentTranslator(lang)
  const lockedText = (area: 'media' | 'other') => area === 'other' && languageLocked ? t('status_language') : t('status_locked')
  const tiles: Tile[] = []

  const vocab = status?.vocabulary
  tiles.push({ id: 'vocabulary', path: 'vocabulary', title: 'area_vocabulary', icon: BookOpen, badge: 0, ...(
    vocab?.locked ? { text: lockedText('other'), tone: 'locked' as const }
      : !vocab ? { text: t('status_open'), tone: 'calm' as const }
        : vocab.due > 0 ? { text: t.count('status_vocab_due', vocab.due), tone: 'action' as const, badge: vocab.due }
          : vocab.activeWords + vocab.learned === 0 ? { text: t('status_vocab_setup'), tone: 'action' as const }
            : { text: t('status_vocab_rest'), tone: 'done' as const }) })

  const grammar = status?.grammar
  tiles.push({ id: 'grammar', path: 'exercises', title: 'area_grammar', icon: PenTool, badge: 0, ...(
    grammar?.locked ? { text: lockedText('other'), tone: 'locked' as const }
      : !grammar ? { text: t('status_open'), tone: 'calm' as const }
        : grammar.total === 0 ? { text: t('status_empty'), tone: 'calm' as const }
          : grammar.openTopics > 0 ? { text: t.count('status_grammar_open', grammar.openTopics), tone: 'action' as const, badge: grammar.openTopics }
            : { text: t('status_grammar_done'), tone: 'done' as const }) })

  const speech = status?.pronunciation
  tiles.push({ id: 'pronunciation', path: 'pronunciation', title: 'area_pronunciation', icon: Mic, badge: 0, ...(
    speech?.locked ? { text: lockedText('other'), tone: 'locked' as const }
      : !speech ? { text: t('status_open'), tone: 'calm' as const }
        : speech.unread > 0 ? { text: t.count('status_pron_unread', speech.unread), tone: 'action' as const, badge: speech.unread }
          : speech.texts === 0 ? { text: t('status_empty'), tone: 'calm' as const }
            : speech.open > 0 ? { text: t.count('status_pron_open', speech.open), tone: 'calm' as const }
              : speech.waiting > 0 ? { text: t('status_pron_waiting'), tone: 'calm' as const }
                : { text: t('status_pron_done'), tone: 'done' as const }) })

  const media = status?.media
  tiles.push({ id: 'media', path: 'videos', title: 'area_media', icon: Clapperboard, badge: 0, ...(
    media?.locked ? { text: lockedText('media'), tone: 'locked' as const }
      : !media ? { text: t('status_open'), tone: 'calm' as const }
        : media.total === 0 ? { text: t('status_empty'), tone: 'calm' as const }
          : media.fresh > 0 ? { text: t.count('status_media_fresh', media.fresh), tone: 'action' as const, badge: media.fresh }
            : { text: t.count('status_media_total', media.total), tone: 'calm' as const }) })

  const base = `/${lang}/dashboard/level/${encodeURIComponent(level)}`
  return (
    <section aria-labelledby={heading ? `areas-${level}` : undefined} aria-label={heading ? undefined : t('areas_title')} className="st-areas">
      {heading && (
        <div className="st-section-head">
          <div className="min-w-0">
            <h2 id={`areas-${level}`} className="st-section-title">{t('areas_title')}</h2>
            <p className="st-section-sub">{t('areas_level', { level })}</p>
          </div>
          {showPathLink && (
            <Link href={base} className="st-link-pill st-press">{t('areas_to_path')}<ArrowUpRight size={18} aria-hidden="true" /></Link>
          )}
        </div>
      )}
      <ul className="st-tiles">
        {tiles.map((tile, index) => {
          const content = (
            <>
              <span className="st-tile__top">
                <span className="st-tile__icon" aria-hidden="true">{tile.tone === 'locked' ? <Lock size={24} /> : <tile.icon size={24} />}</span>
                {tile.badge > 0 && <span className="st-tile__badge" aria-hidden="true">{tile.badge > 999 ? '999+' : tile.badge}</span>}
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
                ? <div className="st-tile" data-tone="locked" aria-disabled="true">{content}</div>
                : <Link href={`${base}/${tile.path}`} className="st-tile st-press" data-tone={tile.tone} data-area={tile.id}>{content}</Link>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
