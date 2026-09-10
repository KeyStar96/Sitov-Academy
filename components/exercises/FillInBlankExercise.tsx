'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Info } from 'lucide-react'
import SmartHintPanel from '@/components/exercises/SmartHintPanel'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import { buildSmartHint } from '@/lib/exercise-chips'
import type { ExerciseTranslator } from '@/lib/exercise-i18n'
import type { FillInBlankExercise as FillInBlankExerciseData } from '@/lib/types/exercise'
import { cn } from '@/lib/utils'

interface FillInBlankExerciseProps {
  exercise: FillInBlankExerciseData
  t: ExerciseTranslator
  /** Persistiert den Versuch. Der Aufrufer entscheidet über die Speicherung. */
  onAttempt: (isCorrect: boolean, hintShown: boolean, answer: string) => void
  onNext: () => void
  nextLabel: string
}

function isSameWord(left: string, right: string): boolean {
  return left.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE') === right.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE')
}

/**
 * Lückentext mit Auswahl-Chips statt Tastatureingabe.
 *
 * Geragogik-Entscheidungen:
 * - Keine freie Eingabe, dadurch keine Tippfehler auf Mobilgeräten.
 * - Falsch getippte Chips werden ausgegraut statt als Fehler markiert; die
 *   Aufgabe bleibt offen, bis sie gelöst ist (Zero-Error-UX, kein Timer).
 * - Ab zwei Fehlversuchen erscheint ein Smart Hint.
 * - Die gelöste Lücke bekommt einen Tap-Button für die Aussprache.
 */
