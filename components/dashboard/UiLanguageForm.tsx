'use client'

import { useRef, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { updateUiLanguage } from '@/app/actions/profile'

export interface UiLanguageOption {
  value: string
  label: string
}

/**
 * Sprachumschalter im Profil: Der Nutzer kann die Oberflächensprache jederzeit
 * manuell ändern. Bei Auswahl wird das Formular automatisch abgeschickt
 * (progressive enhancement); die Schaltfläche bleibt als Fallback ohne
 * JavaScript sichtbar und bedienbar.
 *
 * Geragogik/Barrierefreiheit: großes Bedienelement (min. 56px), sichtbarer
 * Fokusrahmen, klare Beschriftung.
 */
export default function UiLanguageForm({
  current,
  options,
  ariaLabel,
  saveLabel,
}: {
  current: string
  options: readonly UiLanguageOption[]
  ariaLabel: string
  saveLabel: string
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, setIsPending] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isPending) {
      event.preventDefault()
      return
    }
    setIsPending(true)
  }

  return (
    <form
      ref={formRef}
      action={updateUiLanguage}
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
    >
      <select
        name="ui_language"
        defaultValue={current}
        aria-label={ariaLabel}
        disabled={isPending}
        onChange={() => formRef.current?.requestSubmit()}
        className="block min-h-14 w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-lg text-[var(--foreground)] focus:border-[#FF5C00] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] disabled:opacity-70"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--violet)] px-6 py-3 text-lg font-bold text-[var(--surface)] shadow-md transition-colors hover:bg-[var(--violet)] active:bg-[var(--violet)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] disabled:cursor-not-allowed disabled:opacity-80"
      >
        {isPending && <Loader2 size={20} className="animate-spin" aria-hidden="true" />}
        {saveLabel}
      </button>
    </form>
  )
}
