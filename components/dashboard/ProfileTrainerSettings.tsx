'use client'

import { useId, useState } from 'react'
import { Check, Keyboard, Layers3, SlidersHorizontal, Volume2 } from 'lucide-react'
import SlidingPill from '@/components/motion/SlidingPill'
import { useVocabularyRoundSize, useVocabularyStudyMode } from '@/lib/sitov-trainer-preferences'
import { usePlaybackRatePreference } from '@/lib/audio/usePlaybackRate'
import { PLAYBACK_RATES } from '@/lib/audio/playback-settings'
import { ROUND_SIZE_OPTIONS } from '@/lib/vocabulary-rounds'
import { getSitovTrainerSettingsCopy } from '@/lib/sitov-trainer-settings-i18n'
import { toUiLocale } from '@/lib/locale-routing'
import styles from './ProfileTrainerSettings.module.css'

export default function ProfileTrainerSettings({ lang }: { lang: string }) {
  const copy = getSitovTrainerSettingsCopy(lang)
  const locale = toUiLocale(lang)
  const id = useId()
  const [size, setSize] = useVocabularyRoundSize()
  const [mode, setMode] = useVocabularyStudyMode()
  const [rate, setRate] = usePlaybackRatePreference()
  const [applied, setApplied] = useState(false)
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })

  return <section className={styles.sitovSettings} aria-labelledby={`${id}-title`}>
    <header className={styles.sitovHeader}>
      <span className={styles.sitovIcon} aria-hidden="true"><SlidersHorizontal size={25} /></span>
      <div><h2 id={`${id}-title`}>{copy.title}</h2><p>{copy.device}</p></div>
      <span className={styles.sitovStatus} role="status" aria-live="polite">
        {applied && <><Check size={17} aria-hidden="true" /><span>{copy.applied}</span></>}
      </span>
    </header>

    <div className={styles.sitovCard}>
      <h3><Layers3 size={21} aria-hidden="true" />{copy.vocabulary}</h3>
      <fieldset className={styles.sitovField}>
        <legend>{copy.roundSize}</legend>
        <div className={styles.sitovSizes}>
          {ROUND_SIZE_OPTIONS.map(option => <label key={option} className={`${styles.sitovOption} st-press`} data-active={size === option || undefined}>
            <input type="radio" name={`${id}-round`} value={option} checked={size === option}
              onChange={() => { setSize(option); setApplied(true) }} className="sr-only" />
            {size === option && <SlidingPill group={`${id}-round`} className={styles.sitovPill} />}
            <span className={styles.sitovFace}>{option === 'all' ? copy.all : option}</span>
          </label>)}
        </div>
      </fieldset>
      <fieldset className={styles.sitovField}>
        <legend>{copy.studyMode}</legend>
        <div className={styles.sitovModes}>
          {(['flashcard', 'typed'] as const).map(option => <label key={option} className={`${styles.sitovOption} st-press`} data-active={mode === option || undefined}>
            <input type="radio" name={`${id}-mode`} value={option} checked={mode === option}
              onChange={() => { setMode(option); setApplied(true) }} className="sr-only" />
            {mode === option && <SlidingPill group={`${id}-mode`} className={styles.sitovPill} />}
            <span className={styles.sitovFace}>
              {option === 'flashcard' ? <Layers3 size={18} aria-hidden="true" /> : <Keyboard size={18} aria-hidden="true" />}
              {copy[option]}
            </span>
          </label>)}
        </div>
      </fieldset>
    </div>

    <div className={styles.sitovCard}>
      <h3><Volume2 size={21} aria-hidden="true" />{copy.audio}</h3>
      <label className={styles.sitovField} htmlFor={`${id}-speed`}>
        <span>{copy.speed}</span>
        <select id={`${id}-speed`} value={rate ?? 'auto'} onChange={event => {
          setRate(event.target.value === 'auto' ? null : Number(event.target.value)); setApplied(true)
        }} className={styles.sitovSelect}>
          <option value="auto">{copy.automatic}</option>
          {PLAYBACK_RATES.map(value => <option value={value} key={value}>{number.format(value)}×</option>)}
        </select>
      </label>
    </div>
  </section>
}
