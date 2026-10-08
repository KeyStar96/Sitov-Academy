'use client'

import PressableCard from '@/components/motion/PressableCard'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import { Languages } from 'lucide-react'
import { getTrainerLanguageCopy } from '@/lib/trainer-language-i18n'

export default function TrainerLanguageRequired({ lang }: { lang: string }) {
  const copy = getTrainerLanguageCopy(lang)
  return (
    <SitovMotionStage className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--foreground)] sm:p-8">
      <Languages size={32} aria-hidden="true" className="mb-4 text-[var(--violet)]" />
      <h2 className="text-xl font-bold sm:text-2xl">{copy.title}</h2>
      <p className="mt-3 max-w-3xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">{copy.message}</p>
      <PressableCard href={`/${lang}/dashboard/profile#language-settings`} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 py-3 text-base font-bold text-[var(--accent-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]">{copy.action}</PressableCard>
    </SitovMotionStage>
  )
}
