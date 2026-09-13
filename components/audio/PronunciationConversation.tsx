'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Loader2, MessageCircle, RefreshCw } from 'lucide-react'
import { createPronunciationTranslator, type PronunciationTranslations } from '@/lib/pronunciation-i18n'
import type { PronunciationConversation as Conversation } from '@/lib/pronunciation-conversations'
import { getPronunciationConversations, markPronunciationSeen } from '@/app/actions/pronunciation-conversations'
import WaveformPlayer from '@/components/audio/WaveformPlayer'
import PronunciationMessageInput from '@/components/audio/PronunciationMessageInput'
import PersistentDialog from '@/components/ui/PersistentDialog'

function stablePlaybackUrl(previous: string | null, incoming: string | null): string | null {
  if (!previous || !incoming || previous === incoming) return incoming ?? previous
  try {
    const before = new URL(previous), next = new URL(incoming)
    if (before.origin !== next.origin || before.pathname !== next.pathname) return incoming
    const payload = before.searchParams.get('token')?.split('.')[1]
    if (!payload) return incoming
    const encoded = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded: { exp?: unknown } = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')))
    // This is only a cache-lifetime hint; Storage still authorizes every request.
    // Keeping the same source prevents background refreshes from stopping playback.
    if (typeof decoded.exp === 'number' && decoded.exp * 1000 > Date.now() + 60000) return previous
  } catch { /* A fresh signed URL is the recovery path for an invalid/expired source. */ }
  return incoming
}

