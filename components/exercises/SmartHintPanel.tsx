'use client'

import { useState } from 'react'
import { Info, Lightbulb } from 'lucide-react'
import type { ExerciseTranslator } from '@/lib/exercise-i18n'
import type { SmartHintDescriptor } from '@/lib/types/exercise'

interface SmartHintPanelProps {
  hint: SmartHintDescriptor
  t: ExerciseTranslator
}

function renderHintText(hint: SmartHintDescriptor, t: ExerciseTranslator): string {
  switch (hint.kind) {
    case 'custom':
      return hint.text
    case 'gender':
      return t('hint_gender', { article: hint.article })
    case 'noun':
      return t('hint_noun', { length: hint.length })
    case 'verb':
      return t('hint_verb', { length: hint.length })
    case 'first_letter':
      return t('hint_first_letter', { letter: hint.letter, length: hint.length })
  }
}

/**
 * Dezenter Hinweis nach zwei Fehlversuchen. Bewusst ruhig gestaltet: kein Rot,
 * keine Fehlermetaphorik – der Hinweis ist eine Hilfe, keine Bewertung.
 */
export default function SmartHintPanel({ hint, t }: SmartHintPanelProps) {
  const [revealed, setRevealed] = useState(false)

  if (!revealed) {
    return (
      <div className="mt-8 flex flex-col gap-4 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface-muted)] p-6">
        <button type="button" onClick={() => setRevealed(true)} className="academy-button academy-button-secondary w-full sm:w-auto self-start">
          <Info size={18} className="mr-2" />
          {t('hint_title')}
        </button>
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-8 flex items-start gap-4 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface-muted)] p-6"
    >
      <Lightbulb className="mt-1 h-8 w-8 shrink-0 text-[var(--violet)]" aria-hidden="true" />
      <div>
        <h4 className="mb-1 text-xl font-bold text-[var(--foreground)]">{t('hint_title')}</h4>
        <p className="text-xl leading-relaxed text-[var(--foreground)]">{renderHintText(hint, t)}</p>
      </div>
    </div>
  )
}
