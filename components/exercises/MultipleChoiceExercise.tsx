'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Info } from 'lucide-react'
import { useSolvedActionFocus } from '@/components/exercises/useSolvedActionFocus'
import { ArticleColored, articleWord } from '@/components/exercises/GrammarAids'
import { articleColorClass } from '@/lib/vocabulary-ui'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import type { ExerciseTranslator } from '@/lib/exercise-i18n'
import type { ConfirmedExerciseAttempt, MultipleChoiceExercise as MultipleChoiceExerciseData } from '@/lib/types/exercise'
import { cn } from '@/lib/utils'
import type { SoftErrorReason } from '@/lib/answer-grading'
import SoftErrorBadge, { OrthographyNote } from '@/components/exercises/SoftErrorBadge'

interface MultipleChoiceExerciseProps {
  exercise: MultipleChoiceExerciseData
  t: ExerciseTranslator
  onAttempt: (hintShown: boolean, answer: string) => void
  attempt?: ConfirmedExerciseAttempt
  submitting: boolean
  softErrorTranslations?: Partial<Record<SoftErrorReason, string>>
  onNext: () => void
  nextLabel: string
  lang: string
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
  attempt,
  submitting,
  softErrorTranslations,
}: MultipleChoiceExerciseProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [excludedOptions, setExcludedOptions] = useState<readonly string[]>([])
  const [failedAttempts, setFailedAttempts] = useState(exercise.attempts)
  const isSolved = attempt?.result.isCorrect === true
  const showRetryNotice = attempt?.result.status === 'INCORRECT' && selectedOption === null
  const [showHint, setShowHint] = useState(false)
  const [audioUnsupported, setAudioUnsupported] = useState(false)
  const nextButtonRef = useSolvedActionFocus(isSolved)

  useEffect(() => {
    if (attempt) setFailedAttempts(attempt.result.attempts)
    if (attempt?.result.status !== 'INCORRECT') return
    setExcludedOptions(current => current.includes(attempt.answer) ? current : [...current, attempt.answer])
    setSelectedOption(null)
  }, [attempt])

  const localizedHint = exercise.hint ? (typeof exercise.hint === 'string' ? exercise.hint : (exercise.hint[lang] ?? exercise.hint.de)) : null
  const explanationObj = exercise.content.explanation
  const localizedExplanation = explanationObj ? (typeof explanationObj === 'string' ? explanationObj : (explanationObj[lang] ?? explanationObj.de)) : null

  const handleSelect = (option: string): void => {
    if (isSolved || submitting || excludedOptions.includes(option)) return
    setSelectedOption((current) => (current === option ? null : option))
  }

  const handleCheck = (): void => {
    if (!selectedOption || isSolved || submitting) return
    onAttempt(Boolean(exercise.content.explanation && failedAttempts >= 2), selectedOption)
  }

  return (
    <div className="p-5 sm:p-10">
      {exercise.content.instruction && <p className="mb-6 text-lg font-semibold leading-relaxed text-[var(--violet)]">{exercise.content.instruction}</p>}
      <h3 className="break-words text-xl font-bold leading-relaxed text-[var(--foreground)] sm:text-2xl"><span lang={exercise.translationPrompt ? exercise.promptLanguage : 'de'}>{exercise.translationPrompt ?? exercise.content.question}</span>{exercise.content.target_form && <span lang="de" translate="no"> [{exercise.content.target_form.join(', ')}]</span>}</h3>

      <div className="mt-8 space-y-4">
        {exercise.content.options.map((option) => {
          const isExcluded = excludedOptions.includes(option)
          const isSelected = selectedOption === option
          const isCorrectAndSolved = isSolved && option === attempt?.answer

          return (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              disabled={isExcluded || isSolved || submitting}
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
              {articleWord(option) && <span aria-hidden="true" className={cn('st-word-tile__dot mr-3 shrink-0', !isSelected && articleColorClass(articleWord(option)))} />}
              {isSelected ? option : <ArticleColored word={option} />}
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
          className="mt-8 rounded-2xl border-2 border-[var(--violet)] bg-[var(--surface-muted)] p-6"
        >
          <div className="flex items-center gap-4">
            <CheckCircle2 className="h-9 w-9 shrink-0 text-[var(--violet)]" aria-hidden="true" />
            <p className="text-2xl font-bold text-[var(--foreground)]">{t('correct_well_done')}</p>
          </div>
          {attempt?.result.status === 'SOFT_ERROR' && <SoftErrorBadge reason={attempt.result.reason} translations={softErrorTranslations} />}
          {attempt?.result.status === 'EXACT' && attempt.result.hint && <OrthographyNote lang={lang} solution={attempt.result.matched} />}
          
          <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <SolutionAudioButton
              text={exercise.content.question.includes('___') 
                ? exercise.content.question.replace('___', exercise.content.correct_answer)
                : exercise.content.question + ' ' + exercise.content.correct_answer}
              label={t('listen_sentence')}
              ariaLabel={t('listen_sentence_aria')}
              variant="secondary"
              onUnsupported={() => setAudioUnsupported(true)}
            />
          </div>

          {audioUnsupported && (
            <p className="mt-4 text-lg leading-relaxed text-[var(--foreground)]">{t('audio_unavailable')}</p>
          )}
        </div>
      )}

      <div className="mt-10 flex flex-col sm:flex-row sm:justify-end">
        {isSolved ? (
          <button
            ref={nextButtonRef}
            type="button"
            onClick={onNext}
            className="inline-flex min-h-16 w-full scroll-mb-4 items-center justify-center gap-3 rounded-full bg-[var(--accent-strong)] px-8 py-4 text-xl font-bold text-[var(--accent-foreground)] shadow-md transition-colors hover:bg-[var(--accent-strong-hover)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] sm:w-auto"
          >
            {nextLabel}
            <ArrowRight size={28} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCheck}
            disabled={!selectedOption || submitting}
            className="min-h-16 w-full rounded-full bg-[var(--violet)] px-8 py-4 text-xl font-bold text-[var(--surface)] shadow-md transition-colors hover:bg-[var(--violet)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] sm:w-auto"
          >
            {t('check_answer')}
          </button>
        )}
      </div>
    </div>
  )
}
