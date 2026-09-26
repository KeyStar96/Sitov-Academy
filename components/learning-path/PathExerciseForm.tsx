'use client'

import { useState } from 'react'
import type { PathAnswer, PathExercise } from '@/lib/learning-path-contract'
import { pathTranslator } from '@/lib/learning-path-i18n'
import styles from './learning-path.module.css'

/** Input collection only. No answers or client-side correctness calculations. */
export default function PathExerciseForm({ exercise, lang, busy, onSubmit, isTest }: {
  exercise: PathExercise; lang: string; busy: boolean; onSubmit: (answer: PathAnswer) => void; isTest: boolean
}) {
  const t = pathTranslator(lang)
  const [text, setText] = useState('')
  const [index, setIndex] = useState<number | null>(null)
  const [indices, setIndices] = useState<number[]>([])
  const answer = exercise.type === 'fill_in_blank' ? { text }
    : exercise.type === 'multiple_choice' ? index === null ? null : { index } : { indices }
  const complete = exercise.type === 'fill_in_blank' ? text.trim().length > 0
    : exercise.type === 'multiple_choice' ? index !== null : indices.length === exercise.content.parts.length

  return <form data-testid="path-exercise" data-exercise-id={exercise.id} data-exercise-type={exercise.type}
    onSubmit={event => { event.preventDefault(); if (complete && answer && !busy) onSubmit(answer) }}>
    <h3 className={styles.instruction}>{exercise.content.instruction || t(exercise.type === 'sentence_building' ? 'arrange' : exercise.type === 'multiple_choice' ? 'choose' : 'answer')}</h3>
    {exercise.content.prompt && <p className={styles.prompt}>{exercise.content.prompt}</p>}
    <fieldset disabled={busy} className={styles.fields}>
      <legend className="sr-only">{t('answer')}</legend>
      {exercise.type === 'fill_in_blank' && <>
        <p className={styles.sentence} lang="de" translate="no" id="path-sentence">{exercise.content.text_before} <span aria-hidden="true">…</span> {exercise.content.text_after}</p>
        <label className={styles.label} htmlFor="path-answer">{t('answer')}</label>
        {exercise.content.needs_article && <p id="path-article">{t('article')}</p>}
        <input id="path-answer" data-testid="path-answer" lang="de" autoComplete="off" autoCapitalize="none" spellCheck={false}
          aria-describedby={`path-sentence${exercise.content.needs_article ? ' path-article' : ''}`} maxLength={4000}
          className={styles.input} value={text} onChange={event => setText(event.target.value)} autoFocus />
      </>}
      {exercise.type === 'multiple_choice' && <>
        <p className={styles.sentence} lang="de" translate="no" id="path-question">{exercise.content.question}</p>
        <div className={styles.options} role="radiogroup" aria-labelledby="path-question">
          {exercise.content.options.map((option, optionIndex) => <label key={optionIndex} className={styles.option} data-selected={index === optionIndex}>
            <input type="radio" name="path-option" value={optionIndex} checked={index === optionIndex} onChange={() => setIndex(optionIndex)} />
            <span lang="de" translate="no">{option}</span>
          </label>)}
        </div>
      </>}
      {exercise.type === 'sentence_building' && <>
        <p id="path-selected">{t('selected')}</p>
        <div className={styles.tiles} role="group" aria-labelledby="path-selected" aria-live="polite">
          {indices.map((partIndex, position) => <button type="button" key={partIndex} className={styles.secondary}
            aria-label={t('remove', { word: exercise.content.parts[partIndex] })}
            onClick={() => setIndices(previous => previous.filter((_, i) => i !== position))}>
            <span lang="de" translate="no">{exercise.content.parts[partIndex]}</span>
          </button>)}
        </div>
        <p id="path-words">{t('words')}</p>
        <div className={styles.tiles} role="group" aria-labelledby="path-words">
          {exercise.content.parts.map((part, partIndex) => <button type="button" key={partIndex}
            className={styles.secondary} disabled={indices.includes(partIndex)}
            aria-label={t('add', { word: part })} onClick={() => setIndices(previous => [...previous, partIndex])}>
            <span lang="de" translate="no">{part}</span>
          </button>)}
        </div>
      </>}
    </fieldset>
    <div className={styles.actions}><button type="submit" data-testid="path-check" className={styles.primary} disabled={busy || !complete}>
      {busy ? t('loading') : t(isTest ? 'save' : 'check')}
    </button></div>
  </form>
}
