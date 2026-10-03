'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { useReducedMotion } from 'framer-motion'
import { Check, Headphones, Languages, Mail, MessageCircle, Mic } from 'lucide-react'
import AudioRecorder from '@/components/audio/AudioRecorder'
import WaveformPlayer from '@/components/audio/WaveformPlayer'
import KaraokeText from '@/components/audio/KaraokeText'
import Mailbox from '@/components/audio/Mailbox'
import NewBadge from '@/components/motion/NewBadge'
import { useLearningNew } from '@/components/dashboard/useLearningNew'
import type { LearningNewItems } from '@/lib/learning-new'
import SolutionAudioButton, { type SitovAudioControl } from '@/components/exercises/SolutionAudioButton'
import { prefetchNeuralAudio } from '@/lib/audio/neural-client'
import { createPronunciationTranslator, type PronunciationTranslations } from '@/lib/pronunciation-i18n'
import type { PronunciationConversation } from '@/lib/pronunciation-conversations'
import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { usePronunciationCheckpoint } from '@/lib/audio/usePronunciationCheckpoint'
import type { PronunciationCheckpointSnapshot } from '@/lib/pronunciation-checkpoint'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import SitovPronunciationScene from '@/components/audio/SitovPronunciationScene'
import SitovPronunciationReadinessCard, { SitovLockedReadings } from '@/components/audio/SitovPronunciationReadinessCard'
import type { SitovPronunciationReadiness } from '@/lib/sitov-pronunciation-readiness'
import { sitovReadingCopy } from '@/lib/sitov-reading-i18n'
import styles from './PronunciationStudio.module.css'

export type StudioTab = 'studio' | 'mailbox'
type TextStatus = 'new' | 'sent' | 'answered' | 'unread'
type RecorderPhase = 'idle' | 'recording' | 'review' | 'submitted'

/** Stand je Text aus dem jüngsten Gespräch dazu (die Liste ist nach letzter Nachricht sortiert). */
function textStatuses(conversations: readonly PronunciationConversation[]): Map<string, TextStatus> {
  const statuses = new Map<string, TextStatus>()
  for (const conversation of conversations) {
    if (!conversation.promptId || statuses.has(conversation.promptId)) continue
    const answered = conversation.messages.some(message => message.senderRole !== 'student')
    statuses.set(conversation.promptId, conversation.hasUnseen ? 'unread' : answered ? 'answered' : 'sent')
  }
  return statuses
}

/**
 * Das Sprechstudio: Ein Reiter zum Sprechen, einer für die Post der Lehrkraft.
 * Die drei Schritte leuchten nacheinander auf, die Texte stehen als Karten mit
 * ihrem Stand da, und beim Anhören des Vorbilds liest man Wort für Wort mit.
 */