/** Messages are append-only. A slower parent refresh must not erase a newer local read. */
function mergeConversation(previous: Conversation, incoming: Conversation, source: 'parent' | 'refresh'): Conversation {
  if (previous.id !== incoming.id) return incoming
  const messages = new Map(previous.messages.map(message => [message.id, message]))
  for (const message of incoming.messages) {
    const existing = messages.get(message.id)
    messages.set(message.id, existing ? {
      ...message,
      // Once this dialog has acknowledged a message, an older snapshot cannot unread it.
      unseen: existing.unseen && message.unseen,
      // Explicit reads are serialized; parent snapshots can contain older signed URLs.
      audioUrl: source === 'refresh' ? stablePlaybackUrl(existing.audioUrl, message.audioUrl) : existing.audioUrl ?? message.audioUrl,
    } : message)
  }
  const ordered = [...messages.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  const previousLatest = previous.messages.at(-1)?.createdAt ?? ''
  const incomingLatest = incoming.messages.at(-1)?.createdAt ?? ''
  return { ...incoming, messages: ordered, hasUnseen: ordered.some(message => message.unseen),
    status: previousLatest > incomingLatest ? previous.status : incoming.status }
}

export default function PronunciationConversation({ conversation: initial, staff = false, lang, translations }: {
  conversation: Conversation
  staff?: boolean
  lang: string
  translations: PronunciationTranslations
}) {
  const t = createPronunciationTranslator(translations)
  const [conversation, setConversation] = useState(initial)
  const [open, setOpen] = useState(false)
  const [visited, setVisited] = useState(false)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [showText, setShowText] = useState(false)
  const scrollArea = useRef<HTMLDivElement>(null)
  const followLatest = useRef(true)
  const visible = useRef(open)
  const mounted = useRef(false)
  const generation = useRef(0)
  const pendingRefresh = useRef<Promise<void> | null>(null)
  const queuedRefresh = useRef(false)
  visible.current = open
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; generation.current += 1; queuedRefresh.current = false }
  }, [])
  useEffect(() => setConversation(previous => mergeConversation(previous, initial, 'parent')), [initial])

  const refresh = useCallback((ensureLatest = true): Promise<void> => {
    if (!mounted.current) return Promise.resolve()
    if (pendingRefresh.current) {
      // Sending a message or pressing refresh during a poll gets one trailing read.
      if (ensureLatest) queuedRefresh.current = true
      return pendingRefresh.current
    }
    const currentGeneration = generation.current
    const active = () => mounted.current && generation.current === currentGeneration
    setRefreshing(true)
    setRefreshFailed(false)
    const request = (async () => {
      do {
        queuedRefresh.current = false
        try {
          const updated = await getPronunciationConversations(undefined, initial.id)
          if (!active()) return
          if (!updated[0]) throw new Error('conversation_refresh_failed')
          setConversation(previous => mergeConversation(previous, updated[0], 'refresh'))
          setRefreshFailed(false)
        } catch (error) {
          if (!active()) return
          console.error('Conversation refresh failed', error)
          setRefreshFailed(true)
        }
      } while (active() && queuedRefresh.current)
    })()
    pendingRefresh.current = request
    void request.finally(() => {
      if (pendingRefresh.current === request) pendingRefresh.current = null
      if (active()) setRefreshing(false)
    })
    return request
  }, [initial.id])

  useEffect(() => {
    if (!open) return
    const refreshVisible = () => { if (document.visibilityState === 'visible') void refresh(false) }
    refreshVisible()
    const timer = window.setInterval(refreshVisible, 12000)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refreshVisible) }
  }, [open, refresh])

  const unreadKey = conversation.messages.filter(message => message.unseen).map(message => message.id).join(',')
  useEffect(() => {
    if (!open || !unreadKey) return
    const markRead = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const result = await markPronunciationSeen(initial.id)
        if (!result.success || !mounted.current || !visible.current) return
        const seen = new Set(unreadKey.split(','))
        setConversation(previous => {
          const messages = previous.messages.map(message => seen.has(message.id) ? { ...message, unseen: false } : message)
          return { ...previous, messages, hasUnseen: messages.some(message => message.unseen) }
        })
      } catch (error) { console.error('Reading messages failed', error) }
    }
    void markRead()
    document.addEventListener('visibilitychange', markRead)
    return () => document.removeEventListener('visibilitychange', markRead)
  }, [open, initial.id, unreadKey])

  const scrollToLatest = useCallback(() => {
    if (!scrollArea.current) return
    if (followLatest.current) scrollArea.current.scrollTop = scrollArea.current.scrollHeight
  }, [])
  useEffect(() => { if (open) scrollToLatest() }, [open, conversation.messages.length, scrollToLatest])

  const buttonClass = 'inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base font-semibold transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-50'
  const title = staff ? conversation.studentName ?? t('student_label') : conversation.title ?? t('conversation_title')

  return <article className={`min-w-0 overflow-hidden rounded-3xl border bg-[var(--surface)] ${conversation.hasUnseen ? 'border-[var(--accent)]' : 'border-[var(--border)]'}`}>
    <button type="button" onClick={() => { followLatest.current = true; setVisited(true); setOpen(true) }} aria-haspopup="dialog"
      className="flex min-h-20 w-full items-center gap-4 p-5 text-left sm:p-6">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--accent)]"><MessageCircle size={23} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-lg font-semibold">{title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-[var(--muted)]">
          <span>{conversation.level}</span><span>{conversation.createdAt ? new Date(conversation.createdAt).toLocaleDateString(lang) : ''}</span>
          <span className={conversation.status === 'pending' ? 'text-[var(--accent)]' : ''}>{t(conversation.status === 'pending' ? 'status_pending' : 'status_reviewed')}</span>
          {conversation.hasUnseen && <span className="font-semibold text-[var(--accent)]">{t('new_badge')}</span>}
        </span>
      </span>
    </button>
    {visited && <PersistentDialog open={open} title={title} closeLabel={t('close_conversation')} dismissible={!busy} onOpen={scrollToLatest} onClose={() => setOpen(false)}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2 sm:px-6">
        <div className="min-w-0"><p className="text-base text-[var(--muted)]">{staff ? conversation.title ?? t('conversation_title') : t('conversation_hint')}</p>
          {staff && conversation.studentEmail && <p className="mt-1 break-all text-base text-[var(--muted)]">{conversation.studentEmail}</p>}
        </div>
        <button type="button" className={buttonClass} disabled={refreshing} onClick={() => void refresh()} aria-label={t('refresh_messages')}>
          {refreshing ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={20} aria-hidden="true" />}
        </button>
      </div>
      {refreshFailed && <p role="status" className="shrink-0 px-4 py-2 text-base text-[var(--danger)]">{t('refresh_failed')}</p>}
      <div ref={scrollArea} role="log" aria-label={t('conversation_title')} aria-live={open ? 'polite' : 'off'} data-lenis-prevent
        onScroll={event => { const area = event.currentTarget; followLatest.current = area.scrollHeight - area.clientHeight - area.scrollTop < 80 }}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-[var(--surface-muted)] px-3 py-4 sm:px-6">
        {conversation.readingText && <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <button type="button" onClick={() => setShowText(!showText)} aria-expanded={showText} className={`${buttonClass} w-full justify-between`}>
            {t('show_text')}<ChevronDown size={18} aria-hidden="true" />
          </button>
          {showText && <p lang="de" className="mt-3 whitespace-pre-line text-base leading-relaxed">{conversation.readingText}</p>}
        </div>}
        {open && conversation.messages.map(message => {
          const teacher = message.senderRole !== 'student'
          const own = staff ? teacher : !teacher
          return <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
            <div className={`min-w-0 max-w-[95%] rounded-2xl border p-4 sm:max-w-[85%] ${own ? 'rounded-br-sm border-[color-mix(in_srgb,var(--accent)_20%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_9%,var(--surface))]' : 'rounded-bl-sm border-[var(--border)] bg-[var(--surface)]'}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-base text-[var(--muted)]">
                <span className="font-semibold text-[var(--foreground)]">{t(teacher ? 'teacher_label' : 'student_label')}</span>
                <time dateTime={message.createdAt}>{message.createdAt ? new Date(message.createdAt).toLocaleString(lang, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</time>
              </div>
              {message.text && <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{message.text}</p>}
              {message.audioUrl && <div className="mt-3 min-w-0 sm:min-w-[260px]"><WaveformPlayer src={message.audioUrl} t={t} label={t('voice_message')} compact /></div>}
            </div>
          </div>
        })}
      </div>
      <div className="max-h-[45dvh] shrink-0 overflow-y-auto overscroll-contain border-t border-[var(--border)] bg-[var(--surface)]">
        <PronunciationMessageInput conversationId={conversation.id} t={t} onBusyChange={setBusy} onMessageSent={async () => { followLatest.current = true; await refresh() }} />
      </div>
    </PersistentDialog>}
  </article>
}
