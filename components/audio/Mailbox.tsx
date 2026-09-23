'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Archive, Check, ChevronDown, ChevronRight, Inbox, MessagesSquare, Send } from 'lucide-react'
import PronunciationConversation from '@/components/audio/PronunciationConversation'
import TeacherAvatar from '@/components/audio/TeacherAvatar'
import WaveformPlayer from '@/components/audio/WaveformPlayer'
import { markPronunciationSeen } from '@/app/actions/pronunciation-conversations'
import { createPronunciationTranslator, type PronunciationTranslations } from '@/lib/pronunciation-i18n'
import type { PronunciationConversation as Conversation, PronunciationMessage } from '@/lib/pronunciation-conversations'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { teacherFirstName } from '@/lib/teacher-portraits'

const EASE = [0.22, 1, 0.36, 1] as const

function latestTeacherMessage(conversation: Conversation): PronunciationMessage | null {
  const replies = conversation.messages.filter(message => message.senderRole !== 'student')
  return replies.filter(message => message.unseen).at(-1) ?? replies.at(-1) ?? null
}

/**
 * Der Briefkasten: Neue Post liegt oben als Brief mit Foto der Lehrkraft und
 * lässt sich direkt abspielen. Gehörte Briefe wandern sichtbar ins Archiv;
 * Aufnahmen ohne Antwort stehen als „unterwegs" dazwischen.
 */
