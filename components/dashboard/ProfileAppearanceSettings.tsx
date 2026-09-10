'use client'

import { useId } from 'react'
import { Contrast } from 'lucide-react'
import AppearanceOptions from '@/components/layout/AppearanceOptions'
import { useAppearanceCopy } from '@/components/layout/AppearanceProvider'

export default function ProfileAppearanceSettings() {
  const copy = useAppearanceCopy()
  const id = useId()
  return <section aria-labelledby={id} className="academy-readability-card min-w-0 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5">
    <div className="mb-5 flex min-w-0 items-start gap-3">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--violet)]"><Contrast size={24} aria-hidden="true" /></span>
      <div className="min-w-0"><h2 id={id} className="text-xl font-bold text-[var(--foreground)]">{copy.title}</h2><p className="mt-2 text-base leading-relaxed text-[var(--muted)]">{copy.description}</p></div>
    </div>
    <AppearanceOptions />
  </section>
}
