'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Check, Clock3, Search, Trash2, X } from 'lucide-react'
import SitovLearningBox, { type SitovLearningBoxBucket } from '@/components/learning/SitovLearningBox'
import SitovTrainerHelp from '@/components/motion/SitovTrainerHelp'
import { useScrollLock } from '@/components/ui/useScrollLock'
import { buildSitovVerbLearningBox, SITOV_VERB_REVIEW_DAYS, sitovVerbBoxValue, type SitovVerbBoxCard, type SitovVerbBoxKey } from '@/lib/verbs/learning-box'
import { getSitovVerbBoxCopy, sitovVerbBoxText } from '@/lib/verbs/learning-box-i18n'
import { getSitovVerbCopy } from '@/lib/verbs/i18n'
import { sitovTrainerUiCopy } from '@/lib/sitov-trainer-ui-i18n'
import { toUiLocale } from '@/lib/locale-routing'
import type { SitovVerbTrainerState } from '@/lib/verbs/contracts'
import type { SitovVerbTense } from '@/lib/verbs/types'
import SitovVerbLearningGuide from './SitovVerbLearningGuide'
import styles from './VerbLearningBox.module.css'

function sitovDate(value: string | null, lang: string): string | null {
  const time = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(time) ? new Intl.DateTimeFormat(toUiLocale(lang), {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin',
  }).format(time) : null
}
function sitovBoxName(key: SitovVerbBoxKey, lang: string): string {
  const copy = getSitovVerbBoxCopy(lang)
  return key === 'learned' ? copy.learned : `${sitovVerbBoxText(copy.phase, { box: key })} · ${copy.names[key - 1]}`
}

function SitovVerbBoxInspector({ phase, cards, state, lang, busy, opener, onClose, onPractice, onRemove }: {
  phase: SitovVerbBoxKey; cards: SitovVerbBoxCard[]; state: SitovVerbTrainerState; lang: string; busy: boolean;
  opener: HTMLElement | null; onClose: () => void; onPractice: (phase: SitovVerbBoxKey) => void; onRemove: (id: string) => Promise<boolean>
}) {
  const copy = getSitovVerbBoxCopy(lang)
  const trainerCopy = getSitovVerbCopy(lang)
  const locale = toUiLocale(lang)
  const titleId = useId()
  const hintId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const [search, setSearch] = useState('')
  const [tense, setTense] = useState<SitovVerbTense | 'all'>('all')
  const [readyOnly, setReadyOnly] = useState(false)
  useScrollLock(true)

  useEffect(() => {
    const panel = dialog.current
    if (!panel) return
    if (typeof panel.showModal === 'function') panel.showModal()
    else panel.setAttribute('open', '')
    closeButton.current?.focus({ preventScroll: true })
    return () => {
      if (panel.open && typeof panel.close === 'function') panel.close()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [opener])

  const members = cards.filter(card => card.key === phase)
  const matching = members.filter(card => {
    const forms = card.forms.filter(form => tense === 'all' || form.tense === tense)
    return forms.length && (!readyOnly || forms.some(form => form.due))
      && `${card.verb.infinitive} ${card.verb.translations[locale]}`.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale))
  })

  return createPortal(<dialog ref={dialog} className={styles.sitovInspector} lang={locale} aria-labelledby={titleId} aria-describedby={hintId}
    onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className={styles.sitovPanel}>
      <header className={styles.sitovInspectorHead}>
        <div><span className={styles.sitovScope}>{copy.scope}</span><h2 id={titleId}>{sitovBoxName(phase, lang)}</h2>
          <p>{sitovVerbBoxText(members.length === 1 ? copy.verbCountOne : copy.verbCount, { count: members.length })}</p></div>
        <button ref={closeButton} type="button" onClick={onClose} className={styles.sitovIconButton} aria-label={copy.close}><X size={21} aria-hidden="true" /></button>
      </header>
      <p id={hintId} className="sr-only">{copy.intro}</p>
      <div className={styles.sitovInspectorFilters}>
        <label className={styles.sitovSearch}><Search size={18} aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={copy.search} aria-label={copy.search} /></label>
        <label className={styles.sitovTenseFilter}><span className="sr-only">{copy.allTenses}</span><select value={tense} onChange={event => setTense(event.target.value as SitovVerbTense | 'all')}>
          <option value="all">{copy.allTenses}</option>{state.tenses.map(value => <option key={value} value={value}>{trainerCopy[value]}</option>)}</select></label>
        <label className={styles.sitovOnly}><input type="checkbox" checked={readyOnly} onChange={event => setReadyOnly(event.target.checked)} />{copy.readyOnly}</label>
      </div>
      <div className={styles.sitovInspectorList}>
        {!matching.length ? <p className={styles.sitovEmpty}>{members.length ? copy.noResults : copy.empty}</p>
          : <ul>{matching.map(card => <li key={card.verb.id} className={styles.sitovVerbCard} data-sitov-verb-box={card.box}>
            <div className={styles.sitovVerbHead}><div><span className={styles.sitovVerbLevel}>{card.verb.level}</span>
              <strong lang="de" translate="no">{card.verb.infinitive}</strong><p>{card.verb.translations[locale]}</p></div>
              <button type="button" className={styles.sitovIconButton} disabled={busy} onClick={async () => { if (!await onRemove(card.verb.id)) onClose() }} aria-label={`${copy.remove}: ${card.verb.infinitive}`} title={copy.retained}><Trash2 size={18} aria-hidden="true" /></button></div>
            <dl className={styles.sitovForms}>{card.forms.map(form => {
              const reviewDate = sitovDate(form.progress?.nextReviewAt ?? null, lang)
              const answeredDate = sitovDate(form.progress?.lastAnsweredAt ?? null, lang)
              return <div key={form.tense} data-box={form.box} data-due={form.due} data-matching={tense === 'all' || form.tense === tense}>
                <dt>{trainerCopy[form.tense]}<span>{sitovBoxName(form.key, lang)}</span>{form.box === 7 && <Check size={16} aria-hidden="true" />}</dt>
                <dd className={styles.sitovReview}>{form.box === 7 ? <><Check size={14} aria-hidden="true" />{copy.longTerm}</> : <><Clock3 size={14} aria-hidden="true" />{!form.progress?.attempts ? copy.newForm : form.due ? copy.dueNow : <><span>{copy.nextReview}</span><time dateTime={form.progress.nextReviewAt!}>{reviewDate}</time></>}</>}</dd>
                {!!form.progress?.attempts && <dd className={styles.sitovFormReceipt}>
                  <span>{sitovVerbBoxText(copy.correct, { count: form.progress.correct })} / {sitovVerbBoxText(copy.tries, { count: form.progress.attempts })}</span>
                  {answeredDate && <span>{copy.lastAnswer}: <time dateTime={form.progress.lastAnsweredAt!}>{answeredDate}</time></span>}
                </dd>}
              </div>
            })}</dl>
            {card.partlyAhead && <p className={styles.sitovAhead}><Check size={14} aria-hidden="true" />{copy.partlyAhead}</p>}
          </li>)}</ul>}
      </div>
      <footer className={styles.sitovInspectorFooter}><p>{copy.retained}</p>{phase !== 'learned' && <button type="button" disabled={busy || !members.some(card => card.forms.some(form => form.due))} className={styles.sitovPractice} onClick={() => { onClose(); onPractice(phase) }}>{copy.practice}<ArrowRight size={18} aria-hidden="true" /></button>}</footer>
    </div>
  </dialog>, document.body)
}

