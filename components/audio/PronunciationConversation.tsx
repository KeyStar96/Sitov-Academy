'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2, MessageCircle, Mic, RefreshCw, Send, Square, Trash2 } from 'lucide-react'
import { getPronunciationConversations, markPronunciationSeen, sendPronunciationMessage } from '@/app/actions/pronunciation-conversations'
import { uploadPrivatePronunciationRecording } from '@/lib/audio/upload'
import { useAudioRecorder } from '@/lib/audio/useAudioRecorder'
import { createPronunciationTranslator, type PronunciationTranslations } from '@/lib/pronunciation-i18n'
import type { PronunciationConversation as Conversation } from '@/lib/pronunciation-conversations'
import LiveWaveform from '@/components/audio/LiveWaveform'
import WaveformPlayer from '@/components/audio/WaveformPlayer'

export default function PronunciationConversation({ conversation: initial, staff = false, lang, translations }: { conversation: Conversation; staff?: boolean; lang: string; translations: PronunciationTranslations }) {
  const t = createPronunciationTranslator(translations)
  const router = useRouter()
  const [conversation, setConversation] = useState(initial)
  const [open, setOpen] = useState(initial.hasUnseen)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [notice, setNotice] = useState<'success' | 'error' | null>(null)
  const [showText, setShowText] = useState(false)
  const recorder = useAudioRecorder()
  const uploaded = useRef<{ blob: Blob; path: string } | null>(null)
  const scrollArea = useRef<HTMLDivElement>(null)
  useEffect(() => setConversation(initial), [initial])
  const refresh = useCallback(async () => {
    try {
      const updated = await getPronunciationConversations(undefined, initial.id)
      if (updated[0]) setConversation(updated[0])
    } catch (error) { console.error('Conversation refresh failed', error) }
  }, [initial.id])
  const unreadKey = conversation.messages.filter((message) => message.unseen).map((message) => message.id).join(',')
  useEffect(() => {
    if (!open) return
    void markPronunciationSeen(initial.id).catch((error: unknown) => console.error('Reading messages failed', error))
  }, [open, initial.id, unreadKey])
  useEffect(() => { if (open && scrollArea.current) scrollArea.current.scrollTop = scrollArea.current.scrollHeight }, [open, conversation.messages.length])
  async function send() {
    if (sending || recorder.isRecording || (!text.trim() && !recorder.audioBlob)) return
    setSending(true); setNotice(null)
    try {
      let audioPath: string | null = null
      if (recorder.audioBlob) {
        if (uploaded.current?.blob === recorder.audioBlob) audioPath = uploaded.current.path
        else {
          const result = await uploadPrivatePronunciationRecording(recorder.audioBlob)
          if (!result.success) { setNotice('error'); return }
          audioPath = result.publicUrl
          uploaded.current = { blob: recorder.audioBlob, path: audioPath }
        }
      }
      const result = await sendPronunciationMessage({ submissionId: conversation.id, text: text.trim(), audioPath })
      if (!result.success) { setNotice('error'); return }
      setText(''); recorder.reset(); uploaded.current = null; setNotice('success')
      await refresh(); router.refresh()
    } catch (error) { console.error('Sending conversation message failed', error); setNotice('error') }
    finally { setSending(false) }
  }
  const button = 'inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-50'
  const micError = recorder.status === 'denied' ? t('mic_denied') : recorder.status === 'unsupported' ? t('mic_unsupported') : recorder.status === 'failed' ? t('record_failed') : null
  return <article className={`min-w-0 overflow-hidden rounded-3xl border bg-[var(--surface)] ${conversation.hasUnseen ? 'border-[var(--accent)]' : 'border-[var(--border)]'}`}>
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={`conversation-${conversation.id}`} className="flex min-h-20 w-full items-center gap-4 p-5 text-left sm:p-6"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--accent)]"><MessageCircle size={23}/></span><span className="min-w-0 flex-1"><span className="block truncate text-lg font-semibold">{staff ? conversation.studentName ?? t('student_label') : conversation.title ?? t('conversation_title')}</span><span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]"><span>{conversation.level}</span><span>{conversation.createdAt ? new Date(conversation.createdAt).toLocaleDateString(lang) : ''}</span><span className={conversation.status === 'pending' ? 'text-[var(--accent)]' : ''}>{t(conversation.status === 'pending' ? 'status_pending' : 'status_reviewed')}</span>{conversation.hasUnseen && <span className="font-semibold text-[var(--accent)]">{t('new_badge')}</span>}</span></span><ChevronDown className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} size={20}/></button>
    {open && <div id={`conversation-${conversation.id}`} className="border-t border-[var(--border)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div className="min-w-0"><p className="text-sm text-[var(--muted)]">{staff ? conversation.title ?? t('conversation_title') : t('conversation_hint')}</p>{staff && conversation.studentEmail && <p className="mt-1 break-all text-xs text-[var(--muted)]">{conversation.studentEmail}</p>}</div><button type="button" className={button} disabled={refreshing} onClick={async () => { setRefreshing(true); try { await refresh() } finally { setRefreshing(false) } }} aria-label={t('refresh_messages')}>{refreshing ? <Loader2 size={18} className="animate-spin"/> : <RefreshCw size={18}/>}</button></div>
      {conversation.readingText && <div className="px-5 pb-4"><button type="button" onClick={() => setShowText(!showText)} aria-expanded={showText} className={`${button} w-full justify-between`}>{t('show_text')}<ChevronDown size={18}/></button>{showText && <p lang="de" className="mt-3 rounded-2xl bg-[var(--surface-muted)] p-4 text-base leading-relaxed">{conversation.readingText}</p>}</div>}
      <div ref={scrollArea} aria-label={t('conversation_title')} data-lenis-prevent className="max-h-[36rem] space-y-4 overflow-y-auto overscroll-contain bg-[var(--surface-muted)] px-3 py-5 sm:px-6">
        {conversation.messages.map((message) => {
          const teacher = message.senderRole !== 'student'
          const own = staff ? teacher : !teacher
          return <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}><div className={`min-w-0 max-w-[95%] rounded-2xl border p-4 sm:max-w-[85%] ${own ? 'rounded-br-sm border-[color-mix(in_srgb,var(--accent)_20%,var(--border))] bg-[color-mix(in_srgb,var(--accent)_9%,var(--surface))]' : 'rounded-bl-sm border-[var(--border)] bg-[var(--surface)]'}`}><div className="mb-2 flex flex-wrap items-center justify-between gap-4 text-xs text-[var(--muted)]"><span className="font-semibold text-[var(--foreground)]">{t(teacher ? 'teacher_label' : 'student_label')}</span><time dateTime={message.createdAt}>{message.createdAt ? new Date(message.createdAt).toLocaleString(lang, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : ''}</time></div>{message.text && <p className="whitespace-pre-wrap break-words text-base leading-relaxed">{message.text}</p>}{message.audioUrl && <div className="mt-3 min-w-0 sm:min-w-[260px]"><WaveformPlayer src={message.audioUrl} t={t} label={t('voice_message')} compact /></div>}</div></div>
        })}
      </div>
      <div className="space-y-4 p-4 sm:p-6"><label htmlFor={`message-${conversation.id}`} className="block text-sm font-semibold">{t('reply_label')}</label><textarea id={`message-${conversation.id}`} value={text} onChange={(event) => setText(event.target.value)} disabled={sending} maxLength={5000} rows={3} placeholder={t('reply_placeholder')} className="w-full resize-y rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-base focus:outline-2 focus:outline-[var(--accent)] disabled:opacity-50" />
        {recorder.isRecording && <LiveWaveform levels={recorder.levels} isActive elapsedSeconds={recorder.elapsedSeconds} analyserRef={recorder.analyserRef} ariaLabel={t('waveform_live_aria')}/>}
        {recorder.hasRecording && <div className="flex min-w-0 items-center gap-2"><div className="min-w-0 flex-1"><WaveformPlayer src={recorder.audioUrl} blob={recorder.audioBlob} t={t} label={t('your_recording')} compact /></div><button type="button" className={button} disabled={sending} onClick={recorder.reset} aria-label={t('delete_recording_aria')}><Trash2 size={20}/></button></div>}
        {micError && <p role="status" className="text-sm text-[var(--danger)]">{micError}</p>}
        {notice && <p role="status" className={`text-sm ${notice === 'error' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>{t(notice === 'error' ? 'message_failed' : 'message_sent')}</p>}
        <div className="flex flex-wrap justify-between gap-3">{recorder.isRecording ? <button type="button" className={button} onClick={recorder.stop}><Square size={20}/>{t('stop_recording')}</button> : !recorder.hasRecording && <button type="button" className={button} disabled={sending || recorder.status === 'requesting'} onClick={() => void recorder.start()}>{recorder.status === 'requesting' ? <Loader2 size={20} className="animate-spin"/> : <Mic size={20}/>} {t('voice_message')}</button>}<button type="button" disabled={sending || recorder.isRecording || (!text.trim() && !recorder.audioBlob)} onClick={() => void send()} className="ml-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-foreground)] disabled:opacity-50">{sending ? <Loader2 size={20} className="animate-spin"/> : <Send size={18}/>} {t(sending ? 'sending_message' : 'send_message')}</button></div>
      </div>
    </div>}
  </article>
}
