import Link from 'next/link'
import { ChevronRight, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LevelCardCopy {
  /** Sichtbarer Text der Aktion, abhängig davon, ob schon Fortschritt besteht. */
  start: string
  continueLearning: string
  lockedHint: string
}

/**
 * Eine Niveau-Kachel der Dashboard-Übersicht.
 *
 * Trägt dieselbe Bildsprache wie die Fächer des Karteikastens: Glasfläche, das
 * Niveau-Kürzel als getöntes Marken-Badge, die laufende Nummer als Relief
 * dahinter und der Fortschritt als Band an der Unterkante.
 *
 * Ein gesperrtes Niveau ist bewusst kein Link, sondern ein `article` — es gibt
 * nichts zu öffnen, und ein toter Link wäre für Tastatur und Screenreader
 * schlicht eine Sackgasse.
 */
export default function LevelCard({ id, title, description, index, href, locked, progress, copy }: {
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
}) {
  const content = (
    <>
      <div className="academy-level-top">
        <span className="academy-level-code">{id}</span>
        {locked
          ? <Lock size={18} aria-hidden="true" />
          // Rein dekoratives Relief: als CSS-Inhalt, nicht als Text (sonst wertet axe
          // die absichtlich blasse Zahl als zu kontrastarmen Text).
          : <span className="academy-level-number" aria-hidden="true" data-number={String(index + 1).padStart(2, '0')} />}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="academy-level-bottom">
        {locked ? <span>{copy.lockedHint}</span> : <>
          <span>{progress > 0 ? copy.continueLearning : copy.start}<ChevronRight size={17} aria-hidden="true" /></span>
          <span>{progress}%</span>
        </>}
      </div>
      {!locked && <div className="academy-level-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>}
    </>
  )

  if (locked) {
    return <article className="academy-level-card academy-level-locked" aria-disabled="true">{content}</article>
  }
  return <Link href={href} className={cn('academy-level-card', 'sl-glass')}>{content}</Link>
}
