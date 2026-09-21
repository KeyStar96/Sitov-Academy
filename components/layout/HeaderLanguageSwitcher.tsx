'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { updateUiLanguage } from '@/app/actions/profile'
import { LOCALES, UI_LOCALE_ENDONYMS, toUiLocale, type UiLocale } from '@/lib/locale-routing'

/**
 * Kompakter Header-Sprachumschalter: 48px-Trigger mit Sprachkürzel, geöffnete
 * Liste mit Endonymen. Speichert `profiles.ui_language` und bleibt auf der Seite.
 */
export default function HeaderLanguageSwitcher({
  current,
  ariaLabel,
}: {
  current: string
  ariaLabel: string
}) {
  const pathname = usePathname()
  const currentLocale = toUiLocale(current)
  const formRef = useRef<HTMLFormElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isPending) {
      event.preventDefault()
      return
    }
    setIsPending(true)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <form ref={formRef} action={updateUiLanguage} onSubmit={handleSubmit}>
        <input type="hidden" name="next" value={pathname} />
        <button
          type="button"
          aria-label={`${ariaLabel}: ${UI_LOCALE_ENDONYMS[currentLocale]}`}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listId}
          disabled={isPending}
          onClick={() => setOpen(value => !value)}
          className="inline-flex h-12 min-w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          {isPending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : currentLocale.toUpperCase()}
        </button>
        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="absolute right-0 z-30 mt-2 min-w-[12rem] rounded-2xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            {LOCALES.map((locale: UiLocale) => (
              <li key={locale} role="none">
                <button
                  type="submit"
                  name="ui_language"
                  value={locale}
                  role="option"
                  aria-selected={locale === currentLocale}
                  className={`flex min-h-12 w-full items-center px-4 text-left text-sm font-bold focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent)] ${
                    locale === currentLocale
                      ? 'bg-[var(--accent)]/10 text-[var(--accent-text)]'
                      : 'text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {UI_LOCALE_ENDONYMS[locale]}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
    </div>
  )
}
