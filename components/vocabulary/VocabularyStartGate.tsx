'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { beginVocabularyLevel, setVocabularyCarryover } from '@/app/actions/vocabulary'
import BottomSheet from '@/components/ui/BottomSheet'
import { carryoverTranslator } from '@/lib/vocabulary-carryover-i18n'
import { studentTranslator } from '@/lib/student-ui-i18n'
import type { VocabularyCarryoverSummary } from '@/lib/types/vocabulary'
import { announceVocabularyCarryoverChange } from '@/lib/learning-reset-events'

/** Mounted only after starting a round or opening an assessment, never while browsing. */
export default function VocabularyStartGate({ level, lang, learnerId, children, onReady }: {
  level: string
  lang: string
  learnerId: string | null
  children: ReactNode
  onReady?: () => Promise<void>
}) {
  const t = carryoverTranslator(lang)
  const s = studentTranslator(lang)
  const mounted = useRef(true)
  const started = useRef(false)
  const readyCallback = useRef(onReady)
  readyCallback.current = onReady
  const [state, setState] = useState<VocabularyCarryoverSummary | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const actions = useRef<HTMLDivElement>(null)
  // The decision sheet owns keyboard focus until either answer is saved.
  useEffect(() => {
    if (!state?.promptRequired || ready) return
    function containFocus(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      const dialog = actions.current?.closest('[role="dialog"]')
      const buttons = Array.from(actions.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      const first = buttons[0]
      const last = buttons.at(-1)
      if (!first || !last) { event.preventDefault(); return }
      if (!dialog?.contains(document.activeElement) || document.activeElement === dialog || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus()
      } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', containFocus)
    return () => document.removeEventListener('keydown', containFocus)
  }, [state?.promptRequired, ready])

  async function complete() {
    await readyCallback.current?.()
    if (mounted.current) setReady(true)
  }
  async function begin() {
    setBusy(true)
    setFailed(false)
    try {
      const result = await beginVocabularyLevel(level, learnerId ?? undefined)
      if (!result.success) throw new Error('carryover_begin_failed')
      if (!mounted.current) return
      setState(result.carryover)
      if (!result.carryover.promptRequired) await complete()
    } catch { if (mounted.current) setFailed(true) }
    finally { if (mounted.current) setBusy(false) }
  }
  useEffect(() => {
    mounted.current = true
    if (!started.current) { started.current = true; void begin() }
    return () => { mounted.current = false }
  }, [])

  async function decide(enabled: boolean) {
    if (busy) return
    setBusy(true)
    setFailed(false)
    try {
      const result = await setVocabularyCarryover(level, enabled, learnerId ?? undefined)
      if (!result.success) throw new Error('carryover_save_failed')
      if (learnerId) announceVocabularyCarryoverChange(learnerId)
      if (!mounted.current) return
      setState(result.carryover)
      await complete()
    } catch { if (mounted.current) setFailed(true) }
    finally { if (mounted.current) setBusy(false) }
  }

  if (ready) return <>{children}</>
  const question = state?.promptRequired === true
  return <>
    <div className="mx-auto max-w-xl space-y-4 py-8 text-center">
      {!question && <p role={failed ? 'alert' : 'status'} className="text-lg">{t(failed ? 'error' : 'loading')}</p>}
      {!question && failed && <button type="button" disabled={busy} onClick={() => void begin()} className="st-button st-button--primary min-h-12">{t('retry')}</button>}
      <Link href={`/${lang}/dashboard/level/${encodeURIComponent(level)}/vocabulary`} className="st-button st-button--soft min-h-12">{s('round_pause')}</Link>
    </div>
    <BottomSheet open={question} onClose={() => undefined} dismissible={false} closeLabel={s('close')}
      title={t('question', { count: state?.total ?? 0, levels: state?.byLevel.map(origin => origin.level).join(', ') ?? '' })}>
      <p className="text-lg text-[var(--muted)]">{t('hint')}</p>
      <div ref={actions} className="mt-6 grid grid-cols-2 gap-3">
        <button type="button" disabled={busy} onClick={() => void decide(false)} className="st-button st-button--soft min-h-12">{t('decline')}</button>
        <button type="button" disabled={busy} onClick={() => void decide(true)} className="st-button st-button--primary min-h-12">{t('accept')}</button>
      </div>
      {failed && <p role="alert" className="st-path__error mt-4">{t('error')}</p>}
    </BottomSheet>
  </>
}
