'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { setPronunciationMailPreference } from '@/app/actions/profile'
import { studentTranslator } from '@/lib/student-ui-i18n'

/**
 * Benachrichtigungen (Phase 6.2): Ein großer Schalter, sofort gespeichert.
 * Der Zustand steht als Wort neben dem Schalter, das Ergebnis als Meldung
 * darunter (Screenreader: `role="status"`). Wer die Mail nicht will, bekommt
 * keine — geprüft wird das in der Datenbank, nicht hier.
 */
export default function ProfileNotificationSettings({ lang, initial }: { lang: string; initial: boolean }) {
  const s = studentTranslator(lang)
  const [on, setOn] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<'saved' | 'error' | null>(null)

  async function toggle() {
    if (busy) return
    const next = !on
    setOn(next); setBusy(true); setMessage(null)
    try {
      const result = await setPronunciationMailPreference(next)
      if (!result.success) throw new Error('save_failed')
      setMessage('saved')
    } catch {
      setOn(!next); setMessage('error')
    } finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="notify-title" className="min-w-0 space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
      <h2 id="notify-title" className="break-words text-lg font-bold text-[var(--foreground)]">{s('settings_notifications')}</h2>
      <button type="button" role="switch" aria-checked={on} aria-busy={busy || undefined} disabled={busy} onClick={() => void toggle()}
        className="st-switch st-press" data-testid="notify-pronunciation">
        <span className="st-switch__track" aria-hidden="true">
          <span className="st-switch__thumb">{on && <Check size={16} strokeWidth={3} />}</span>
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="st-switch__label">{s('notify_pronunciation')}</span>
          <span className="st-switch__hint !text-base">{s(on ? 'notify_on' : 'notify_off')} · {s('notify_pronunciation_hint')}</span>
        </span>
      </button>
      <p role="status" aria-live="polite" className={`min-h-6 text-base font-semibold ${message === 'error' ? 'text-[var(--danger)]' : 'text-[var(--foreground)]'}`}>
        {message === 'saved' ? s('notify_saved') : message === 'error' ? s('notify_error') : ''}
      </p>
    </section>
  )
}
