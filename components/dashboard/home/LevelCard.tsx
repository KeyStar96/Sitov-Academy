import Link from 'next/link'
import { ChevronRight, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import NewBadge from '@/components/motion/NewBadge'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import SitovLevelArt from './SitovLevelArt'
import styles from './SitovLevelSupport.module.css'

export interface LevelCardCopy {
  /** Sichtbarer Text der Aktion, abhängig davon, ob schon Fortschritt besteht. */
  start: string
  continueLearning: string
  lockedHint: string
  /** „Neu"-Kennzeichen (Phase 6.1). */
  newLabel?: string
}

/**
 * Eine Niveau-Kachel der Dashboard-Übersicht.
 *
 * Räumliche Stufen illustrieren den nächsten Lernabschnitt. Der echte
 * Fortschritt bleibt im Prozentwert und im Band an der Unterkante sichtbar.
 *
 * Ein gesperrtes Niveau ist bewusst kein Link, sondern ein `article` — es gibt
 * nichts zu öffnen, und ein toter Link wäre für Tastatur und Screenreader
 * schlicht eine Sackgasse.
 */
export default function LevelCard({ id, title, description, index, href, locked, progress, copy, fresh = false }: {
  id: string
  title: string
  description: string
  /** Nullbasiert; angezeigt wird `01`, `02`, … */
  index: number
  href: string
  locked: boolean
  /** Bereits auf 0–100 begrenzt. */
  progress: number
  copy: LevelCardCopy
  /** Im Niveau ist etwas neu: das Niveau selbst oder Inhalte in einem Modus. */
  fresh?: boolean
}) {
  const content = (
    <>
      <span className={styles.sitovAtmosphere} aria-hidden="true"><span className={styles.sitovPointerLight} /><span className={styles.sitovRim} /></span>
      <div className={styles.sitovLevelCrown}>
        <div className="academy-level-top">
          <span className="academy-level-code">{id}</span>
          {fresh && !locked && copy.newLabel && <NewBadge label={copy.newLabel} className="academy-level-new" />}
          {/* Rein dekoratives Relief als CSS-Inhalt, nicht als kontrastarmes Textelement. */}
          {!locked && <span className="academy-level-number" aria-hidden="true" data-number={String(index + 1).padStart(2, '0')} />}
        </div>
        <SitovLevelArt id={id} index={index} locked={locked} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="academy-level-bottom">
        {locked ? <span><Lock size={16} aria-hidden="true" />{copy.lockedHint}</span> : <>
          <span>{progress > 0 ? copy.continueLearning : copy.start}<ChevronRight size={17} aria-hidden="true" /></span>
          <span>{progress}%</span>
        </>}
      </div>
      {!locked && <div className="academy-level-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>}
    </>
  )

  if (locked) {
    return <SitovMotionStage className={styles.sitovStage}>
      <article className={cn('academy-level-card academy-level-locked', styles.sitovLevel)} data-sitov-surface="" data-locked="true" data-level={index % 3} aria-disabled="true">{content}</article>
    </SitovMotionStage>
  }
  return <SitovMotionStage className={styles.sitovStage}>
    <Link href={href} className={cn('academy-level-card', 'sl-glass', styles.sitovLevel)} data-sitov-surface="" data-locked="false" data-level={index % 3}>{content}</Link>
  </SitovMotionStage>
}
