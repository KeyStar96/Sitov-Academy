'use client'

import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Languages } from 'lucide-react'
import type { PathAnswer, PathExercise } from '@/lib/learning-path-contract'
import { pathTranslator } from '@/lib/learning-path-i18n'
import { EASE_OUT_SOFT, MOTION, useReducedMotionSafe } from '@/lib/motion'
import styles from './learning-path.module.css'

/**
 * Hinweis in der Lücke: die deutsche Grundform des gesuchten Worts (bei Verben
 * der Infinitiv) oder, wenn die Grundform schon die Lösung wäre, seine
 * Bedeutung in der Oberflächensprache. So ist jede Lücke eindeutig.
 */
export function GapHint({ exercise, lang }: { exercise: PathExercise; lang: string }) {
  const t = pathTranslator(lang)
  if (exercise.type !== 'fill_in_blank') return null
  const base = exercise.content.gap_hint
  const meaning = base ? undefined : exercise.translation?.gap_hint
  if (!base && !meaning) return null
  return <span className={styles.gapHint} data-kind={base ? 'base' : 'meaning'} data-testid="path-gap-hint"
    lang={base ? 'de' : lang} translate={base ? 'no' : undefined}>
    <span className="sr-only">({t(base ? 'hint_base' : 'hint_meaning')}: </span>
    {!base && <Languages size={14} aria-hidden="true" />}
    {base ?? meaning}
    <span className="sr-only">)</span>
  </span>
}

/** Die übersetzte Aufgabe, auf Wunsch unter der deutschen Aufgabe. */
export function TaskTranslation({ id, text, lang, open }: { id: string; text?: string; lang: string; open: boolean }) {
  const t = pathTranslator(lang)
  const reduced = useReducedMotionSafe()
  return <AnimatePresence initial={false}>
    {open && text && <motion.div key="translation" id={id} role="region" aria-label={t('translation_region')}
      className={styles.translation} data-testid="path-translation"
      initial={reduced ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ duration: reduced ? 0 : MOTION.base, ease: EASE_OUT_SOFT }}>
      <p lang={lang}><Languages size={18} aria-hidden="true" /><span>{text}</span></p>
    </motion.div>}
  </AnimatePresence>
}

/** Input collection only. No answers or client-side correctness calculations. */
export default function PathExerciseForm({ exercise, lang, busy, onSubmit, isTest, translationOpen = false, onTranslationToggle }: {
  exercise: PathExercise; lang: string; busy: boolean; onSubmit: (answer: PathAnswer) => void; isTest: boolean
  /** Übersetzung sichtbar; der Zustand gilt für alle Aufgaben der Sitzung. */
  translationOpen?: boolean
  onTranslationToggle?: () => void
}) {
  const t = pathTranslator(lang)
  const panel = useId()
  const [text, setText] = useState('')
  const [index, setIndex] = useState<number | null>(null)
  const [indices, setIndices] = useState<number[]>([])
  const answer = exercise.type === 'fill_in_blank' ? { text }
    : exercise.type === 'multiple_choice' ? index === null ? null : { index } : { indices }
  const complete = exercise.type === 'fill_in_blank' ? text.trim().length > 0
    : exercise.type === 'multiple_choice' ? index !== null : indices.length === exercise.content.parts.length
  const task = exercise.translation?.task

  return <form className={styles.form} data-testid="path-exercise" data-exercise-id={exercise.id} data-exercise-type={exercise.type}
    onSubmit={event => { event.preventDefault(); if (complete && answer && !busy) onSubmit(answer) }}>
    <h3 className={styles.instruction}>{exercise.content.instruction || t(exercise.type === 'sentence_building' ? 'arrange' : exercise.type === 'multiple_choice' ? 'choose' : 'answer')}</h3>
    {exercise.content.prompt && <p className={styles.prompt}>{exercise.content.prompt}</p>}
    {exercise.type === 'fill_in_blank' && <p className={styles.sentence} lang="de" translate="no" id="path-sentence">
      {exercise.content.text_before}
      <span className={styles.gap}>
        <span className={styles.gapSlot} data-empty={text.trim() ? undefined : true} aria-hidden="true">{text.trim() || '…'}</span>
        <GapHint exercise={exercise} lang={lang} />
      </span>
      {exercise.content.text_after}
    </p>}
    {exercise.type === 'multiple_choice' && <p className={styles.sentence} lang="de" translate="no" id="path-question">{exercise.content.question}</p>}
    {task && onTranslationToggle && <button type="button" className={styles.translateToggle} data-testid="path-translate"
      aria-pressed={translationOpen} aria-controls={panel} onClick={onTranslationToggle}>
      <Languages size={18} aria-hidden="true" /><span>{t('translate')}</span>
    </button>}
    <TaskTranslation id={panel} text={task} lang={lang} open={translationOpen} />
    <fieldset disabled={busy} className={styles.fields}>
      <legend className="sr-only">{t('answer')}</legend>
      {exercise.type === 'fill_in_blank' && <>
        <label className={styles.label} htmlFor="path-answer">{t('answer')}</label>
        {exercise.content.needs_article && <p id="path-article">{t('article')}</p>}
        <input id="path-answer" data-testid="path-answer" lang="de" autoComplete="off" autoCapitalize="none" spellCheck={false}
          aria-describedby={`path-sentence${exercise.content.needs_article ? ' path-article' : ''}`} maxLength={4000}
          className={styles.input} value={text} onChange={event => setText(event.target.value)} autoFocus />
      </>}
      {exercise.type === 'multiple_choice' && <>
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
    <div className={`${styles.actions} ${styles.dock}`}><button type="submit" data-testid="path-check" className={styles.primary} disabled={busy || !complete}>
      {busy ? t('loading') : t(isTest ? 'save' : 'check')}
    </button></div>
  </form>
}
