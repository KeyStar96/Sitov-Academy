'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronLeft, Loader2, MessageCircle, RefreshCw, X } from 'lucide-react'
import { createPronunciationTranslator, type PronunciationTranslations } from '@/lib/pronunciation-i18n'
import type { PronunciationConversation as Conversation } from '@/lib/pronunciation-conversations'
import { getPronunciationConversations, markPronunciationSeen } from '@/app/actions/pronunciation-conversations'
import WaveformPlayer from '@/components/audio/WaveformPlayer'
import PronunciationMessageInput from '@/components/audio/PronunciationMessageInput'

export default function PronunciationConversation({
  conversation: initial,
  staff = false,
  lang,
  translations
}: {
  conversation: Conversation;
  staff?: boolean;
  lang: string;
  translations: PronunciationTranslations
}) {
  const t = createPronunciationTranslator(translations)
  const router = useRouter()
  const [conversation, setConversation] = useState(initial)
  const [open, setOpen] = useState(initial.hasUnseen)
  const [refreshing, setRefreshing] = useState(false)
  const [showText, setShowText] = useState(false)
  const scrollArea = useRef<HTMLDivElement>(null)

  useEffect(() => setConversation(initial), [initial])

  const refresh = useCallback(async () => {
    try {
      const updated = await getPronunciationConversations(undefined, initial.id)
      if (updated[0]) setConversation(updated[0])
    } catch (error) {
      console.error('Conversation refresh failed', error)
    }
  }, [initial.id])

  const unreadKey = conversation.messages.filter((message) => message.unseen).map((message) => message.id).join(',')
  useEffect(() => {
    if (!open) return
    void markPronunciationSeen(initial.id).catch((error: unknown) => console.error('Reading messages failed', error))
  }, [open, initial.id, unreadKey])

  useEffect(() => {
    if (open && scrollArea.current) {
      scrollArea.current.scrollTop = scrollArea.current.scrollHeight
    }
  }, [open, conversation.messages.length])

  const buttonClass = 'inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base font-semibold transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-50'

  const latestStudentAudioMessage = staff
    ? [...conversation.messages].reverse().find((m) => m.senderRole === 'student' && m.audioUrl)
    : null

  return (
    <article className={`min-w-0 overflow-hidden rounded-3xl border bg-[var(--surface)] ${conversation.hasUnseen ? 'border-[var(--accent)]' : 'border-[var(--border)]'}`}>
      {/* Trigger Button (Accordion Header) */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`conversation-${conversation.id}`}
        className="flex min-h-20 w-full items-center gap-4 p-5 text-left sm:p-6"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--accent)]">
          <MessageCircle size={23} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold">
            {staff ? conversation.studentName ?? t('student_label') : conversation.title ?? t('conversation_title')}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-[var(--muted)]">
            <span>{conversation.level}</span>
            <span>{conversation.createdAt ? new Date(conversation.createdAt).toLocaleDateString(lang) : ''}</span>
            <span className={conversation.status === 'pending' ? 'text-[var(--accent)]' : ''}>
              {t(conversation.status === 'pending' ? 'status_pending' : 'status_reviewed')}
            </span>
            {conversation.hasUnseen && <span className="font-semibold text-[var(--accent)]">{t('new_badge')}</span>}
          </span>
        </span>
        <ChevronDown className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} size={28} />
      </button>

      {/* Expanded Content */}
      {open && (
        <div
          id={`conversation-${conversation.id}`}
          className="fixed inset-0 z-50 flex flex-col bg-[var(--surface)] md:static md:block md:z-auto md:border-t md:border-[var(--border)]"
        >
          {/* Mobile Modal Header (Fixed at top) */}
          <div className="flex-none border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 md:hidden">
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 font-semibold text-[var(--accent)]"
              >
                <ChevronLeft size={24} />
                <span>{staff ? t('teacher_queue_title') : t('history_title')}</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center h-10 w-10 rounded-full bg-[var(--surface-muted)] text-[var(--muted)]"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4 px-1">
              <h3 className="truncate font-bold text-lg text-[var(--foreground)]">
                {staff ? conversation.studentName ?? t('student_label') : conversation.title ?? t('conversation_title')}
              </h3>
            </div>

            {/* Sticky Audio Player for Staff on Mobile */}
            {latestStudentAudioMessage && latestStudentAudioMessage.audioUrl && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-2 shadow-sm">
                <WaveformPlayer src={latestStudentAudioMessage.audioUrl} t={t} compact />
              </div>
            )}
          </div>

          {/* Desktop Header */}
          <div className="hidden flex-wrap items-center justify-between gap-3 px-5 py-4 md:flex">
            <div className="min-w-0">
              <p className="text-base text-[var(--muted)]">
                {staff ? conversation.title ?? t('conversation_title') : t('conversation_hint')}
              </p>
              {staff && conversation.studentEmail && (
                <p className="mt-1 break-all text-base text-[var(--muted)]">{conversation.studentEmail}</p>
              )}
            </div>
            <button
              type="button"
              className={buttonClass}
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true)
                try {
                  await refresh()
                } finally {
                  setRefreshing(false)
                }
              }}
              aria-label={t('refresh_messages')}
            >
              {refreshing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto overscroll-contain bg-[var(--surface-muted)] md:max-h-[36rem]">
            {conversation.readingText && (
              <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
                <button
                  type="button"
                  onClick={() => setShowText(!showText)}
                  aria-expanded={showText}
                  className={`${buttonClass} w-full justify-between`}
                >
                  {t('show_text')}
                  <ChevronDown size={18} />
                </button>
                {showText && (
                  <p lang="de" className="mt-3 rounded-2xl bg-[var(--surface-muted)] p-4 text-base leading-relaxed">
                    {conversation.readingText}
                  </p>
                )}
              </div>
            )}

            <div ref={scrollArea} aria-label={t('conversation_title')} data-lenis-prevent className="space-y-4 px-3 py-5 sm:px-6">
              {conversation.messages.map((message) => {
                const teacher = message.senderRole !== 'student'
                const own = staff ? teacher : !teacher
                
                // Hide the student's latest audio from the chat list on mobile since it's in the header,
                // but keep it on desktop.
                const isLatestAudio = latestStudentAudioMessage?.id === message.id;

                return (
                  <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`min-w-0 max-w-[95%] rounded-2xl border p-4 sm:max-w-[85%] ${
                        own
                          ? 'rounded-br-sm border-[color-mix(in_srgb,var(--accent)_20%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_9%,var(--surface))]'
                          : 'rounded-bl-sm border-[var(--border)] bg-[var(--surface)]'
                      }`}
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-4 text-base text-[var(--muted)]">
                        <span className="font-semibold text-[var(--foreground)]">
                          {t(teacher ? 'teacher_label' : 'student_label')}
                        </span>
                        <time dateTime={message.createdAt}>
                          {message.createdAt
                            ? new Date(message.createdAt).toLocaleString(lang, {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </time>
                      </div>
                      {message.text && (
                        <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{message.text}</p>
                      )}
                      
                      {message.audioUrl && (
                        <div className={`mt-3 min-w-0 sm:min-w-[260px] ${isLatestAudio ? 'hidden md:block' : 'block'}`}>
                          <WaveformPlayer src={message.audioUrl} t={t} label={t('voice_message')} compact />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sticky Input Field */}
          <div className="flex-none border-t border-[var(--border)] bg-[var(--surface)] md:border-none">
            <PronunciationMessageInput conversationId={conversation.id} t={t} onMessageSent={refresh} />
          </div>
        </div>
      )}
    </article>
  )
}
