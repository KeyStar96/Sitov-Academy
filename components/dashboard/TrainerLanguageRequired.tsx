'use client'

import Link from 'next/link'
import { Languages } from 'lucide-react'
import { getTrainerLanguageCopy } from '@/lib/trainer-language-i18n'

export default function TrainerLanguageRequired({ lang }: { lang: string }) {
  const copy = getTrainerLanguageCopy(lang)
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--foreground)] sm:p-8">
      <Languages size={32} aria-hidden="true" className="mb-4 text-[var(--violet)]" />
      <h2 className="text-xl font-bold sm:text-2xl">{copy.title}</h2>
      <p className="mt-3 max-w-3xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">{copy.message}</p>
      <Link href={`/${lang}/dashboard/profile#language-settings`} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-3 text-base font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]">{copy.action}</Link>
    </section>
  )
}
