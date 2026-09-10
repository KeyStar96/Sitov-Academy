'use client'

import { useState } from 'react'
import { Mic } from 'lucide-react'
import AudioRecorder from './AudioRecorder'
import {
  createPronunciationTranslator,
  type PronunciationTranslations,
} from '@/lib/pronunciation-i18n'

/** Zweiter Versuch nach erhaltenem Feedback – bewusst hinter einem Klick versteckt. */
export default function ResubmissionRecorder({
  parentId,
  currentAttempt = 1,
  level,
  translations,
}: {
  parentId: string
  currentAttempt?: number
  level?: string
  translations?: PronunciationTranslations
}) {
  const t = createPronunciationTranslator(translations ?? {})
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="mt-6 min-w-0 break-words border-t border-[var(--border)] pt-6">
      {!isOpen ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-lg text-[var(--muted)]">{t('resubmit_hint')}</p>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex min-h-14 min-w-[44px] max-w-full shrink-0 items-center justify-center gap-3 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-[var(--accent-foreground)] transition-colors hover:brightness-95 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <Mic size={22} aria-hidden="true" /> {t('resubmit_button')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-xl font-bold text-[var(--foreground)]">
              {t('attempt_label', { attempt: currentAttempt + 1 })}
            </h4>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="min-h-12 min-w-[44px] rounded-xl px-4 text-lg font-medium text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              {t('resubmit_cancel')}
            </button>
          </div>
          <AudioRecorder
            parentId={parentId}
            attemptNumber={currentAttempt + 1}
            level={level}
            translations={translations}
            compact
            onSubmitted={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