export default function PronunciationStudio({ prompts, conversations, level, lang, translations, initialTab = 'studio', newItems, focusConversation, checkpoint, checkpointUnavailable, learnerId, readiness }: {
  prompts: readonly PronunciationPrompt[]
  conversations: PronunciationConversation[]
  level: string
  lang: string
  translations: PronunciationTranslations
  initialTab?: StudioTab
  /** Neue Texte (Phase 6.1); ein Text gilt als gesehen, wenn die Person ihn antippt. */
  newItems?: LearningNewItems
  /** Gespräch aus dem Link der Benachrichtigungs-Mail; wird beim Laden geöffnet. */
  focusConversation?: string
  checkpoint?: PronunciationCheckpointSnapshot | null
  checkpointUnavailable?: boolean
  learnerId?: string
  readiness?: SitovPronunciationReadiness | null
}) {
  const s = studentTranslator(lang)
  const router = useRouter()
  const reduced = useReducedMotion() ?? false
  const [tab, setTab] = useState<StudioTab>(initialTab)
  const statuses = useMemo(() => textStatuses(conversations), [conversations])
  const unread = conversations.filter(conversation => conversation.hasUnseen).length

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') router.refresh() }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [router])

  function switchTab(next: StudioTab) {
    setTab(next)
    try {
      const url = new URL(window.location.href)
      if (next === 'mailbox') url.searchParams.set('tab', 'mailbox')
      else url.searchParams.delete('tab')
      window.history.replaceState(window.history.state, '', url)
    } catch { /* Adresszeile ist nur Bequemlichkeit */ }
    window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' })
  }

  return (
    <div className={`${styles.sitovStudio} pronunciation-practice mx-auto w-full max-w-6xl space-y-6 text-[var(--foreground)]`}>
      <div role="tablist" aria-label={s('area_pronunciation')} className={`${styles.sitovTabs} st-segment`} style={{ '--st-active': tab === 'studio' ? 0 : 1 } as CSSProperties}>
        <span className="st-segment__pill" aria-hidden="true" />
        {(['studio', 'mailbox'] as const).map(value => (
          <button key={value} type="button" role="tab" id={`studio-tab-${value}`} aria-selected={tab === value} aria-controls={`studio-panel-${value}`}
            onClick={() => switchTab(value)} className="st-segment__option st-press">
            {value === 'studio' ? <Mic size={20} aria-hidden="true" /> : <Mail size={20} aria-hidden="true" />}
            <span>{s(value === 'studio' ? 'studio_tab' : 'mailbox_tab')}</span>
            {value === 'mailbox' && unread > 0 && <span className="st-segment__badge" aria-label={s.count('mailbox_new', unread)}>{unread}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="studio-panel-studio" aria-labelledby="studio-tab-studio" className={styles.sitovPanel} hidden={tab !== 'studio'}>
        <Studio prompts={prompts} statuses={statuses} level={level} lang={lang} translations={translations} newItems={newItems} onOpenMailbox={() => switchTab('mailbox')} checkpoint={checkpoint} checkpointUnavailable={checkpointUnavailable} learnerId={learnerId} readiness={readiness} />
      </div>
      <div role="tabpanel" id="studio-panel-mailbox" aria-labelledby="studio-tab-mailbox" className={styles.sitovPanel} hidden={tab !== 'mailbox'}>
        {tab === 'mailbox' && <Mailbox conversations={conversations} lang={lang} translations={translations} focusId={focusConversation} />}
      </div>
    </div>
  )
}

function Studio({ prompts, statuses, level, lang, translations, onOpenMailbox, newItems, checkpoint, checkpointUnavailable, learnerId, readiness }: {
  prompts: readonly PronunciationPrompt[]
  statuses: Map<string, TextStatus>
  level: string
  lang: string
  translations: PronunciationTranslations
  onOpenMailbox: () => void
  newItems?: LearningNewItems
  checkpoint?: PronunciationCheckpointSnapshot | null
  checkpointUnavailable?: boolean
  learnerId?: string
  readiness?: SitovPronunciationReadiness | null
}) {
  const t = createPronunciationTranslator(translations)
  const router = useRouter()
  const readingCopy = sitovReadingCopy(lang)
  const s = studentTranslator(lang)
  const news = useLearningNew(newItems)
  const reduced = useReducedMotion() ?? false
  const saved = usePronunciationCheckpoint({ level, prompts, initial: checkpoint, initialUnavailable: checkpointUnavailable, learnerId,
    fallbackPromptId: (prompts.find(prompt => !statuses.has(prompt.id)) ?? prompts[0])?.id })
  const selectedId = saved.reading.promptId
  const [recordingBusy, setRecordingBusy] = useState(false)
  const [phase, setPhase] = useState<RecorderPhase>('idle')
  const [following, setFollowing] = useState<number | null>(null)
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null)
  const cards = useRef<HTMLUListElement>(null)
  const reference = useRef<HTMLDivElement>(null)
  const audioControl = useRef<SitovAudioControl | null>(null)
  const selected = prompts.find(prompt => prompt.id === selectedId) ?? prompts[0]
  const hasTeacherReference = Boolean(selected?.audioUrl && !selected.audioUrl.includes('/audio_cache/'))
  const useOriginalReference = hasTeacherReference

  useEffect(() => {
    if (!selected) return
    return prefetchNeuralAudio([{ text: selected.sentenceDe, language: 'de', audioUrl: selected.audioUrl }])
  }, [selected?.sentenceDe, selected?.audioUrl])

  useEffect(() => {
    setFollowing(null); setActiveWordIndex(null); setPhase('idle')
    const card = cards.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    card?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: reduced ? 'instant' : 'smooth' })
  }, [selectedId, reduced])

  const referenceProgress = saved.referenceProgress
  const onReferenceProgress = useCallback((fraction: number | null) => {
    // The native clock remains exact; the progress strip needs only a tenth
    // of a percent. Avoid rerendering every word button on every audio frame.
    setFollowing(current => fraction !== null && current !== null && Math.round(current * 1000) === Math.round(fraction * 1000) ? current : fraction)
    referenceProgress(fraction)
  }, [referenceProgress])

  const readinessPanel = readiness !== undefined && <SitovPronunciationReadinessCard readiness={readiness} lang={lang} level={level} onRetry={() => router.refresh()} />
  if (!selected) return <div className="space-y-5">{readinessPanel}{readiness?.texts.length
    ? <SitovLockedReadings readiness={readiness} lang={lang} />
    : readiness === null ? null : <SitovMotionStage className={`${styles.sitovEmpty} st-empty st-empty--hero`}><SitovPronunciationScene compact /><h2>{t('prompts_empty')}</h2><p>{t('prompts_empty_hint')}</p></SitovMotionStage>}</div>

  const status = statuses.get(selected.id) ?? 'new'
  const wordCount = selected.sentenceDe.split(/\s+/).length
  const sent = status !== 'new' || phase === 'submitted'
  const answered = status === 'answered' || status === 'unread'
  const active = phase === 'recording' || phase === 'review' ? 1
    : phase === 'submitted' ? 2
      : answered ? 3
        : sent ? 2
          : saved.reading.listened ? 1 : 0
  const steps = [
    { key: 'studio_step_listen', icon: Headphones },
    { key: 'studio_step_record', icon: Mic },
    { key: 'studio_step_answer', icon: MessageCircle },
  ] as const

  return (
    <div className="space-y-6">
      <SitovMotionStage className={styles.sitovHero} data-sitov-surface>
        <div className={styles.sitovHeroCopy}>
          <div className={styles.sitovEyebrow}>{s('area_pronunciation')}<span>{level}</span></div>
          <h2>{t('record_title')}</h2>
          <p>{t('record_hint')}</p>
          <div className={styles.sitovHeroFoot}><Headphones size={17} aria-hidden="true" />{t('text_count', { count: prompts.length })}</div>
        </div>
        <SitovPronunciationScene state={phase === 'idle' && following !== null ? 'listening' : phase} />
      </SitovMotionStage>
      {readinessPanel}
      {saved.notice && <p role={saved.notice === 'failed' ? 'alert' : 'status'} className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
        <span>{t(saved.notice === 'failed' ? 'checkpoint_failed' : saved.notice === 'conflict' ? 'checkpoint_conflict' : saved.notice === 'saving' ? 'checkpoint_saving' : 'checkpoint_saved')}</span>
        {saved.notice === 'failed' && <button type="button" className="st-button st-button--quiet min-h-12" onClick={() => void saved.retry()}>{t('audio_retry')}</button>}
      </p>}
      <ol className={`${styles.sitovSteps} st-steps`} aria-label={s('studio_steps')}>
        {steps.map((step, index) => {
          const state = index < active ? 'done' : index === active ? 'active' : 'todo'
          return (
            <li key={step.key} className="st-steps__item" data-state={state} aria-current={state === 'active' ? 'step' : undefined}>
              <span className="st-steps__icon" aria-hidden="true">{state === 'done' ? <Check size={20} strokeWidth={3} /> : <step.icon size={20} />}</span>
              <span className="st-steps__label"><span className="st-steps__number" aria-hidden="true">0{index + 1}</span>{s(step.key)}</span>
              {index < steps.length - 1 && <span className={styles.sitovStepConnector} aria-hidden="true" />}
            </li>
          )
        })}
      </ol>

      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <SitovMotionStage className="min-w-0">
        <section aria-labelledby="studio-texts-title">
          <div className="st-section-head !mb-3">
            <div><h2 id="studio-texts-title" className="st-section-title">{s('studio_texts')}</h2>
              <p className="st-section-sub">{t('text_count', { count: prompts.length })} · {level}</p></div>
          </div>
          <ul ref={cards} className="st-textcards">
            {prompts.map((prompt, index) => {
              const textStatus = statuses.get(prompt.id) ?? 'new'
              const isSelected = prompt.id === selected.id
              return (
                <li key={prompt.id} className="st-textcards__item" style={{ '--i': Math.min(index, 8) } as CSSProperties}>
                  <button type="button" aria-pressed={isSelected} disabled={recordingBusy && !isSelected} onClick={() => { news.mark('pronunciation_text', prompt.id); saved.select(prompt.id) }}
                    className={`${styles.sitovTextCard} st-textcard st-press`} data-status={textStatus} data-sitov-surface>
                    <span className="st-textcard__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <span className="st-textcard__title">{prompt.title ?? prompt.sentenceDe}{news.isNew('pronunciation_text', prompt.id) && <NewBadge label={s('media_new')} className="st-new-item" />}</span>
                    <span className="st-textcard__status">
                      {textStatus === 'answered' && <Check size={15} strokeWidth={3} aria-hidden="true" />}
                      {textStatus === 'unread' && <span className="sl-due-dot" aria-hidden="true" />}
                      {s(textStatus === 'new' ? 'studio_text_new' : textStatus === 'sent' ? 'studio_text_sent' : textStatus === 'answered' ? 'studio_text_answered' : 'studio_text_unread')}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {readiness && <SitovLockedReadings readiness={readiness} lang={lang} />}
        </section>
        </SitovMotionStage>

        <div className="min-w-0 space-y-5">
          <article className={`${styles.sitovReading} st-reading`} data-sitov-listening={following !== null}>
            <span className={styles.sitovListeningTrack} style={{ transform: `scaleX(${Math.min(1, Math.max(0, following ?? saved.reading.referencePosition))})` }} aria-hidden="true" />
            <header className="st-reading__head">
              <div className="mb-3 flex flex-wrap gap-2 text-base font-semibold text-[var(--muted)]">
                <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1">{level}</span>
                <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1">{t('words', { count: wordCount })}</span>
                <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1">{t('reading_time', { minutes: Math.max(1, Math.ceil(wordCount / 70)) })}</span>
              </div>
              <h2 key={selected.id} className="text-2xl font-bold tracking-tight sm:text-3xl">{selected.title ?? t('reference_label')}</h2>
              {selected.focus && <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">{t('prompt_focus', { focus: selected.focus })}</p>}
            </header>
            <div className="st-reading__body">
              <div data-testid="pronunciation-reading-text">
                <KaraokeText key={selected.id} text={selected.sentenceDe} progress={following} activeWordIndex={useOriginalReference ? undefined : activeWordIndex} className="st-karaoke whitespace-pre-line"
                  wordLookup={{ promptId: selected.id, level, locale: lang, onSelect: () => {
                    audioControl.current?.pause()
                    reference.current?.querySelector('audio')?.pause()
                  } }} />
              </div>
              <span data-testid="pronunciation-text-end" className="pronunciation-text-end block h-px" aria-hidden="true" />
              <p className="st-reading__follow"><Headphones size={18} aria-hidden="true" />{s('studio_follow')}</p>
              <p className={styles.sitovWordHint}><Languages size={17} aria-hidden="true" />{readingCopy.hint}</p>
              <div ref={reference} className="mt-4 space-y-3">
                {useOriginalReference
                  ? <WaveformPlayer key={`${selected.id}:${saved.restoreVersion}`} src={selected.audioUrl} level={level} t={t} label={t('reference_listen')} initialProgress={saved.initialProgress}
                      onProgress={state => {
                        if (state.fraction > 0) onReferenceProgress(state.fraction)
                        if (!state.playing) onReferenceProgress(null)
                      }} />
                  : <SolutionAudioButton key={`${selected.id}:${saved.restoreVersion}`} text={selected.sentenceDe} audioUrl={hasTeacherReference ? null : selected.audioUrl} level={level} language="de" initialProgress={saved.initialProgress}
                      layout="reading" resumeLabel={readingCopy.resume} restartLabel={readingCopy.restart} restartAriaLabel={readingCopy.restartAria} controlRef={audioControl}
                      label={t('reference_listen')} ariaLabel={t('reference_listen_aria')} onProgress={onReferenceProgress} onWordChange={setActiveWordIndex} />}
              </div>
            </div>
          </article>

          {answered && (
            <div className="st-answer-banner st-rise" role="status">
              <span className="st-answer-banner__icon" aria-hidden="true"><Mail size={22} /></span>
              <p className="min-w-0 flex-1 font-semibold">{s('studio_answer_ready')}</p>
              <button type="button" onClick={onOpenMailbox} className="st-button st-button--primary st-press">{s('studio_answer_open')}</button>
            </div>
          )}
          {!answered && status === 'sent' && phase === 'idle' && <p className="st-answer-banner st-answer-banner--calm st-rise" role="status">{s('studio_sent_waiting')}</p>}

          <AudioRecorder key={selected.id} promptId={selected.id} level={level} translations={translations}
            onRecordingStateChange={setRecordingBusy} onPhaseChange={setPhase} mobileFloating />
          <p className="px-3 text-center text-base leading-relaxed text-[var(--muted)]">{t('recording_privacy')}</p>
        </div>
      </div>
    </div>
  )
}
