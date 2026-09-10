'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { BookOpenCheck, CloudOff, PartyPopper } from 'lucide-react'
import FillInBlankExerciseCard from '@/components/exercises/FillInBlankExercise'
import MultipleChoiceExerciseCard from '@/components/exercises/MultipleChoiceExercise'
import { finishExerciseSession, recordExerciseAttempt } from '@/app/actions/exercises'
import { createExerciseTranslator, type ExerciseTranslations } from '@/lib/exercise-i18n'
import type { StudentExercise } from '@/lib/types/exercise'

interface ExerciseClientProps {
  exercises: StudentExercise[]
  translations?: ExerciseTranslations
  lang: string
  level: string
}

export default function ExerciseClient({
  exercises,
  translations = {},
  lang,
  level,
}: ExerciseClientProps) {
  /**
   * Bewusst als Snapshot: Würde die Liste mitten im Durchlauf aus dem Server
   * neu einfliegen, verschöben sich die Indizes und der Lernende verlöre den
   * Kontext.
   */
  const [session] = useState<StudentExercise[]>(exercises)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [saveFailed, setSaveFailed] = useState(false)

  const t = useMemo(() => createExerciseTranslator(translations), [translations])
  const currentExercise = session[currentIndex]

  const handleAttempt = useCallback(
    (exerciseId: string, isCorrect: boolean, hintShown: boolean): void => {
      void recordExerciseAttempt({ exerciseId, isCorrect, hintShown })
        .then((result) => setSaveFailed(!result.success))
        .catch(() => setSaveFailed(true))
    },
    []
  )

  const handleNext = useCallback((): void => {
    const nextIndex = currentIndex + 1
    setCurrentIndex(nextIndex)

    if (nextIndex >= session.length) {
      void finishExerciseSession(level).catch(() => {
        // Fortschrittsanzeige aktualisiert sich dann erst beim nächsten Aufruf.
      })
    }
  }, [currentIndex, level, session.length])

  if (session.length === 0) {
    return (
      <div className="rounded-3xl bg-[var(--surface)] p-6 text-center shadow-sm ring-1 ring-[var(--border)] sm:p-12">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--surface-muted)]">
          <BookOpenCheck className="h-10 w-10 text-[var(--violet)]" aria-hidden="true" />
        </div>
        <h2 className="text-3xl font-bold text-[var(--foreground)]">{t('no_exercises')}</h2>
        <p className="mx-auto mt-3 max-w-lg text-xl text-[var(--muted)]">{t('no_exercises_hint')}</p>
        <Link
          href={`/${lang}/dashboard/level/${encodeURIComponent(level)}`}
          className="mt-8 inline-flex min-h-16 items-center rounded-2xl bg-[var(--violet)] px-8 py-4 text-xl font-bold text-[var(--surface)] shadow-md transition-colors hover:bg-[var(--violet)]"
        >
          {t('back_to_level')}
        </Link>
      </div>
    )
  }

  if (!currentExercise) {
    return (
      <div className="rounded-3xl border-2 border-green-200 bg-green-50 p-6 text-center shadow-sm sm:p-12">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <PartyPopper className="h-10 w-10 text-green-600" aria-hidden="true" />
        </div>
        <h2 className="text-3xl font-bold text-green-900">{t('great')}</h2>
        <p className="mt-3 text-xl text-green-800">{t('all_completed')}</p>
        <Link
          href={`/${lang}/dashboard/level/${encodeURIComponent(level)}`}
          className="mt-8 inline-flex min-h-16 items-center rounded-2xl bg-green-700 px-8 py-4 text-xl font-bold text-white shadow-md transition-colors hover:bg-green-600"
        >
          {t('back_to_level')}
        </Link>
      </div>
    )
  }

  const nextLabel = currentIndex + 1 >= session.length ? t('great') : t('next_exercise')
  const progressPercent = Math.round((currentIndex / session.length) * 100)

  return (
    <div className="overflow-hidden rounded-3xl bg-[var(--surface)] shadow-lg ring-1 ring-[var(--border)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-5 text-[var(--foreground)] sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <span className="break-words text-lg font-medium opacity-90">
            {currentExercise.lesson} • {currentExercise.topic}
          </span>
          <span className="text-lg font-bold">
            {t('progress_label', { current: currentIndex + 1, total: session.length })}
          </span>
        </div>
        {/* Ruhige Fortschrittsanzeige – kein Timer, keine Punktejagd. */}
        <div
          className="mt-4 h-3 w-full overflow-hidden rounded-full bg-[var(--border)]"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('completed_count')}
        >
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {currentExercise.type === 'fill_in_blank' ? (
        <FillInBlankExerciseCard
          key={currentExercise.id}
          exercise={currentExercise}
          t={t}
          nextLabel={nextLabel}
          onAttempt={(isCorrect, hintShown) => handleAttempt(currentExercise.id, isCorrect, hintShown)}
          onNext={handleNext}
        />
      ) : (
        <MultipleChoiceExerciseCard
          key={currentExercise.id}
          exercise={currentExercise}
          t={t}
          nextLabel={nextLabel}
          onAttempt={(isCorrect, hintShown) => handleAttempt(currentExercise.id, isCorrect, hintShown)}
          onNext={handleNext}
        />
      )}

      {/* Graceful Degradation: Der Durchlauf bleibt nutzbar, auch wenn das
          Speichern des Fortschritts scheitert. */}
      {saveFailed && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 border-t border-[var(--border)] bg-[var(--surface-muted)] px-6 py-4 sm:px-10"
        >
          <CloudOff className="h-6 w-6 shrink-0 text-[var(--muted)]" aria-hidden="true" />
          <p className="text-lg text-[var(--muted)]">{t('error_description')}</p>
        </div>
      )}
    </div>
  )
}
