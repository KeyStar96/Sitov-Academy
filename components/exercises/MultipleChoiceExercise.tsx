'use client'

import { useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Info } from 'lucide-react'
import { useSolvedActionFocus } from '@/components/exercises/useSolvedActionFocus'
import type { ExerciseTranslator } from '@/lib/exercise-i18n'
import type { MultipleChoiceExercise as MultipleChoiceExerciseData } from '@/lib/types/exercise'
import { cn } from '@/lib/utils'

interface MultipleChoiceExerciseProps {
  exercise: MultipleChoiceExerciseData
  t: ExerciseTranslator
  onAttempt: (isCorrect: boolean, hintShown: boolean, answer: string) => void
  onNext: () => void
  nextLabel: string
  lang: string
}

function isSameOption(left: string, right: string): boolean {
  return left.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE') === right.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE')
}

/**
 * Multiple Choice im gleichen Zero-Error-Muster wie der Lückentext:
 * Eine falsche Auswahl wird ausgegraut, die Aufgabe bleibt offen.
 */
export default function MultipleChoiceExerciseCard({
  exercise,
  t,
  onAttempt,
  onNext,
  nextLabel,
  lang,
}: MultipleChoiceExerciseProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [excludedOptions, setExcludedOptions] = useState<readonly string[]>([])
  const [failedAttempts, setFailedAttempts] = useState(exercise.attempts)
  const [isSolved, setIsSolved] = useState(false)
  const [showRetryNotice, setShowRetryNotice] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const nextButtonRef = useSolvedActionFocus(isSolved)

  const localizedHint = exercise.hint ? (typeof exercise.hint === 'string' ? exercise.hint : (exercise.hint[lang] ?? exercise.hint.de)) : null
  const explanationObj = exercise.content.explanation
  const localizedExplanation = explanationObj ? (typeof explanationObj === 'string' ? explanationObj : (explanationObj[lang] ?? explanationObj.de)) : null

  const handleSelect = (option: string): void => {
    if (isSolved || excludedOptions.includes(option)) return
    setShowRetryNotice(false)
    setSelectedOption((current) => (current === option ? null : option))
  }

  const handleCheck = (): void => {
    if (!selectedOption || isSolved) return

    const isCorrect = isSameOption(selectedOption, exercise.content.correct_answer)
    onAttempt(isCorrect, Boolean(exercise.content.explanation && failedAttempts >= 2), selectedOption)

    if (isCorrect) {
      setIsSolved(true)
      setShowRetryNotice(false)
      return
    }

    setExcludedOptions((current) => [...current, selectedOption])
    setSelectedOption(null)
    setFailedAttempts((current) => current + 1)
    setShowRetryNotice(true)
  }

  return (
    <div className="p-5 sm:p-10">
      {exercise.content.instruction && <p className="mb-6 text-lg font-semibold leading-relaxed text-[var(--violet)]">{exercise.content.instruction}</p>}
      <h3 className="break-words text-xl font-bold leading-relaxed text-[var(--foreground)] sm:text-2xl">{exercise.content.question}</h3>

      <div className="mt-8 space-y-4">
        {exercise.content.options.map((option) => {
          const isExcluded = excludedOptions.includes(option)
          const isSelected = selectedOption === option
          const isCorrectAndSolved = isSolved && isSameOption(option, exercise.content.correct_answer)

          return (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              disabled={isExcluded || isSolved}
              aria-pressed={isSelected}
              aria-label={isExcluded ? t('chip_wrong_aria', { word: option }) : t('choose_word_aria', { word: option })}
              className={cn(
                'flex min-h-16 min-w-0 w-full items-center break-words [overflow-wrap:anywhere] rounded-2xl border-2 px-6 py-4 text-left text-xl font-medium transition-all focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]',
                isCorrectAndSolved && 'border-[var(--violet)] bg-[var(--surface-muted)] font-bold text-[var(--violet)]',
                !isCorrectAndSolved && isExcluded && 'cursor-not-allowed border-[var(--border)]  bg-[var(--surface-muted)]  text-[var(--muted)]  line-through',
                !isCorrectAndSolved && !isExcluded && isSelected && 'border-[var(--violet)] bg-[var(--violet)] text-[var(--surface)] shadow-lg',
                !isCorrectAndSolved && !isExcluded && !isSelected && 'border-[var(--border)]  bg-[var(--surface)]  text-[var(--foreground)]  hover:border-[var(--violet)]  hover:bg-[var(--surface-muted)] '
              )}
            >
              {option}
            </button>
          )
        })}
      </div>

      {showRetryNotice && !isSolved && (
        <div
          role="status"
          aria-live="polite"
          className="mt-8 flex items-start gap-4 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface-muted)] p-6"
        >
          <Info className="mt-1 h-8 w-8 shrink-0 text-[var(--violet)]" aria-hidden="true" />
          <div>
            <p className="text-xl font-bold text-[var(--foreground)]">{t('try_again')}</p>
            <p className="mt-1 text-lg leading-relaxed text-[var(--foreground)]">{t('try_again_detail')}</p>
          </div>
        </div>
      )}

      {localizedHint && failedAttempts > 0 && !isSolved && (
        <div className="mt-6 flex flex-col gap-4 rounded-r-2xl border-l-4 border-[var(--violet)] bg-[var(--surface-muted)] p-6">
          {!showHint ? (
            <button type="button" onClick={() => setShowHint(true)} className="academy-button academy-button-secondary w-full sm:w-auto self-start">
              <Info size={18} className="mr-2" />
              {t('hint_title')}
            </button>
          ) : (
            <div className="flex items-start gap-4">
              <AlertCircle className="mt-1 h-8 w-8 shrink-0 text-[var(--violet)]" aria-hidden="true" />
              <div>
                <h4 className="mb-1 text-xl font-bold text-[var(--foreground)]">{t('tip_mother_tongue')}</h4>
                <p className="text-lg leading-relaxed text-[var(--foreground)]">{localizedHint}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {localizedExplanation && (isSolved || failedAttempts >= 1) && <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5"><h4 className="text-lg font-semibold text-[var(--violet)]">{t('hint_title')}</h4><p className="mt-2 text-lg leading-relaxed text-[var(--foreground)]">{localizedExplanation}</p></div>}

      {isSolved && (
        <div
          role="status"
          aria-live="polite"
          className="mt-8 flex items-center gap-4 rounded-2xl border-2 border-[var(--violet)] bg-[var(--surface-muted)] p-6"
        >
          <CheckCircle2 className="h-9 w-9 shrink-0 text-[var(--violet)]" aria-hidden="true" />
          <p className="text-2xl font-bold text-[var(--foreground)]">{t('correct_well_done')}</p>
        </div>
      )}

      <div className="mt-10 flex flex-col sm:flex-row sm:justify-end">
        {isSolved ? (
          <button
            ref={nextButtonRef}
            type="button"
            onClick={onNext}
            className="inline-flex min-h-16 w-full scroll-mb-4 items-center justify-center gap-3 rounded-full bg-[var(--accent)] px-8 py-4 text-xl font-bold text-[var(--accent-foreground)] shadow-md transition-colors hover:opacity-90 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] sm:w-auto"
          >
            {nextLabel}
            <ArrowRight size={28} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCheck}
            disabled={!selectedOption}
            className="min-h-16 w-full rounded-full bg-[var(--violet)] px-8 py-4 text-xl font-bold text-[var(--surface)] shadow-md transition-colors hover:bg-[var(--violet)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] sm:w-auto"
          >
            {t('check_answer')}
          </button>
        )}
      </div>
    </div>
  )
}
