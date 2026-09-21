'use client'

import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * Formular für alle Auth-Seiten.
 *
 * Bewusst ein einziger Baustein für Anmeldung, Registrierung, Passwort-Reset
 * und Passwortvergabe: So sind Schriftgrößen, Feldhöhen und Ladeverhalten auf
 * allen vier Seiten identisch. Für die Zielgruppe zählt Wiedererkennbarkeit
 * mehr als seitenspezifische Gestaltung.
 *
 * Geragogik-Maße: Beschriftungen 18px, Eingabefelder und Schaltflächen
 * mindestens 56px hoch, sichtbarer Fokusrahmen, keine Zeitbegrenzung.
 *
 * Der lokale Submit-State sperrt wiederholte Einsendungen sofort.
 */

export interface AuthFormOption {
  value: string
  label: string
}

export interface AuthFormField {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'select'
  placeholder?: string
  hint?: string
  autoComplete?: string
  minLength?: number
  options?: readonly AuthFormOption[]
}

const FIELD_CLASSES =
  'block min-h-14 w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-lg text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--violet)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]    '

export default function AuthForm({
  action,
  fields,
  submitLabel,
  pendingLabel,
  lang,
  hiddenFields = {},
}: {
  action: (formData: FormData) => Promise<void>
  fields: readonly AuthFormField[]
  submitLabel: string
  pendingLabel: string
  lang: string
  hiddenFields?: Readonly<Record<string, string>>
}) {
  const [isPending, setIsPending] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Doppelte Einsendungen abfangen: Ein zweiter Klick würde bei der
    // Registrierung eine zweite E-Mail auslösen.
    if (isPending) {
      event.preventDefault()
      return
    }
    setIsPending(true)
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="lang" value={lang} />
      {Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {fields.map(field => {
        const hintId = field.hint ? `${field.name}-hint` : undefined

        return (
          <div key={field.name} className="space-y-2">
            <label
              htmlFor={field.name}
              className="block text-lg font-semibold text-[var(--foreground)]"
            >
              {field.label}
            </label>

            {field.type === 'select' ? (
              <select
                id={field.name}
                name={field.name}
                required
                defaultValue=""
                aria-describedby={hintId}
                className={FIELD_CLASSES}
              >
                <option value="" disabled>
                  {field.placeholder}
                </option>
                {field.options?.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={field.name}
                name={field.name}
                type={field.type}
                required
                autoComplete={field.autoComplete}
                minLength={field.minLength}
                placeholder={field.placeholder}
                aria-describedby={hintId}
                className={FIELD_CLASSES}
              />
            )}

            {field.hint && (
              <p id={hintId} className="text-base text-[var(--muted)]">
                {field.hint}
              </p>
            )}
          </div>
        )
      })}

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[var(--accent-strong)] px-6 text-xl font-bold text-[var(--accent-foreground)] shadow-md transition-colors hover:bg-[var(--accent-strong-hover)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] disabled:cursor-not-allowed disabled:opacity-80"
      >
        {isPending && <Loader2 size={24} className="animate-spin" aria-hidden="true" />}
        {isPending ? pendingLabel : submitLabel}
      </button>
    </form>
  )
}