export default function FillInBlankExerciseCard({
  exercise,
  t,
  onAttempt,
  onNext,
  nextLabel,
}: FillInBlankExerciseProps) {
  const [selectedChip, setSelectedChip] = useState<string | null>(null)
  const [excludedChips, setExcludedChips] = useState<readonly string[]>([])
  const [failedAttempts, setFailedAttempts] = useState(exercise.attempts)
  const [isSolved, setIsSolved] = useState(false)
  const [showRetryNotice, setShowRetryNotice] = useState(false)
  const [audioUnsupported, setAudioUnsupported] = useState(false)

  const smartHint = useMemo(
    () =>
      buildSmartHint({
        correctAnswer: exercise.content.correct_answer,
        failedAttempts,
        customHint: exercise.content.smart_hint,
        article: exercise.solutionArticle,
      }),
    [exercise.content.correct_answer, exercise.content.smart_hint, exercise.solutionArticle, failedAttempts]
  )

  const fullSentence = useMemo(
    () =>
      `${exercise.content.text_before}${exercise.content.correct_answer}${exercise.content.text_after}`
        .replace(/\s+/g, ' ')
        .trim(),
    [exercise.content]
  )

  const handleChipClick = (chip: string): void => {
    if (isSolved || excludedChips.includes(chip)) return
    setShowRetryNotice(false)
    setSelectedChip((current) => (current === chip ? null : chip))
  }

  const handleCheck = (): void => {
    if (!selectedChip || isSolved) return

    const isCorrect = isSameWord(selectedChip, exercise.content.correct_answer)
    onAttempt(isCorrect, smartHint !== null, selectedChip)

    if (isCorrect) {
      setIsSolved(true)
      setShowRetryNotice(false)
      return
    }

    setExcludedChips((current) => [...current, selectedChip])
    setSelectedChip(null)
    setFailedAttempts((current) => current + 1)
    setShowRetryNotice(true)
  }

  const gapContent = isSolved ? exercise.content.correct_answer : selectedChip

  return (
    <div className="p-5 sm:p-10">
      {exercise.content.instruction && <p className="mb-6 text-base font-semibold text-[var(--violet)]">{exercise.content.instruction}</p>}
      {/* Satz mit Lücke – auf dem Handy 20px, ab Tablet 30px. */}
      <p className="break-words text-center text-xl font-medium leading-relaxed text-[var(--foreground)] sm:text-3xl sm:leading-loose">
        {exercise.content.text_before}
        <span
          className={cn(
            'mx-2 inline-flex max-w-full min-w-[6rem] items-center justify-center break-words rounded-xl border-b-4 px-3 py-1 align-middle transition-colors sm:min-w-[9rem] sm:px-4',
            isSolved
              ? 'border-[var(--violet)] bg-[var(--surface-muted)] font-bold text-[var(--violet)]'
              : selectedChip
                ? 'border-[var(--violet)] bg-[var(--surface-muted)] font-bold text-[var(--violet)]'
                : 'border-dashed border-[var(--border)]  bg-[var(--surface-muted)]  text-[var(--muted)] '
          )}
          aria-label={gapContent ?? t('blank_label')}
        >
          {gapContent ?? '\u00A0\u00A0\u00A0'}
        </span>
        {exercise.content.text_after}
      </p>

      {!isSolved && (
        <>
          <h3 className="mt-10 text-center text-2xl font-bold text-[var(--foreground)]">{t('choose_word')}</h3>

          {/* Tipp-Chips: Touch-Targets mit 64px Höhe, kein Drag-and-Drop. */}
          <div className="mt-6 flex flex-wrap justify-center gap-3 sm:gap-4">
            {exercise.chips.map((chip) => {
              const isExcluded = excludedChips.includes(chip)
              const isSelected = selectedChip === chip

              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleChipClick(chip)}
                  disabled={isExcluded}
                  aria-pressed={isSelected}
                  aria-label={
                    isExcluded ? t('chip_wrong_aria', { word: chip }) : t('choose_word_aria', { word: chip })
                  }
                  className={cn(
                    'min-h-16 min-w-16 max-w-full break-words [overflow-wrap:anywhere] rounded-2xl border-2 px-4 sm:px-8 py-4 text-2xl font-bold transition-all focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]',
                    isExcluded && 'cursor-not-allowed border-[var(--border)]  bg-[var(--surface-muted)]  text-[var(--muted)]  line-through',
                    !isExcluded && isSelected && 'border-[var(--violet)] bg-[var(--violet)] text-[var(--surface)] shadow-lg',
                    !isExcluded && !isSelected && 'border-[var(--border)]  bg-[var(--surface)]  text-[var(--foreground)]  hover:border-[var(--violet)]  hover:bg-[var(--surface-muted)] '
                  )}
                >
                  {chip}
                </button>
              )
            })}
          </div>
        </>
      )}

      {showRetryNotice && !isSolved && (
        <div
          role="status"
          aria-live="polite"
          className="mt-8 flex items-start gap-4 rounded-2xl border-2 border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-950/30 p-6"
        >
          <Info className="mt-1 h-8 w-8 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <p className="text-xl font-bold text-amber-900 dark:text-amber-500">{t('try_again')}</p>
            <p className="mt-1 text-lg text-amber-800 dark:text-amber-400/90">{t('try_again_detail')}</p>
          </div>
        </div>
      )}

      {smartHint && !isSolved && <SmartHintPanel hint={smartHint} t={t} />}

      {/* Kontrastiver Hinweis in der Muttersprache, sobald es einmal nicht geklappt hat. */}
      {exercise.hint && failedAttempts > 0 && !isSolved && (
        <div className="mt-6 flex items-start gap-4 rounded-r-2xl border-l-4 border-amber-500 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 p-6">
          <AlertCircle className="mt-1 h-8 w-8 shrink-0 text-amber-600" aria-hidden="true" />
          <div>
            <h4 className="mb-1 text-xl font-bold text-amber-900 dark:text-amber-500">{t('tip_mother_tongue')}</h4>
            <p className="text-lg text-amber-800 dark:text-amber-400/90">{exercise.hint}</p>
          </div>
        </div>
      )}

      {isSolved && (
        <div
          role="status"
          aria-live="polite"
          className="mt-10 rounded-2xl border-2 border-green-200 dark:border-green-700/50 bg-green-50 dark:bg-green-950/30 p-6"
        >
          <div className="flex items-center gap-4">
            <CheckCircle2 className="h-9 w-9 shrink-0 text-green-600 dark:text-green-500" aria-hidden="true" />
            <p className="text-2xl font-bold text-green-800 dark:text-green-500">{t('correct_well_done')}</p>
          </div>

          {exercise.content.smart_hint && <p className="mt-4 text-base leading-relaxed text-[var(--foreground)]">{exercise.content.smart_hint}</p>}
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
            <p className="mt-4 text-lg text-green-900">{t('audio_unavailable')}</p>
          )}
        </div>
      )}

      <div className="mt-10 flex flex-col sm:flex-row sm:justify-end">
        {isSolved ? (
          <button
            type="button"
            onClick={onNext}
            className="inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-full bg-[var(--accent)] px-8 py-4 text-xl font-bold text-[var(--accent-foreground)] shadow-md transition-colors hover:opacity-90 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] sm:w-auto"
          >
            {nextLabel}
            <ArrowRight size={28} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCheck}
            disabled={!selectedChip}
            className="min-h-16 w-full rounded-full bg-[var(--violet)] px-8 py-4 text-xl font-bold text-[var(--surface)] shadow-md transition-colors hover:bg-[var(--violet)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] sm:w-auto"
          >
            {t('check_answer')}
          </button>
        )}
      </div>
    </div>
  )
}
