'use client'

import { useState } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import { setMailPreference, type MailPreference } from '@/app/actions/profile'
import { studentTranslator } from '@/lib/student-ui-i18n'

type Preferences = Record<MailPreference, boolean>

const SWITCHES = [
  { id: 'pronunciation', label: 'notify_pronunciation', hint: 'notify_pronunciation_hint' },
  { id: 'new_content', label: 'notify_new_content', hint: 'notify_new_content_hint' },
  { id: 'reminders', label: 'notify_reminders', hint: 'notify_reminders_hint' },
] as const

/**
 * Benachrichtigungen: je optionaler Mail-Art ein großer Schalter, sofort
 * gespeichert (Lehrkraft-Antwort, neue Inhalte, Lern-Erinnerungen). Der
 * Zustand steht als Wort neben dem Schalter, das Ergebnis als Meldung darunter
 * (Screenreader: `role="status"`). Pflicht-Mails zu Konto, Registrierung und
 * Kursanmeldung haben keinen Schalter. Wer eine Mail nicht will, bekommt keine
 * — geprüft wird das in der Datenbank, beim Einreihen und beim Versand.
 */
export default function ProfileNotificationSettings({ lang, initial }: { lang: string; initial: Preferences }) {
  const s = studentTranslator(lang)
  const [on, setOn] = useState<Preferences>(initial)
  const [busy, setBusy] = useState<MailPreference | null>(null)
  const [message, setMessage] = useState<'saved' | 'error' | null>(null)

  async function toggle(id: MailPreference) {
    if (busy) return
    const next = !on[id]
    setOn(previous => ({ ...previous, [id]: next })); setBusy(id); setMessage(null)
    try {
      const result = await setMailPreference(id, next)
      if (!result.success) throw new Error('save_failed')
      setMessage('saved')
    } catch {
      setOn(previous => ({ ...previous, [id]: !next })); setMessage('error')
    } finally { setBusy(null) }
  }

  return (
    <section aria-labelledby="notify-title" className="min-w-0 space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
      <h2 id="notify-title" className="break-words text-lg font-bold text-[var(--foreground)]">{s('settings_notifications')}</h2>
      <ul className="grid gap-3">
        {SWITCHES.map(item => (
          <li key={item.id}>
            <button type="button" role="switch" aria-checked={on[item.id]} aria-busy={busy === item.id || undefined} disabled={busy !== null}
              onClick={() => void toggle(item.id)} className="st-switch st-press" data-testid={`notify-${item.id.replace('_', '-')}`}>
              <span className="st-switch__track" aria-hidden="true">
                <span className="st-switch__thumb">{on[item.id] && <Check size={16} strokeWidth={3} />}</span>
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="st-switch__label">{s(item.label)}</span>
                <span className="st-switch__hint !text-base">{s(on[item.id] ? 'notify_on' : 'notify_off')} · {s(item.hint)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="flex items-start gap-3 rounded-2xl bg-[var(--surface-muted)] p-3 text-base leading-snug text-[var(--muted)]" data-testid="notify-required">
        <ShieldCheck size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--success)]" />
        <span>{s('notify_required')}</span>
      </p>
      <p role="status" aria-live="polite" className={`min-h-6 text-base font-semibold ${message === 'error' ? 'text-[var(--danger)]' : 'text-[var(--foreground)]'}`}>
        {message === 'saved' ? s('notify_saved') : message === 'error' ? s('notify_error') : ''}
      </p>
    </section>
  )
}
