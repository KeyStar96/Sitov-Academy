'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LOCALES, UI_LOCALE_ENDONYMS, toUiLocale, withUiLocale } from '@/lib/locale-routing'

/**
 * Sichtbare Sprachwahl auf Anmelden/Registrieren: Die Seitensprache wird bei
 * der Registrierung als Oberflächensprache gespeichert — wer auf der falschen
 * Sprache landet, soll sie vorher umstellen können, statt den Browser
 * übersetzen zu lassen.
 */
export default function AuthLanguageSelect({ lang, label }: { lang: string; label: string }) {
  const router = useRouter()
  const pathname = usePathname()
  return (
    <label className="inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select className="academy-language" value={toUiLocale(lang)}
        onChange={event => router.push(withUiLocale(pathname, toUiLocale(event.target.value)))}>
        {LOCALES.map(locale => <option key={locale} value={locale}>{UI_LOCALE_ENDONYMS[locale]}</option>)}
      </select>
    </label>
  )
}
