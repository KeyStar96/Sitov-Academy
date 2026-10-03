'use client'

import { type CSSProperties } from 'react'
import { CheckCheck, RotateCw } from 'lucide-react'
import styles from './SitovVocabularyMotion.module.css'

/** Paper, light and depth describe the trainer; these illustrations never imply progress. */
export function SitovVocabularyDeck() {
  return <div className={styles.sitovDeck} aria-hidden="true">
    <span className={styles.sitovDeckHalo} />
    <span className={styles.sitovDeckOrbit} />
    <span className={styles.sitovDeckOrbit} data-inner="true" />
    <span className={styles.sitovDeckShadow} />
    {(['der', 'die', 'das'] as const).map((article, index) => <span className={styles.sitovDeckCard} key={article}
      style={{ '--sitov-card-index': index } as CSSProperties} data-article={article}>
      <b lang="de">{article}</b><i /><i />
    </span>)}
    <span className={styles.sitovDeckSpark} /><span className={styles.sitovDeckSpark} data-second="true" />
  </div>
}

export function SitovVocabularyCardMark() {
  return <span className={styles.sitovCardMark} aria-hidden="true"><i /><i /><i /></span>
}

export function SitovVocabularyFeedback({ correct }: { correct: boolean }) {
  return <span className={styles.sitovFeedbackMark} data-correct={correct} aria-hidden="true">
    {correct ? <CheckCheck size={20} strokeWidth={2.5} /> : <RotateCw size={19} />}
    {correct && Array.from({ length: 6 }, (_, index) => <i key={index} style={{ '--sitov-spark-index': index } as CSSProperties} />)}
  </span>
}

export function SitovVocabularyCompletion() {
  return <div className={styles.sitovCompletion} aria-hidden="true">
    <span /><span /><CheckCheck size={36} strokeWidth={2} />
    {Array.from({ length: 8 }, (_, index) => <i key={index} style={{ '--sitov-spark-index': index } as CSSProperties} />)}
  </div>
}
