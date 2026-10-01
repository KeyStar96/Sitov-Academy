'use client'

import { useState, type FormEvent } from 'react'
import { RotateCcw } from 'lucide-react'
import type { FocusAnswerResult, FocusItem } from '@/lib/vocabulary-focus'
import type { VocabularyFocusTranslator } from '@/lib/vocabulary-focus-i18n'

/**
 * Die vier kleinen Aufgaben des Problemwörter-Trainings. Jede meldet genau
 * eine Antwort (`onAnswer`); bewertet wird ausschließlich in PostgreSQL. Nach
 * der Antwort zeigen die Aufgaben, was gewählt wurde und was richtig ist.
 */
interface TaskProps<F extends FocusItem['format']> {
  item: Extract<FocusItem, { format: F }>
  t: VocabularyFocusTranslator
  disabled: boolean
  /** Rückmeldung zur eigenen Antwort (nach dem Prüfen). */
  result: { answer: string; data: FocusAnswerResult } | null
  onAnswer: (answer: string) => void
}

function optionState(option: string, result: TaskProps<'choice'>['result'], correct: string | null) {
  if (!result) return undefined
  if (correct !== null && option.toLowerCase() === correct.toLowerCase()) return 'correct'
  return option === result.answer ? 'wrong' : undefined
}

export function ArticleTask({ item, disabled, result, onAnswer }: TaskProps<'article'>) {
  const correct = result?.data.solution.article ?? null
  return <div className="space-y-5">
    <p className="text-center text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl" lang="de">
      <span aria-hidden="true" className="mr-2 inline-block min-w-[3ch] border-b-4 border-dashed border-[var(--border)] align-baseline text-[var(--muted)]">{result ? correct : ' '}</span>
      <span className="sr-only">{result ? correct : '…'} </span>{item.word}
    </p>
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {item.options.map(option => <button key={option} type="button" className="st-focus-option st-press" data-article={option} lang="de"
        data-state={optionState(option, result, correct)} disabled={disabled || Boolean(result)} onClick={() => onAnswer(option)}>
        <span className="st-focus-dot" aria-hidden="true" />{option}
      </button>)}
    </div>
  </div>
}

export function ChoiceTask({ item, t, disabled, result, onAnswer }: TaskProps<'choice'>) {
  const correct = result?.data.solution.display ?? null
  return <div className="grid gap-2 sm:grid-cols-2 sm:gap-3" role="group" aria-label={t('format_choice')}>
    {item.options.map(option => <button key={option} type="button" className="st-focus-option st-press" lang="de"
      data-state={optionState(option, result, correct)} disabled={disabled || Boolean(result)} onClick={() => onAnswer(option)}>{option}</button>)}
  </div>
}

export function BuildTask({ item, t, disabled, result, onAnswer }: TaskProps<'build'>) {
  const [placed, setPlaced] = useState<number[]>([])
  const complete = placed.length === item.letters.length
  const locked = disabled || Boolean(result)
  const word = placed.map(index => item.letters[index]).join('')
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-center gap-3" aria-label={t('placed')} role="group">
      {item.article && <span className="st-article-chip" data-article={item.article} lang="de"><span className="st-article-chip__dot" aria-hidden="true" />{item.article}</span>}
      <div className="st-focus-slots" lang="de">
        {item.letters.map((_, slot) => {
          const index = placed[slot]
          if (index === undefined) return <span key={slot} className="st-focus-slot" aria-hidden="true" />
          const letter = item.letters[index]
          return <button key={slot} type="button" className="st-focus-slot st-press" disabled={locked} aria-label={t('remove_letter', { letter })}
            onClick={() => setPlaced(current => current.filter((_, position) => position !== slot))}>{letter}</button>
        })}
      </div>
    </div>
    {result && <p className="text-center text-base text-[var(--muted)]" lang="de">{word}</p>}
    <div className="flex flex-wrap justify-center gap-2" lang="de">
      {item.letters.map((letter, index) => placed.includes(index)
        ? <span key={index} className="st-focus-letter opacity-0" aria-hidden="true">{letter}</span>
        : <button key={index} type="button" className="st-focus-letter st-press" disabled={locked} aria-label={t('add_letter', { letter })}
          onClick={() => setPlaced(current => [...current, index])}>{letter}</button>)}
    </div>
    {!result && <div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" className="st-tiles-pool__reset st-press" disabled={locked || placed.length === 0} onClick={() => setPlaced([])}><RotateCcw size={16} aria-hidden="true" />{t('reset')}</button>
      <button type="button" className="st-button st-button--primary st-press" disabled={locked || !complete} onClick={() => onAnswer(word)}>{t('check')}</button>
    </div>}
  </div>
}

export function TypeTask({ item, t, disabled, result, onAnswer }: TaskProps<'type'>) {
  const [value, setValue] = useState('')
  const submit = (event: FormEvent) => { event.preventDefault(); if (value.trim()) onAnswer(value.trim()) }
  return <form className="space-y-4" onSubmit={submit}>
    <label className="block">
      <span className="mb-2 block text-base font-bold text-[var(--foreground)]">{t('answer_label')}</span>
      <input className="min-h-14 w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] px-4 text-xl font-semibold text-[var(--foreground)] focus-visible:border-[var(--accent)] focus-visible:outline-none"
        value={value} onChange={event => setValue(event.target.value)} disabled={disabled || Boolean(result)} lang="de" autoComplete="off" autoCorrect="off"
        autoCapitalize="off" spellCheck={false} enterKeyHint="done" autoFocus maxLength={120}
        aria-describedby={`focus-type-hint-${item.cardId}`} />
    </label>
    <p id={`focus-type-hint-${item.cardId}`} className="text-base text-[var(--muted)]">
      {t('hint_type', { letter: item.firstLetter, count: item.length })}{item.noun ? ` · ${t('hint_type_noun')}` : ''}
    </p>
    {!result && <div className="flex justify-end"><button type="submit" className="st-button st-button--primary st-press" disabled={disabled || !value.trim()}>{t('check')}</button></div>}
  </form>
}
