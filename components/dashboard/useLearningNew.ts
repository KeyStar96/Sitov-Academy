'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { markLearningSeen } from '@/app/actions/learning-new'
import type { LearningNewItems, LearningSeenKind } from '@/lib/learning-new'

/**
 * „Neu" an einzelnen Kacheln und Karten (Phase 6.1). Die Seite übergibt, was
 * die Datenbank für dieses Niveau als neu meldet; das Öffnen eines Objekts
 * meldet die Quittung zurück und nimmt das Kennzeichen sofort weg.
 *
 * `mark` ruft die Datenbank nur für Objekte, die gerade neu sind. Mit
 * `refresh: false` (mitten in einer Übung) werden die Zähler in Dock und
 * Startseite erst bei `flush()` neu gelesen, damit nichts nachlädt, während
 * jemand antwortet. Fehler bleiben still: ein fehlendes Kennzeichen darf nie stören.
 */
export function useLearningNew(initial: LearningNewItems | undefined) {
  const router = useRouter()
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set())
  const dirty = useRef(false)
  const sent = useRef(new Set<string>())
  const known = useMemo(() => {
    const set = new Set<string>()
    for (const [kind, keys] of Object.entries(initial ?? {})) for (const key of keys ?? []) set.add(`${kind}:${key}`)
    return set
  }, [initial])

  const isNew = useCallback((kind: LearningSeenKind, key: string | null | undefined) => {
    if (!key) return false
    const token = `${kind}:${key}`
    return known.has(token) && !seen.has(token)
  }, [known, seen])

  const mark = useCallback((kind: LearningSeenKind, key: string | null | undefined, options: { refresh?: boolean } = {}) => {
    if (!key) return
    const token = `${kind}:${key}`
    if (!known.has(token) || sent.current.has(token)) return
    sent.current.add(token)
    setSeen(previous => new Set(previous).add(token))
    void markLearningSeen(kind, key).then(result => {
      if (!result.marked) return
      if (options.refresh === false) dirty.current = true
      else router.refresh()
    }).catch(() => { /* still */ })
  }, [known, router])

  const flush = useCallback(() => {
    if (!dirty.current) return
    dirty.current = false
    router.refresh()
  }, [router])

  return { isNew, mark, flush }
}
