'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Info } from 'lucide-react'
import SmartHintPanel from '@/components/exercises/SmartHintPanel'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import { useSolvedActionFocus } from '@/components/exercises/useSolvedActionFocus'
import { buildSmartHint } from '@/lib/exercise-chips'
import type { ExerciseTranslator } from '@/lib/exercise-i18n'
import type { ConfirmedExerciseAttempt, FillInBlankExercise as FillInBlankExerciseData } from '@/lib/types/exercise'
import { cn } from '@/lib/utils'
import VisualDiff from '@/components/exercises/VisualDiff'
import type { SoftErrorReason } from '@/lib/answer-grading'
import SoftErrorBadge from '@/components/exercises/SoftErrorBadge'

interface FillInBlankExerciseProps {
  exercise: FillInBlankExerciseData
  t: ExerciseTranslator
  onAttempt: (hintShown: boolean, answer: string) => void
  attempt?: ConfirmedExerciseAttempt
  submitting: boolean
  softErrorTranslations?: Partial<Record<SoftErrorReason, string>>
  onNext: () => void
  nextLabel: string
  lang: string
}

/** Only a confirmed server result unlocks completion and final feedback. */
export default function FillInBlankExerciseCard({
  exercise,
  t,
  onAttempt,
  onNext,
  nextLabel,
  lang,
  attempt,
  submitting,
  softErrorTranslations,
}: FillInBlankExerciseProps) {
  const [inputValue, setInputValue] = useState('')
  const validationResult = attempt?.result
  const isSolved = validationResult?.isCorrect === true
  const hasError = validationResult?.status === 'INCORRECT' && attempt?.answer === inputValue
  const [failedAttempts, setFailedAttempts] = useState(exercise.attempts)
  const showRetryNotice = hasError
  const [audioUnsupported, setAudioUnsupported] = useState(false)
  const nextButtonRef = useSolvedActionFocus(isSolved)

  useEffect(() => {
    if (attempt) setFailedAttempts(attempt.result.attempts)
  }, [attempt])

  const localizedHint = exercise.hint ? (typeof exercise.hint === 'string' ? exercise.hint : (exercise.hint[lang] ?? exercise.hint.de)) : null
  const smartHintObj = exercise.content.smart_hint
  const localizedSmartHint = smartHintObj ? (typeof smartHintObj === 'string' ? smartHintObj : (smartHintObj[lang] ?? smartHintObj.de)) : null

  const smartHint = useMemo(
    () =>
      buildSmartHint({
        correctAnswer: exercise.content.correct_answer,
        failedAttempts,
        customHint: localizedSmartHint,
        article: exercise.solutionArticle,
      }),
    [exercise.content.correct_answer, localizedSmartHint, exercise.solutionArticle, failedAttempts]
  )

  const fullSentence = useMemo(
    () =>
      `${exercise.content.text_before}${exercise.content.correct_answer}${exercise.content.text_after}`
        .replace(/\s+/g, ' ')
        .trim(),
    [exercise.content]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSolved || submitting) return
    setInputValue(e.target.value)
  }

  const handleCheck = (): void => {
    if (!inputValue.trim() || isSolved || submitting) return
    onAttempt(smartHint !== null, inputValue)
  }


  return (
    <div className="p-5 sm:p-10">
      {exercise.content.instruction && <p className="mb-6 text-lg font-semibold leading-relaxed text-[var(--violet)]">{exercise.content.instruction}</p>}
      {exercise.translationPrompt && <p className="mb-6 text-xl font-medium text-[var(--foreground)] sm:text-3xl"><span lang={exercise.promptLanguage}>{exercise.translationPrompt}</span> <span lang="de" translate="no">[{exercise.content.target_form?.join(', ')}]</span></p>}
      {/* Satz mit Lücke – auf dem Handy 20px, ab Tablet 30px. */}
      <p className="break-words text-center text-xl font-medium leading-relaxed text-[var(--foreground)] sm:text-3xl sm:leading-loose" lang="de" translate="no">
        {exercise.content.text_before}
        {!isSolved ? (
          <input
            type="text"
            aria-label={t('blank_label')}
            autoComplete="off"
            spellCheck={false}
            value={inputValue}
            disabled={submitting}
            onChange={handleChange}
            placeholder={t('blank_label')}
            className={cn(
              'mx-2 inline-flex min-h-12 w-32 max-w-full text-center rounded-xl border-b-4 px-3 py-1 align-middle transition-colors sm:w-48 sm:px-4 focus:outline-none focus:border-[var(--violet)]',
              hasError
                ? 'border-[var(--danger)] bg-[var(--surface)] text-[var(--foreground)]'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]'
            )}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCheck()
            }}
          />
        ) : (
          <span
            className={cn(
              'mx-2 inline-flex max-w-full min-w-[6rem] items-center justify-center break-words rounded-xl border-b-4 px-3 py-1 align-middle transition-colors sm:min-w-[9rem] sm:px-4',
              'border-[var(--violet)] bg-[var(--surface-muted)] font-bold text-[var(--violet)]'
            )}
            aria-label={exercise.content.correct_answer}
          >
            {exercise.content.correct_answer}
          </span>
        )}
        {exercise.content.text_after}
        {!exercise.translationPrompt && exercise.content.target_form && <span className="ml-2">[{exercise.content.target_form.join(', ')}]</span>}
      </p>
      
      {exercise.content.gap_hint && !isSolved && (
        <div className="mt-4 text-center">
          <span className="inline-block rounded-lg bg-[var(--surface-muted)] px-4 py-2 text-base sm:text-lg font-medium text-[var(--muted)]" lang="de" translate="no">
            {exercise.content.gap_hint}
          </span>
        </div>
      )}

      {showRetryNotice && !isSolved && (
        <div
          role="status"
          aria-live="polite"
          className="mt-8 flex flex-col sm:flex-row items-start gap-4 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface-muted)] p-6"
        >
          <Info className="mt-1 h-8 w-8 shrink-0 text-[var(--violet)]" aria-hidden="true" />
          <div className="flex-1 w-full">
            <p className="text-xl font-bold text-[var(--foreground)]">{t('try_again')}</p>
            <p className="mt-1 text-lg leading-relaxed text-[var(--foreground)]">{t('typing_retry_detail')}</p>
            <div className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <span className="mb-2 block text-sm font-semibold text-[var(--muted)]">{t('your_answer_label')}</span>
              <p className="whitespace-pre-wrap break-words text-lg text-[var(--foreground)]" lang="de" translate="no">{exercise.content.text_before}{inputValue}{exercise.content.text_after}</p>
              <span className="mb-2 mt-4 block text-base font-semibold text-[var(--muted)]">{t('correct_sentence_label')}</span>
              <div lang="de" translate="no">
                <VisualDiff actual={`${exercise.content.text_before}${inputValue}${exercise.content.text_after}`} expected={fullSentence} />
              </div>
            </div>
          </div>
        </div>
      )}

      {smartHint && !isSolved && <SmartHintPanel hint={smartHint} t={t} />}

      {localizedHint && failedAttempts > 0 && !isSolved && (
        <div className="mt-6 flex flex-col gap-4 rounded-r-2xl border-l-4 border-[var(--violet)] bg-[var(--surface-muted)] p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="mt-1 h-8 w-8 shrink-0 text-[var(--violet)]" aria-hidden="true" />
            <div>
              <h4 className="mb-1 text-xl font-bold text-[var(--foreground)]">{t('tip_mother_tongue')}</h4>
              <p className="text-lg leading-relaxed text-[var(--foreground)]">{localizedHint}</p>
            </div>
          </div>
        </div>
      )}

      {isSolved && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'mt-10 rounded-2xl border-2 p-6',
            validationResult?.status === 'SOFT_ERROR' ? 'border-[var(--warning)] bg-[var(--surface-muted)]' : 'border-[var(--violet)] bg-[var(--surface-muted)]'
          )}
        >
          <div className="flex items-center gap-4">
            <CheckCircle2 className="h-9 w-9 shrink-0 text-[var(--violet)]" aria-hidden="true" />
            <p className="text-2xl font-bold text-[var(--foreground)]">{t('correct_well_done')}</p>
          </div>

          {validationResult?.status === 'SOFT_ERROR' && (
            <SoftErrorBadge reason={validationResult.reason} translations={softErrorTranslations} />
          )}

          {localizedSmartHint && <p className="mt-4 text-lg leading-relaxed text-[var(--foreground)]">{localizedSmartHint}</p>}
          {/* Tap-to-Listen für das gelöste Wort und den gesamten Satz. */}
          <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <SolutionAudioButton
              text={exercise.content.correct_answer}
              audioUrl={exercise.solutionAudioUrl}
              label={t('listen_word')}
              ariaLabel={t('listen_word_aria', { word: exercise.content.correct_answer })}
              onUnsupported={() => setAudioUnsupported(true)}
            />
            <SolutionAudioButton
              text={fullSentence}
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
            disabled={!inputValue.trim() || submitting}
            className="min-h-16 w-full rounded-full bg-[var(--violet)] px-8 py-4 text-xl font-bold text-[var(--surface)] shadow-md transition-colors hover:bg-[var(--violet)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] sm:w-auto"
          >
            {t('check_answer')}
          </button>
        )}
      </div>
    </div>
  )
}