export default function VerbLearningBox({ state, lang, busy, onPractice, onRemove }: {
  state: SitovVerbTrainerState; lang: string; busy: boolean; onPractice: (phase: SitovVerbBoxKey) => void;
  onRemove: (id: string) => Promise<boolean>
}) {
  const copy = getSitovVerbBoxCopy(lang)
  const uiCopy = sitovTrainerUiCopy(lang)
  const box = useMemo(() => buildSitovVerbLearningBox(state), [state])
  const [inspector, setInspector] = useState<{ phase: SitovVerbBoxKey; opener: HTMLElement } | null>(null)
  const phase = inspector?.phase ?? null
  const buckets: SitovLearningBoxBucket[] = box.buckets.map(bucket => {
    const label = copy.names[sitovVerbBoxValue(bucket.key) - 1]
    const days = SITOV_VERB_REVIEW_DAYS[sitovVerbBoxValue(bucket.key) - 1]
    return { ...bucket, label, interval: bucket.key === 'learned' ? copy.longTerm : bucket.key === 1 ? copy.initial : days === 1 ? copy.day : sitovVerbBoxText(copy.days, { days: days ?? 0 }),
      countLabel: sitovVerbBoxText(bucket.count === 1 ? copy.verbCountOne : copy.verbCount, { count: bucket.count }), dueLabel: sitovVerbBoxText(copy.dueVerbs, { count: bucket.due }),
      halfKnownLabel: sitovVerbBoxText(copy.ahead, { count: bucket.halfKnown }), openLabel: sitovVerbBoxText(copy.open, { name: sitovBoxName(bucket.key, lang) }) }
  })

  return <>
    <SitovLearningBox title={copy.title} intro={copy.intro} scopeLabel={copy.scope} progressLabel={copy.progress} percent={box.progressPercent} tapHint={copy.tap}
      selected={phase} buckets={buckets} onOpen={(key, from) => setInspector({ phase: key, opener: from })}
      stats={[{ key: 'verbs', label: copy.selected, value: box.totalVerbs }, { key: 'practiced', label: copy.practiced, value: box.practicedForms },
        { key: 'learned', label: copy.learnedVerbs, value: box.learnedVerbs }, { key: 'due', label: copy.dueForms, value: box.dueForms }]}>
      <SitovTrainerHelp title={uiCopy.help} className={styles.sitovGuide}>
      <SitovVerbLearningGuide lang={lang} tenses={state.tenses} />
      </SitovTrainerHelp>
    </SitovLearningBox>
    {inspector && <SitovVerbBoxInspector key={inspector.phase} phase={inspector.phase} cards={box.cards} state={state} lang={lang} busy={busy} opener={inspector.opener}
      onClose={() => setInspector(null)} onPractice={onPractice} onRemove={onRemove} />}
  </>
}
