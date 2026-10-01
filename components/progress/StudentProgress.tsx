'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Target } from 'lucide-react'
import { getMyLearningProgress } from '@/app/actions/learning-progress'
import { PROGRESS_RANGES, type LearningProgress, type ProgressRange } from '@/lib/learning-progress'
import { learningProgressCopy } from '@/lib/learning-progress-i18n'
import type { VocabularyTranslations } from '@/lib/vocabulary-i18n'
import LearningProgressView from './LearningProgressView'

/**
 * „Mein Fortschritt": dieselbe Auswertung wie für die Lehrkraft, im
 * Schüler-Design. Zeitraum und Niveau wechseln ohne Neuladen der Seite; die
 * bisherigen Werte bleiben sichtbar, bis die neuen da sind.
 */
export default function StudentProgress({ initial, levels, lang, translations, focusLevel }: {
  initial: LearningProgress | null
  /** Freigeschaltete Niveaus (Filter). */
  levels: readonly string[]
  lang: string
  translations: VocabularyTranslations
  /** Niveau, dessen Problemwörter-Training der Knopf öffnet; `null`: kein Vokabeltrainer (z. B. Deutsch als Oberfläche). */
  focusLevel: string | null
}) {
  const t = learningProgressCopy(lang)
  const [days, setDays] = useState<ProgressRange>(initial?.days === 7 || initial?.days === 90 ? initial.days : 30)
  const [level, setLevel] = useState('')
  const [progress, setProgress] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(initial === null)
  // Nur die jüngste Anfrage darf die Anzeige ändern.
  const request = useRef(0)
  async function load(nextDays: ProgressRange, nextLevel: string) {
    const id = ++request.current
    setDays(nextDays); setLevel(nextLevel); setLoading(true); setFailed(false)
    try {
      const result = await getMyLearningProgress({ level: nextLevel || null, days: nextDays })
      if (id !== request.current) return
      if (result.success) setProgress(result.data)
      else setFailed(true)
    } catch { if (id === request.current) setFailed(true) }
    finally { if (id === request.current) setLoading(false) }
  }
  const target = level || focusLevel
  const focusAction = target ? <Link href={`/${lang}/dashboard/level/${encodeURIComponent(target)}/vocabulary/focus`} className="st-link-pill st-press"><Target size={18} aria-hidden="true" />{t('focus_cta')}</Link> : undefined
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-bold text-[var(--muted)]">{t('range')}</legend>
        <div className="st-segment" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {PROGRESS_RANGES.map(range => <button key={range} type="button" className="st-segment__option st-press rounded-[.95rem]" aria-pressed={days === range}
            style={days === range ? { background: 'var(--surface)', boxShadow: 'var(--shadow-sm)' } : undefined} onClick={() => void load(range, level)}>{t('range_days', { count: range })}</button>)}
        </div>
      </fieldset>
      {levels.length > 1 && <label className="block min-w-0 sm:w-56">
        <span className="mb-2 block text-sm font-bold text-[var(--muted)]">{t('level')}</span>
        <select className="min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base font-semibold text-[var(--foreground)]" value={level} onChange={event => void load(days, event.target.value)}>
          <option value="">{t('all_levels')}</option>{levels.map(code => <option key={code} value={code}>{code}</option>)}
        </select>
      </label>}
    </div>
    <div aria-live="polite" aria-busy={loading}>
      {loading && !progress && <p role="status" className="text-base text-[var(--muted)]">{t('loading')}</p>}
      {failed && <div role="alert" className="st-empty flex flex-wrap items-center justify-between gap-3"><span>{t('failed')}</span>
        <button type="button" className="st-button st-button--soft st-press" onClick={() => void load(days, level)}>{t('retry')}</button></div>}
    </div>
    {progress && <div className={loading ? 'opacity-60 transition-opacity motion-reduce:transition-none' : 'transition-opacity motion-reduce:transition-none'}>
      <LearningProgressView progress={progress} lang={lang} skin="student" translations={translations} audience="student" focusAction={focusAction} />
    </div>}
  </div>
}
