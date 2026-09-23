'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { useReducedMotion } from 'framer-motion'
import { BookOpen, Check, Headphones, Mail, MessageCircle, Mic } from 'lucide-react'
import AudioRecorder from '@/components/audio/AudioRecorder'
import WaveformPlayer from '@/components/audio/WaveformPlayer'
import KaraokeText from '@/components/audio/KaraokeText'
import Mailbox from '@/components/audio/Mailbox'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import { prefetchNeuralAudio } from '@/lib/audio/neural-client'
import { createPronunciationTranslator, type PronunciationTranslations } from '@/lib/pronunciation-i18n'
import type { PronunciationConversation } from '@/lib/pronunciation-conversations'
import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'
import { studentTranslator } from '@/lib/student-ui-i18n'

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
export default function PronunciationStudio({ prompts, conversations, level, lang, translations, initialTab = 'studio' }: {
  prompts: readonly PronunciationPrompt[]
  conversations: PronunciationConversation[]
  level: string
  lang: string
  translations: PronunciationTranslations
  initialTab?: StudioTab
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
    <div className="pronunciation-practice mx-auto w-full max-w-6xl space-y-6 text-[var(--foreground)]">
      <div role="tablist" aria-label={s('area_pronunciation')} className="st-segment" style={{ '--st-active': tab === 'studio' ? 0 : 1 } as CSSProperties}>
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

      <div role="tabpanel" id={`studio-panel-${tab}`} aria-labelledby={`studio-tab-${tab}`}>
        {tab === 'studio'
          ? <Studio prompts={prompts} statuses={statuses} level={level} lang={lang} translations={translations} onOpenMailbox={() => switchTab('mailbox')} />
          : <Mailbox conversations={conversations} lang={lang} translations={translations} />}
      </div>
    </div>
  )
}

function Studio({ prompts, statuses, level, lang, translations, onOpenMailbox }: {
  prompts: readonly PronunciationPrompt[]
  statuses: Map<string, TextStatus>
  level: string
  lang: string
  translations: PronunciationTranslations
  onOpenMailbox: () => void
}) {
  const t = createPronunciationTranslator(translations)
  const s = studentTranslator(lang)
  const reduced = useReducedMotion() ?? false
  // Start beim ersten Text, der noch nicht aufgenommen ist.
  const [selectedId, setSelectedId] = useState(() => (prompts.find(prompt => !statuses.has(prompt.id)) ?? prompts[0])?.id)
  const [recordingBusy, setRecordingBusy] = useState(false)
  const [phase, setPhase] = useState<RecorderPhase>('idle')
  const [listened, setListened] = useState(false)
  const [following, setFollowing] = useState<number | null>(null)
  const cards = useRef<HTMLUListElement>(null)
  const selected = prompts.find(prompt => prompt.id === selectedId) ?? prompts[0]

  useEffect(() => {
    if (!selected) return
    return prefetchNeuralAudio([{ text: selected.sentenceDe, language: 'de', audioUrl: selected.audioUrl }])
  }, [selected?.sentenceDe, selected?.audioUrl])

  useEffect(() => {
    setListened(false); setFollowing(null); setPhase('idle')
    const card = cards.current?.querySelector<HTMLElement>('[aria-pressed="true"]')
    card?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: reduced ? 'instant' : 'smooth' })
  }, [selectedId, reduced])

  const onReferenceProgress = useCallback((fraction: number | null) => {
    setFollowing(fraction)
    if (fraction !== null && fraction > 0) setListened(true)
  }, [])

  if (!selected) {
    return <section className="st-empty st-empty--hero"><BookOpen className="mx-auto text-[var(--accent-text)]" size={32} aria-hidden="true" /><h2>{t('prompts_empty')}</h2><p>{t('prompts_empty_hint')}</p></section>
  }

  const status = statuses.get(selected.id) ?? 'new'
  const wordCount = selected.sentenceDe.split(/\s+/).length
  const sent = status !== 'new' || phase === 'submitted'
  const answered = status === 'answered' || status === 'unread'
  const active = phase === 'recording' || phase === 'review' ? 1
    : phase === 'submitted' ? 2
      : answered ? 3
        : sent ? 2
          : listened ? 1 : 0
  const steps = [
    { key: 'studio_step_listen', icon: Headphones },
    { key: 'studio_step_record', icon: Mic },
    { key: 'studio_step_answer', icon: MessageCircle },
  ] as const

  return (
    <div className="space-y-6">
      <ol className="st-steps" aria-label={s('studio_steps')}>
        {steps.map((step, index) => {
          const state = index < active ? 'done' : index === active ? 'active' : 'todo'
          return (
            <li key={step.key} className="st-steps__item" data-state={state} aria-current={state === 'active' ? 'step' : undefined}>
              <span className="st-steps__icon" aria-hidden="true">{state === 'done' ? <Check size={20} strokeWidth={3} /> : <step.icon size={20} />}</span>
              <span className="st-steps__label"><span className="st-steps__number" aria-hidden="true">0{index + 1}</span>{s(step.key)}</span>
            </li>
          )
        })}
      </ol>

      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <section aria-labelledby="studio-texts-title" className="min-w-0">
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
                  <button type="button" aria-pressed={isSelected} disabled={recordingBusy && !isSelected} onClick={() => setSelectedId(prompt.id)}
                    className="st-textcard st-press" data-status={textStatus}>
                    <span className="st-textcard__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <span className="st-textcard__title">{prompt.title ?? prompt.sentenceDe}</span>
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
        </section>

        <div className="min-w-0 space-y-5">
          <article className="st-reading">
            <header className="st-reading__head">
              <div className="mb-3 flex flex-wrap gap-2 text-base font-semibold text-[var(--muted)]">
                <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1">{level}</span>
                <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1">{t('words', { count: wordCount })}</span>
                <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1">{t('reading_time', { minutes: Math.max(1, Math.ceil(wordCount / 70)) })}</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{selected.title ?? t('reference_label')}</h2>
              {selected.focus && <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">{t('prompt_focus', { focus: selected.focus })}</p>}
            </header>
            <div className="st-reading__body">
              <div data-testid="pronunciation-reading-text">
                <KaraokeText text={selected.sentenceDe} progress={following} className="st-karaoke whitespace-pre-line" />
              </div>
              <span data-testid="pronunciation-text-end" className="pronunciation-text-end block h-px" aria-hidden="true" />
              <p className="st-reading__follow"><Headphones size={18} aria-hidden="true" />{s('studio_follow')}</p>
              <div className="mt-4">
                {selected.audioUrl
                  ? <WaveformPlayer src={selected.audioUrl} t={t} label={t('reference_listen')}
                      onProgress={state => onReferenceProgress(state.playing || (state.fraction > 0 && !state.ended) ? state.fraction : null)} />
                  : <SolutionAudioButton text={selected.sentenceDe} language="de" label={t('reference_listen')} ariaLabel={t('reference_listen_aria')} onProgress={onReferenceProgress} />}
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
