'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clock, Inbox, MessageSquare, Mic, RotateCcw, Sparkles } from 'lucide-react'
import { markFeedbackSeen } from '@/app/actions/feedback'
import {
  createPronunciationTranslator,
  type PronunciationTranslations,
} from '@/lib/pronunciation-i18n'
import type { StudentSubmission } from '@/lib/types/feedback'
import ResubmissionRecorder from '@/components/audio/ResubmissionRecorder'
import WaveformPlayer from '@/components/audio/WaveformPlayer'

/**
 * Verlauf der eigenen Einreichungen.
 *
 * Client-Komponente, weil sie beim Öffnen der Seite das Feedback als gelesen
 * markiert. Die „Neu"-Markierung bleibt danach für diesen Seitenaufruf
 * sichtbar, damit der Hinweis nicht unter den Augen des Lernenden verschwindet.
 */
export default function SubmissionHistory({
  submissions,
  translations,
  lang,
  level,
}: {
  submissions: StudentSubmission[]
  translations: PronunciationTranslations
  lang: string
  level: string
}) {
  const t = createPronunciationTranslator(translations)

  const [highlightedIds] = useState<ReadonlySet<string>>(
    () => new Set(submissions.filter((entry) => entry.hasUnseenFeedback).map((entry) => entry.id))
  )
  const markedRef = useRef(false)

  useEffect(() => {
    if (markedRef.current || highlightedIds.size === 0) return
    markedRef.current = true

    void (async () => {
      for (const submissionId of highlightedIds) {
        await markFeedbackSeen(submissionId)
      }
    })()
  }, [highlightedIds])

  if (submissions.length === 0) {
    return (
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center sm:p-12">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--surface-muted)]">
          <Inbox className="h-10 w-10 text-[var(--muted)]" aria-hidden="true" />
        </div>
        <p className="text-xl font-bold text-[var(--foreground)]">{t('history_empty')}</p>
        <p className="mt-2 text-lg text-[var(--muted)]">{t('history_empty_hint')}</p>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-4 break-words">
      {submissions.map((submission) => {
        const feedback = submission.teacher_feedback[0]
        const isHighlighted = highlightedIds.has(submission.id)

        return (
          <div
            key={submission.id}
            className={`rounded-3xl border bg-[var(--surface)] p-4 shadow-sm transition-colors sm:p-6 ${
              isHighlighted
                ? 'border-[var(--accent)] ring-2 ring-[color-mix(in_srgb,var(--accent)_20%,transparent)]'
                : 'border-[var(--border)]'
            }`}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-base font-medium text-[var(--muted)]">
                {submission.created_at
                  ? new Date(submission.created_at).toLocaleDateString(lang, {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {isHighlighted && (
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-base font-semibold text-[var(--accent-foreground)]">
                    <Sparkles size={18} aria-hidden="true" /> {t('new_badge')}
                  </span>
                )}
                {submission.attempt_number > 1 && (
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--surface-muted)] px-4 text-base font-semibold text-[var(--foreground)]">
                    <RotateCcw size={18} aria-hidden="true" />{' '}
                    {t('attempt_label', { attempt: submission.attempt_number })}
                  </span>
                )}
                {submission.status === 'reviewed' ? (
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] px-4 text-base font-semibold text-[var(--success)]">
                    <CheckCircle2 size={18} aria-hidden="true" /> {t('status_reviewed')}
                  </span>
                ) : (
                  <span className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--surface-muted)] px-4 text-base font-semibold text-[var(--muted)]">
                    <Clock size={18} aria-hidden="true" /> {t('status_pending')}
                  </span>
                )}
              </div>
            </div>

            <WaveformPlayer src={submission.content_url} t={t} label={t('your_recording')} />

            {feedback && (
              <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 sm:p-6">
                <div className="mb-3 flex items-center gap-3 text-xl font-bold text-[var(--foreground)]">
                  <MessageSquare size={24} className="shrink-0 text-[var(--accent)]" aria-hidden="true" />
                  {t('teacher_feedback')}
                </div>

                {feedback.feedback_text && (
                  <p className="mb-4 text-lg leading-relaxed text-[var(--foreground)]">
                    {feedback.feedback_text}
                  </p>
                )}

                {feedback.feedback_audio_url && (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
                    <div className="mb-3 flex items-center gap-2 text-base font-bold text-[var(--accent)]">
                      <Mic size={20} aria-hidden="true" /> {t('voice_message')}
                    </div>
                    <WaveformPlayer src={feedback.feedback_audio_url} t={t} />
                  </div>
                )}
              </div>
            )}

            {submission.status === 'reviewed' && !submission.hasResubmission && (
              <ResubmissionRecorder
                parentId={submission.id}
                currentAttempt={submission.attempt_number}
                level={level}
                translations={translations}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