export default function Mailbox({ conversations, lang, translations }: {
  conversations: Conversation[]
  lang: string
  translations: PronunciationTranslations
}) {
  const s = studentTranslator(lang)
  const reduced = useReducedMotion() ?? false
  const [filed, setFiled] = useState<Set<string>>(() => new Set())
  const [archiveOpen, setArchiveOpen] = useState(false)
  const fresh = conversations.filter(conversation => conversation.hasUnseen && !filed.has(conversation.id))
  const waiting = conversations.filter(conversation => !conversation.hasUnseen && conversation.messages.every(message => message.senderRole === 'student'))
  const archive = conversations.filter(conversation => !fresh.includes(conversation) && !waiting.includes(conversation))

  if (conversations.length === 0) {
    return <section className="st-empty st-empty--hero"><Inbox className="mx-auto text-[var(--accent-text)]" size={34} aria-hidden="true" />
      <h2>{s('mailbox_title')}</h2><p>{s('mailbox_empty')}</p></section>
  }

  return (
    <section aria-labelledby="mailbox-title" className="space-y-7">
      <header className="st-mailbox-head">
        <span className="st-envelope st-envelope--large" data-open={fresh.length === 0} aria-hidden="true">
          <span className="st-envelope__flap" /><span className="st-envelope__body" />
          {fresh.length > 0 && <span className="st-envelope__count">{fresh.length}</span>}
        </span>
        <div className="min-w-0">
          <h2 id="mailbox-title" className="st-section-title">{s('mailbox_title')}</h2>
          <p className="st-section-sub">{fresh.length ? s.count('mailbox_new', fresh.length) : s('mailbox_none_new')}</p>
        </div>
      </header>

      <AnimatePresence initial={false}>
        {fresh.map(conversation => (
          <motion.div key={conversation.id}
            initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.94, transition: { duration: 0.45, ease: EASE } }}>
            <Letter conversation={conversation} lang={lang} translations={translations}
              onFiled={() => setFiled(previous => new Set(previous).add(conversation.id))} />
          </motion.div>
        ))}
      </AnimatePresence>

      {waiting.length > 0 && (
        <section aria-labelledby="mailbox-waiting" className="space-y-3">
          <h3 id="mailbox-waiting" className="st-mailbox-sub"><Send size={18} aria-hidden="true" />{s('mailbox_waiting')}</h3>
          <ul className="grid gap-3">
            {waiting.map(conversation => (
              <li key={conversation.id}>
                <PronunciationConversation conversation={conversation} lang={lang} translations={translations}
                  trigger={(open, current) => (
                    <button type="button" onClick={open} aria-haspopup="dialog" className="st-mail-row st-press" data-kind="waiting">
                      <span className="st-mail-row__icon" aria-hidden="true"><Send size={20} className="st-fly" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="st-mail-row__title">{current.title ?? s('studio_texts')}</span>
                        <span className="st-mail-row__meta">{s('mailbox_waiting_hint')} · {current.createdAt ? new Date(current.createdAt).toLocaleDateString(lang) : ''}</span>
                      </span>
                      <ChevronRight size={20} aria-hidden="true" className="shrink-0 text-[var(--muted)]" />
                    </button>
                  )} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(archive.length > 0) && (
        <section aria-labelledby="mailbox-archive" className="space-y-3">
          <button type="button" id="mailbox-archive" aria-expanded={archiveOpen} onClick={() => setArchiveOpen(value => !value)} className="st-mailbox-sub st-mailbox-sub--toggle st-press">
            <Archive size={18} aria-hidden="true" />{s('mailbox_archive')}
            <span className="st-mailbox-sub__count">{s('mailbox_archive_count', { count: archive.length })}</span>
            <ChevronDown size={18} aria-hidden="true" className="ml-auto transition-transform" style={{ transform: archiveOpen ? 'rotate(180deg)' : undefined }} />
          </button>
          <AnimatePresence initial={false}>
            {archiveOpen && (
              <motion.ul className="grid gap-3 overflow-hidden" initial={reduced ? false : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }} exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
                {archive.map(conversation => (
                  <li key={conversation.id}><PronunciationConversation conversation={conversation} lang={lang} translations={translations} /></li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </section>
      )}
    </section>
  )
}

/** Ein Brief: Foto und Name, die Sprachnachricht direkt abspielbar, darunter der Text. */
function Letter({ conversation, lang, translations, onFiled }: {
  conversation: Conversation
  lang: string
  translations: PronunciationTranslations
  onFiled: () => void
}) {
  const s = studentTranslator(lang)
  const p = createPronunciationTranslator(translations)
  const [heard, setHeard] = useState(false)
  const marked = useRef(false)
  const filed = useRef(false)
  const message = latestTeacherMessage(conversation)
  const name = teacherFirstName(message?.senderName) ?? s('teacher_fallback_subject')

  function acknowledge() {
    if (marked.current) return
    marked.current = true
    setHeard(true)
    void markPronunciationSeen(conversation.id).catch(() => { marked.current = false })
  }
  function file() {
    if (filed.current) return
    filed.current = true
    // Kurz stehen lassen, damit man den Haken sieht — dann ab ins Archiv.
    window.setTimeout(onFiled, 1200)
  }

  return (
    <article className="st-letter">
      <div className="st-letter__head">
        <TeacherAvatar name={message?.senderName ?? null} size={56} />
        <div className="min-w-0 flex-1">
          <h3 className="st-letter__from">{s('mailbox_from', { name })}</h3>
          <p className="st-letter__meta">{[conversation.title, message?.createdAt ? new Date(message.createdAt).toLocaleDateString(lang) : null].filter(Boolean).join(' · ')}</p>
        </div>
        {heard && <span className="st-heard st-pop"><Check size={16} strokeWidth={3} aria-hidden="true" />{s('mailbox_heard')}</span>}
      </div>
      {message?.audioUrl && (
        <div className="mt-4">
          <WaveformPlayer src={message.audioUrl} t={p} compact label={p('voice_message')}
            onProgress={state => { if (state.playing) acknowledge(); if (state.ended) file() }} />
        </div>
      )}
      {message?.text && <p className="st-mail-card__text">{message.text}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        {!message?.audioUrl && !heard && (
          <button type="button" onClick={() => { acknowledge(); file() }} className="st-button st-button--soft st-press"><Check size={18} aria-hidden="true" />{s('mailbox_heard')}</button>
        )}
        <PronunciationConversation conversation={conversation} lang={lang} translations={translations}
          trigger={open => (
            <button type="button" onClick={() => { acknowledge(); open() }} aria-haspopup="dialog" className="st-link-pill st-press">
              <MessagesSquare size={18} aria-hidden="true" />{s('mailbox_open')}
            </button>
          )} />
      </div>
    </article>
  )
}
