'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, ArrowRight, CheckCircle2, Info, Keyboard, LayoutGrid, RotateCcw } from 'lucide-react'
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
import { ArticleColored, articleWord } from '@/components/exercises/GrammarAids'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { articleColorClass } from '@/lib/vocabulary-ui'

export type GrammarInputMode = 'tiles' | 'typing'

/**
 * Kärtchen aus den Server-Chips. Mehrwortige Lösungen („ein Tisch") werden in
 * Einzelwörter zerlegt, die man in der richtigen Reihenfolge antippt — so
 * entsteht der Satzbau aus Wortkärtchen. Ein Wort kommt so oft vor, wie es in
 * einem einzelnen Chip höchstens vorkommt.
 */
export function buildWordTiles(chips: readonly string[], correctAnswer: string): string[] {
  if (!/\s/.test(correctAnswer.trim())) return [...new Set(chips.map(chip => chip.trim()).filter(Boolean))]
  const counts = new Map<string, number>()
  for (const chip of chips) {
    const local = new Map<string, number>()
    for (const word of chip.trim().split(/\s+/).filter(Boolean)) local.set(word, (local.get(word) ?? 0) + 1)
    for (const [word, count] of local) counts.set(word, Math.max(counts.get(word) ?? 0, count))
  }
  return [...counts].flatMap(([word, count]) => Array.from({ length: count }, () => word))
}

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
  /** Kärtchen (Standard, ohne Tastatur) oder Tippen; die Wahl merkt sich der Aufrufer. */
  inputMode?: GrammarInputMode
  onInputModeChange?: (mode: GrammarInputMode) => void
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
  inputMode = 'typing',
  onInputModeChange,
}: FillInBlankExerciseProps) {
  const [inputValue, setInputValue] = useState('')
  const s = studentTranslator(lang)
  const reduced = useReducedMotion() ?? false
  const tiles = useMemo(() => buildWordTiles(exercise.chips, exercise.content.correct_answer), [exercise.chips, exercise.content.correct_answer])
  const multiWord = /\s/.test(exercise.content.correct_answer.trim())
  const [placed, setPlaced] = useState<number[]>([])
  const tilesMode = inputMode === 'tiles' && tiles.length > 0
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

  // Kärtchen fliegen von ihrem Platz in die Lücke (und zurück): Vor dem Tipp
  // merken wir uns, wo das Kärtchen lag; das neue Element startet dort.
  const origins = useRef(new Map<string, DOMRect>())
  const remember = (target: string, element: HTMLElement) => { if (!reduced) origins.current.set(target, element.getBoundingClientRect()) }
  const flyIn = (element: HTMLElement | null, key: string) => {
    const from = origins.current.get(key)
    if (!element || !from || typeof element.animate !== 'function') return
    origins.current.delete(key)
    const to = element.getBoundingClientRect()
    element.animate([
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${to.width ? from.width / to.width : 1})`, opacity: .85 },
      { transform: 'none', opacity: 1 },
    ], { duration: 380, easing: 'cubic-bezier(.22, 1, .36, 1)' })
  }

  const placeTiles = (next: number[]) => {
    if (isSolved || submitting) return
    setPlaced(next)
    setInputValue(next.map(index => tiles[index]).join(' '))
  }
  const addTile = (index: number) => placeTiles(multiWord ? [...placed, index] : [index])
  const removeTile = (index: number) => placeTiles(placed.filter(value => value !== index))
  const switchMode = (mode: GrammarInputMode) => {
    if (mode === inputMode) return
    // Getippter Text lässt sich nicht in Kärtchen zurückverwandeln — dann beginnt die Auswahl neu.
    if (mode === 'tiles') { setPlaced([]); setInputValue('') }
    onInputModeChange?.(mode)
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
        {!isSolved && tilesMode ? (
          <span className="st-gap" data-error={hasError} role="group" aria-label={t('blank_label')}>
            {placed.length === 0 && <span className="st-gap__empty" aria-hidden="true">{s('gap_empty')}</span>}
            {placed.map(index => (
              <button key={index} ref={element => flyIn(element, `gap-${index}`)} type="button"
                onClick={event => { remember(`pool-${index}`, event.currentTarget); removeTile(index) }} disabled={submitting} className="st-gap__word"
                aria-label={s('tile_remove', { word: tiles[index] })}>
                <ArticleColored word={tiles[index]} />
              </button>
            ))}
          </span>
        ) : !isSolved ? (
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
            {exercise.content.correct_answer.split(/(\s+)/).map((part, index) => <ArticleColored key={index} word={part} />)}
          </span>
        )}
        {exercise.content.text_after}
        {!exercise.translationPrompt && exercise.content.target_form && <span className="ml-2">[{exercise.content.target_form.join(', ')}]</span>}
      </p>

      {!isSolved && tiles.length > 0 && onInputModeChange && (
        <div className="st-input-mode" role="group" aria-label={s('input_mode')} style={{ '--st-active': inputMode === 'tiles' ? 0 : 1 } as CSSProperties}>
          <span className="st-input-mode__pill" aria-hidden="true" />
          {(['tiles', 'typing'] as const).map(mode => (
            <button key={mode} type="button" aria-pressed={inputMode === mode} onClick={() => switchMode(mode)} disabled={submitting} className="st-input-mode__option">
              {mode === 'tiles' ? <LayoutGrid size={18} aria-hidden="true" /> : <Keyboard size={18} aria-hidden="true" />}
              <span>{s(mode === 'tiles' ? 'tiles_mode' : 'typing_mode')}</span>
            </button>
          ))}
        </div>
      )}

      {!isSolved && tilesMode && (
        <div className="st-tiles-pool">
          <p className="st-tiles-pool__hint">{s(multiWord ? 'tiles_hint' : 'tiles_hint_single')}</p>
          <div className="st-tiles-pool__grid">
            {tiles.map((word, index) => placed.includes(index)
              ? <span key={index} className="st-word-tile st-word-tile--ghost" aria-hidden="true">{word}</span>
              : (
                <button key={index} ref={element => flyIn(element, `pool-${index}`)} type="button"
                  onClick={event => { remember(`gap-${index}`, event.currentTarget); addTile(index) }} disabled={submitting}
                  className="st-word-tile st-press" data-article={articleWord(word) ?? undefined} aria-label={s('tile_add', { word })} lang="de">
                  {articleWord(word) && <span aria-hidden="true" className={cn('st-word-tile__dot', articleColorClass(articleWord(word)))} />}
                  <ArticleColored word={word} />
                </button>
              ))}
          </div>
          <AnimatePresence>
            {placed.length > 0 && (
              <motion.button type="button" onClick={() => placeTiles([])} disabled={submitting} className="st-tiles-pool__reset"
                initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <RotateCcw size={17} aria-hidden="true" />{s('tiles_clear')}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}
      
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
