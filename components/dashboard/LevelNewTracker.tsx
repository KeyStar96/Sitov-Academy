'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { markLearningSeen } from '@/app/actions/learning-new'
import { trainerKey } from '@/lib/learning-new'
import { modeFromPathname, MODE_TRAINERS, type LearningMode } from '@/lib/mode-targets'

/**
 * Meldet der Datenbank, was die Person geöffnet hat (Phase 6.1): das Niveau,
 * sobald eine seiner Seiten offen ist, und einen neuen Modus, sobald seine
 * Seite offen ist. Der erste Besuch eines Niveaus wird ebenfalls hier erfasst:
 * ab dann zählt später Veröffentlichtes als neu.
 *
 * Nichts davon geschieht beim bloßen Anzeigen einer Liste. Nach einer neuen
 * Quittung werden die Zähler (Startseite, Dock, untere Leiste) neu gelesen.
 * Ein Fehler bleibt still: Ein fehlendes Kennzeichen darf nie stören.
 */
export default function LevelNewTracker({ level, visit, levelNew, newModes }: {
  level: string
  /** Für dieses Niveau ist noch kein erster Besuch erfasst. */
  visit: boolean
  levelNew: boolean
  newModes: LearningMode[]
}) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const sent = useRef(new Set<string>())
  const mode = modeFromPathname(pathname)

  useEffect(() => {
    const work: Array<{ token: string; kind: 'level' | 'trainer'; key: string }> = []
    if ((visit || levelNew) && !sent.current.has(`level:${level}`)) work.push({ token: `level:${level}`, kind: 'level', key: level })
    if (mode && newModes.includes(mode) && !sent.current.has(`mode:${level}:${mode}`)) {
      work.push({ token: `mode:${level}:${mode}`, kind: 'trainer', key: trainerKey(level, MODE_TRAINERS[mode]) })
    }
    if (!work.length) return
    for (const item of work) sent.current.add(item.token)
    void Promise.all(work.map(item => markLearningSeen(item.kind, item.key)))
      .then(results => { if (results.some(result => result.marked)) router.refresh() })
      .catch(() => { /* still: ein fehlendes Kennzeichen darf nie stören */ })
  }, [level, visit, levelNew, mode, newModes, router])

  return null
}
