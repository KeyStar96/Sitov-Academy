import BrandLogo from '@/components/layout/BrandLogo'
import { getDictionary } from '@/lib/dictionary'
import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Gemeinsamer Rahmen der Auth-Seiten: Logo, Überschrift, Karte.
 *
 * Die Überschrift ist 24px groß (Geragogik-Vorgabe für Fragen und
 * Seitentitel), der Fließtext 18px. Das Logo verlinkt auf die Startseite,
 * damit ein versehentlicher Aufruf nicht in einer Sackgasse endet.
 */
export default async function AuthShell({
  lang,
  title,
  description,
  children,
}: {
  lang: string
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  const dict = await getDictionary(lang)
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--canvas)] px-4 py-12 pb-[max(3rem,env(safe-area-inset-bottom))] dark:bg-[var(--canvas)]">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex justify-center">
          <Link
            href={`/${lang}`}
            className="inline-flex min-h-14 items-center rounded-2xl px-4 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
          >
            <BrandLogo name={dict.academy.brand_name} descriptor={dict.academy.brand_descriptor} />
          </Link>
        </div>

        <div className="space-y-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8 dark:border-[var(--border)] dark:bg-[var(--surface)]">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
            {description && (
              <div className="text-lg text-slate-700 dark:text-slate-300">{description}</div>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
