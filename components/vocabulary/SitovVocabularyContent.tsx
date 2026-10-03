'use client'

import { useId, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link2 } from 'lucide-react'
import { sitovVocabularyChunksTranslator } from '@/lib/vocabulary-chunks-i18n'
import { sitovVisibleUsageChunk, type SitovVocabularyContentKind, type SitovVocabularyKindFilter } from '@/lib/vocabulary-chunks'
import styles from './SitovVocabularyChunks.module.css'

export function SitovVocabularyKindBadge({ kind = 'vocabulary', lang }: { kind?: SitovVocabularyContentKind; lang?: string }) {
  const t = sitovVocabularyChunksTranslator(lang)
  return <span className={styles.badge} data-kind={kind}>
    {kind === 'chunk' && <Link2 size={14} aria-hidden="true" />}{t(kind === 'chunk' ? 'chunk' : 'word')}
  </span>
}

export function SitovVocabularyKindPicker({ value, counts, lang, onChange }: {
  value: SitovVocabularyKindFilter
  counts: Record<SitovVocabularyKindFilter, number>
  lang?: string
  onChange: (kind: SitovVocabularyKindFilter) => void
}) {
  const t = sitovVocabularyChunksTranslator(lang)
  const reducedMotion = useReducedMotion()
  const id = useId()
  const options = ['all', 'vocabulary', 'chunk'] as const
  return <div>
    <div role="radiogroup" aria-label={t('filter_aria')} className={styles.filter} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (options.indexOf(value) + step + options.length) % options.length
      onChange(options[next])
      document.getElementById(`${id}-${options[next]}`)?.focus()
    }}>
      {options.map(kind => <button key={kind} id={`${id}-${kind}`} type="button" role="radio" aria-checked={value === kind}
        tabIndex={value === kind ? 0 : -1} className={styles.filterOption} onClick={() => onChange(kind)}>
        {value === kind && <motion.span aria-hidden="true" className={styles.filterPill} layoutId={`${id}-selection`}
          transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 35 }} />}
        <span>{t(kind === 'vocabulary' ? 'words' : kind === 'chunk' ? 'chunks' : 'all')}</span>
        <span className={styles.count}>{counts[kind]}</span>
      </button>)}
    </div>
    <p className={styles.hint}>{t('chunk_explanation')}</p>
  </div>
}

/** On-card usage, never a second learning card. Render only after revealing a trainer answer. */
export function SitovVocabularyUsage({ word, usageChunk, usageChunkTranslation, example, exampleTranslation, lang, renderAudio, presentation = 'trainer' }: {
  word: string
  usageChunk?: string | null
  usageChunkTranslation?: string | null
  example?: string | null
  exampleTranslation?: string | null
  lang?: string
  /** The trainer supplies the shared player; browsing lists do not prefetch audio. */
  renderAudio?: (text: string) => ReactNode
  presentation?: 'trainer' | 'list'
}) {
  const t = sitovVocabularyChunksTranslator(lang)
  const id = useId()
  const reducedMotion = useReducedMotion()
  const chunk = sitovVisibleUsageChunk(word, usageChunk)
  const [selected, setSelected] = useState<'chunk' | 'example'>('chunk')
  if (!chunk && !example) return null
  const hasTabs = !!chunk && !!example
  const active = chunk && (!example || selected === 'chunk') ? 'chunk' : 'example'
  return <section className={styles.usage} aria-label={t('usage_aria')} data-presentation={presentation} data-card-interactive>
    {hasTabs && <div role="tablist" aria-label={t('usage_aria')} className={styles.usageTabs} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const next = event.key === 'Home' ? 'chunk' : event.key === 'End' ? 'example' : active === 'chunk' ? 'example' : 'chunk'
      setSelected(next)
      document.getElementById(`${id}-${next}`)?.focus()
    }}>
      {(['chunk', 'example'] as const).map(tab => <button key={tab} type="button" role="tab" id={`${id}-${tab}`}
        aria-selected={active === tab} aria-controls={`${id}-panel`} tabIndex={active === tab ? 0 : -1}
        onClick={() => setSelected(tab)} className={styles.usageTab}>{t(tab === 'chunk' ? 'usage_chunk' : 'example')}</button>)}
    </div>}
    <motion.div key={active} id={`${id}-panel`} role={hasTabs ? 'tabpanel' : undefined} aria-labelledby={hasTabs ? `${id}-${active}` : undefined}
      className={styles.usagePanel} initial={reducedMotion ? false : { opacity: 0, y: 4 }} animate={reducedMotion ? undefined : { opacity: 1, y: 0 }} transition={{ duration: .18 }}>
      {!hasTabs && <span className={styles.usageLabel}>{t(active === 'chunk' ? 'usage_chunk' : 'example')}</span>}
      <p lang="de" className={active === 'chunk' ? styles.usageChunk : styles.usageExample}>{active === 'chunk' ? chunk : example}</p>
      {(active === 'chunk' ? usageChunkTranslation : exampleTranslation) && <p lang={lang} className={styles.usageTranslation}>{active === 'chunk' ? usageChunkTranslation : exampleTranslation}</p>}
      {renderAudio && <div className="mt-2">{renderAudio((active === 'chunk' ? chunk : example) ?? '')}</div>}
    </motion.div>
  </section>
}
