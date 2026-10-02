'use client'

import { useState } from 'react'
import { Check, Flame } from 'lucide-react'
import { setDailyQuestEnabled } from '@/app/actions/daily-quests'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'
import type { DailyQuestStatus } from '@/lib/daily-quest-contract'

export default function ProfileDailyQuestSettings({ lang, initial }: { lang: string; initial: DailyQuestStatus | null }) {
  const copy = getDailyQuestCopy(lang)
  const [status, setStatus] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<'saved' | 'error' | null>(null)

  async function toggle() {
    if (busy || !status) return
    setBusy(true); setMessage(null)
    try {
      const result = await setDailyQuestEnabled(!status.enabled)
      if (result.error || !result.data) { setMessage('error'); return }
      setStatus(result.data); setMessage('saved')
    } catch { setMessage('error') }
    finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="daily-quest-settings-title" className="min-w-0 space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
      <h2 id="daily-quest-settings-title" className="text-lg font-bold text-[var(--foreground)]">{copy.settingsTitle}</h2>
      <p className="text-base leading-relaxed text-[var(--muted)]">{copy.settingsDescription}</p>
      {status ? <>
        <button type="button" role="switch" aria-checked={status.enabled} aria-busy={busy || undefined} disabled={busy}
          onClick={() => void toggle()} className="st-switch st-press" data-testid="daily-quest-preference">
          <span className="st-switch__track" aria-hidden="true"><span className="st-switch__thumb">{status.enabled && <Check size={16} strokeWidth={3} />}</span></span>
          <span className="flex min-w-0 flex-col"><span className="st-switch__label">{copy.settingsSwitch}</span>
            <span className="st-switch__hint !text-base">{busy ? copy.saving : status.enabled ? copy.settingsOn : copy.settingsOff}</span></span>
        </button>
        <p className="flex flex-wrap items-center gap-2 text-base text-[var(--foreground)]"><Flame size={22} aria-hidden="true" />
          <span>{status.streak.current} {copy.streakDays} · {copy.longestStreak}: {status.streak.longest}</span>
        </p>
      </> : <p className="text-base text-[var(--muted)]">{copy.settingsUnavailable}</p>}
      <p role="status" aria-live="polite" className={`min-h-6 text-base font-semibold ${message === 'error' ? 'text-[var(--danger)]' : 'text-[var(--foreground)]'}`}>
        {message === 'saved' ? copy.settingsSaved : message === 'error' ? copy.settingsError : ''}
      </p>
    </section>
  )
}
