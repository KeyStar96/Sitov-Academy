'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import { Check, ListChecks, X } from 'lucide-react'
import type { TestResult, TestReview as TestReviewData } from '@/lib/learning-path-contract'
import { pathTranslator } from '@/lib/learning-path-i18n'
import { OrthographyNote } from '@/components/exercises/SoftErrorBadge'
import { GapHint } from './PathExerciseForm'
import styles from './learning-path.module.css'

type ReviewItem = TestResult['answers'][number]
type Filter = 'all' | 'wrong'

/** Die eigene Antwort als Text, genau so, wie sie gespeichert wurde. */
export function answerText(item: ReviewItem): string {
  if ('text' in item.answer) return item.answer.text
  if ('index' in item.answer && item.type === 'multiple_choice') return item.content.options[item.answer.index] ?? ''
  if ('indices' in item.answer && item.type === 'sentence_building') return item.answer.indices.map(index => item.content.parts[index]).join(' ')
  return ''
}

function Task({ item, lang }: { item: ReviewItem; lang: string }) {
  if (item.type === 'fill_in_blank') return <p className={styles.reviewTask} lang="de" translate="no">
    {item.content.text_before}<span className={styles.gap}><span className={styles.gapSlot} data-empty aria-hidden="true">…</span>
      <GapHint exercise={item} lang={lang} /></span>{item.content.text_after}
  </p>
  if (item.type === 'multiple_choice') return <p className={styles.reviewTask} lang="de" translate="no">{item.content.question}</p>
  return null
}

/**
 * Testauswertung (Phase 8, Punkt 3): Ergebnis oben, darunter jede Aufgabe mit
 * der eigenen Antwort und der richtigen Lösung. Fehler stehen zuerst im Fokus
 * („Nur Fehler"); richtige Antworten sind grün, falsche ruhig orange — nie rot.
 */
export default function TestReview({ review, lang, actions }: {
  review: TestResult & Pick<Partial<TestReviewData>, 'completed_at'>; lang: string; actions: ReactNode
}) {
  const t = pathTranslator(lang)
  const total = review.answers.length
  const wrong = review.answers.filter(item => !item.result.correct).length
  const [filter, setFilter] = useState<Filter>(wrong > 0 ? 'wrong' : 'all')
  const score = Math.floor(review.percentage)
  const date = review.completed_at ? new Intl.DateTimeFormat(lang, { dateStyle: 'long' }).format(new Date(review.completed_at)) : null
  const shown = review.answers.map((item, index) => ({ item, number: index + 1 }))
    .filter(({ item }) => filter === 'all' || !item.result.correct)

  return <div className={styles.review} data-testid="path-test-review">
    <header className={styles.reviewSummary} data-passed={review.passed}>
      <span className={styles.reviewIcon} aria-hidden="true"><ListChecks size={28} strokeWidth={2.4} /></span>
      <div className="min-w-0 flex-1">
        <p className={styles.reviewTop}>
          <span className={styles.reviewPercent}>{score}&thinsp;%</span>
          <span className={styles.chip} data-tone={review.passed ? 'success' : 'path'}>{t(review.passed ? 'passed' : 'goal')}</span>
        </p>
        <p className={styles.reviewScore}>{t('review_score', { correct: total - wrong, total })}</p>
        {date && <p className={styles.reviewDate}>{t('review_date', { date })}</p>}
      </div>
    </header>
    <div className={styles.segmented} role="radiogroup" aria-label={t('review_filter_label')}>
      {(['wrong', 'all'] as const).map(value => <button key={value} type="button" role="radio" aria-checked={filter === value}
        data-testid={`path-review-filter-${value}`} onClick={() => setFilter(value)}>
        {t(value === 'all' ? 'review_filter_all' : 'review_filter_wrong')}
        <span className={styles.segmentedCount}>{value === 'all' ? total : wrong}</span>
      </button>)}
    </div>
    {shown.length === 0 ? <p className={styles.reviewEmpty} role="status"><Check size={22} aria-hidden="true" />{t('review_all_correct')}</p>
      : <ol className={styles.reviewList}>
        {shown.map(({ item, number }, position) => {
          const given = answerText(item)
          const soft = item.result.status === 'SOFT_ERROR'
          return <li key={item.id} className={styles.reviewItem} data-correct={item.result.correct} data-testid="path-review-item"
            style={{ '--i': String(Math.min(position, 8)) } as CSSProperties}>
            <p className={styles.reviewHead}>
              <span className={styles.reviewBadge} aria-hidden="true">{item.result.correct ? <Check size={16} strokeWidth={3} /> : <X size={16} strokeWidth={3} />}</span>
              <span>{t('review_item', { number })}</span>
              <span className="sr-only">: {t(item.result.correct ? 'review_correct' : 'review_wrong')}</span>
            </p>
            {item.content.instruction && <p className={styles.reviewInstruction}>{item.content.instruction}</p>}
            <Task item={item} lang={lang} />
            <dl className={styles.reviewAnswers}>
              <div data-kind="given" data-correct={item.result.correct}>
                <dt>{t('review_your_answer')}</dt>
                <dd lang="de" translate="no">{given || <span className={styles.reviewMissing}>{t('review_no_answer')}</span>}</dd>
              </div>
              {(!item.result.correct || soft) && <div data-kind="solution">
                <dt>{t('solution')}</dt>
                <dd lang="de" translate="no">{item.solution.content.correct_answer}</dd>
              </div>}
            </dl>
            {item.result.fields.map(field => <div key={field.id}>
              {field.reason && <p className={styles.reviewNote}>{t(field.reason)}</p>}
              {field.hint && <OrthographyNote lang={lang} solution={field.matched ?? item.solution.content.correct_answer} />}
            </div>)}
            {!item.result.correct && item.solution.explanation && <p className={styles.reviewExplanation}>{item.solution.explanation}</p>}
          </li>
        })}
      </ol>}
    <div className={`${styles.actions} ${styles.dock}`}>{actions}</div>
  </div>
}
