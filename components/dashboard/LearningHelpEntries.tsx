import { studentTranslator } from '@/lib/student-ui-i18n'

/** Shared learning help on Home and in the mobile help sheet. */
export default function LearningHelpEntries({ lang }: { lang: string }) {
  const t = studentTranslator(lang)
  return (
    <div className="mt-5 grid gap-3">
      {(['path', 'carryover'] as const).map(topic => (
        <details key={topic} className="sl-card rounded-2xl px-4">
          <summary className="min-h-12 cursor-pointer py-3 text-lg font-semibold text-[var(--foreground)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-text)]">
            {t(`help_${topic}_title`)}
          </summary>
          <p className="pb-4 text-base leading-relaxed text-[var(--foreground)]">{t(`help_${topic}_text`)}</p>
        </details>
      ))}
    </div>
  )
}
