'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Info } from 'lucide-react'
import SmartHintPanel from '@/components/exercises/SmartHintPanel'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import { useSolvedActionFocus } from '@/components/exercises/useSolvedActionFocus'
import { buildSmartHint } from '@/lib/exercise-chips'
import type { ExerciseTranslator } from '@/lib/exercise-i18n'
import type { FillInBlankExercise as FillInBlankExerciseData } from '@/lib/types/exercise'
import { cn } from '@/lib/utils'
import VisualDiff from '@/components/exercises/VisualDiff'

interface FillInBlankExerciseProps {
  exercise: FillInBlankExerciseData
  t: ExerciseTranslator
  /** Persistiert den Versuch. Der Aufrufer entscheidet über die Speicherung. */
  onAttempt: (isCorrect: boolean, hintShown: boolean, answer: string) => void
  onNext: () => void
  nextLabel: string
  lang: string
}

function startsUppercase(value: string): boolean {
  const first = value.trim().charAt(0)
  return first.length > 0 && first === first.toLocaleUpperCase('de-DE') && first !== first.toLocaleLowerCase('de-DE')
}

function isSameWord(left: string, right: string, isCaseSensitive: boolean): boolean {
  let l = left.trim().replace(/\s+/g, ' ').replace(/[.,!?]+$/, '')
  let r = right.trim().replace(/\s+/g, ' ').replace(/[.,!?]+$/, '')
  if (!isCaseSensitive) {
    l = l.toLocaleLowerCase('de-DE')
    r = r.toLocaleLowerCase('de-DE')
  }
  return l === r
}

/**
 * Lückentext mit Texteingabe (Input).
 *
 * Geragogik-Entscheidungen:
 * - Freie Texteingabe, da pädagogisch sinnvoller als reine Auswahl.
 * - Smarte Validierung: Trimmt Leerzeichen und ignoriert Groß-/Kleinschreibung bei Wörtern, die nicht großgeschrieben werden müssen.
 * - Fehlerhafte Eingaben rütteln nicht auf, sondern bleiben stehen mit Fehler-Feedback.
 * - Ab zwei Fehlversuchen erscheint ein Smart Hint oder muttersprachlicher Hinweis.
 * - Die gelöste Lücke bekommt einen Tap-Button für die Aussprache.
 */
export default function FillInBlankExerciseCard({
  exercise,
  t,
  onAttempt,
  onNext,
  nextLabel,
  lang,
}: FillInBlankExerciseProps) {
  const [inputValue, setInputValue] = useState('')
  const [hasError, setHasError] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(exercise.attempts)
  const [isSolved, setIsSolved] = useState(false)
  const [usedAlternative, setUsedAlternative] = useState(false)
  const [showRetryNotice, setShowRetryNotice] = useState(false)
  const [audioUnsupported, setAudioUnsupported] = useState(false)
  const nextButtonRef = useSolvedActionFocus(isSolved)

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
    if (isSolved) return
    setInputValue(e.target.value)
    setShowRetryNotice(false)
    setHasError(false)
  }

  const handleCheck = (): void => {
    if (!inputValue || isSolved) return

    const isCaseSensitive = startsUppercase(exercise.content.correct_answer)
    const isExact = isSameWord(inputValue, exercise.content.correct_answer, isCaseSensitive)
    const isAlternative = !isExact && (exercise.content.alternative_answers?.some(alt => isSameWord(inputValue, alt, isCaseSensitive)) ?? false)
    const isCorrect = isExact || isAlternative

    onAttempt(isCorrect, smartHint !== null, inputValue)

    if (isCorrect) {
      setIsSolved(true)
      setUsedAlternative(isAlternative)
      setShowRetryNotice(false)
      setHasError(false)
      return
    }

    setHasError(true)
    setFailedAttempts((current) => current + 1)
    setShowRetryNotice(true)
  }

  const gapContent = isSolved ? exercise.content.correct_answer : inputValue

  return (
    <div className="p-5 sm:p-10">
      {exercise.content.instruction && <p className="mb-6 text-lg font-semibold leading-relaxed text-[var(--violet)]">{exercise.content.instruction}</p>}
      {/* Satz mit Lücke – auf dem Handy 20px, ab Tablet 30px. */}
      <p className="break-words text-center text-xl font-medium leading-relaxed text-[var(--foreground)] sm:text-3xl sm:leading-loose">
        {exercise.content.text_before}
        {!isSolved ? (
          <input
            type="text"
            value={inputValue}
            onChange={handleChange}
            placeholder={t('blank_label')}
            className={cn(
              'mx-2 inline-flex w-32 max-w-full text-center rounded-xl border-b-4 px-3 py-1 align-middle transition-colors sm:w-48 sm:px-4 focus:outline-none focus:border-[var(--violet)]',
              hasError
                ? 'border-red-500 bg-red-50 text-red-700'
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
      </p>

      {showRetryNotice && !isSolved && (
        <div
          role="status"
          aria-live="polite"
          className="mt-8 flex flex-col sm:flex-row items-start gap-4 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface-muted)] p-6"
        >
          <Info className="mt-1 h-8 w-8 shrink-0 text-[var(--violet)]" aria-hidden="true" />
          <div className="flex-1 w-full">
            <p className="text-xl font-bold text-[var(--foreground)]">{t('try_again')}</p>
            <p className="mt-1 text-lg leading-relaxed text-[var(--foreground)]">{t('try_again_detail')}</p>
            <div className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <span className="mb-2 block text-sm font-semibold text-[var(--muted)]">{t('your_answer_label') || 'Deine Eingabe:'}</span>
              <VisualDiff actual={inputValue} expected={exercise.content.correct_answer} />
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
          className="mt-10 rounded-2xl border-2 border-[var(--violet)] bg-[var(--surface-muted)] p-6"
        >
          <div className="flex items-center gap-4">
            <CheckCircle2 className="h-9 w-9 shrink-0 text-[var(--violet)]" aria-hidden="true" />
            <p className="text-2xl font-bold text-[var(--foreground)]">{t('correct_well_done')}</p>
          </div>

          {usedAlternative && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-800">
              <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p>
                {t('alternative_answer_hint') || 'Richtig! Oft wird hierfür auch diese Form verwendet:'} <br />
                <strong>{exercise.content.correct_answer}</strong>
              </p>
            </div>
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
            className="inline-flex min-h-16 w-full scroll-mb-4 items-center justify-center gap-3 rounded-full bg-[var(--accent)] px-8 py-4 text-xl font-bold text-[var(--accent-foreground)] shadow-md transition-colors hover:opacity-90 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] sm:w-auto"
          >
            {nextLabel}
            <ArrowRight size={28} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCheck}
            disabled={!inputValue}
            className="min-h-16 w-full rounded-full bg-[var(--violet)] px-8 py-4 text-xl font-bold text-[var(--surface)] shadow-md transition-colors hover:bg-[var(--violet)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] sm:w-auto"
          >
            {t('check_answer')}
          </button>
        )}
      </div>
    </div>
  )
}
