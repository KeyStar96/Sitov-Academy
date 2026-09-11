'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Mic, Send, Square, Trash2 } from 'lucide-react'
import { sendPronunciationMessage } from '@/app/actions/pronunciation-conversations'
import { uploadPrivatePronunciationRecording } from '@/lib/audio/upload'
import { useAudioRecorder } from '@/lib/audio/useAudioRecorder'
import type { ExerciseTranslator } from '@/lib/exercise-i18n'
import LiveWaveform from '@/components/audio/LiveWaveform'
import WaveformPlayer from '@/components/audio/WaveformPlayer'

interface PronunciationMessageInputProps {
  conversationId: string
  t: ExerciseTranslator
  onMessageSent: () => Promise<void>
}

export default function PronunciationMessageInput({ conversationId, t, onMessageSent }: PronunciationMessageInputProps) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<'success' | 'error' | null>(null)
  const recorder = useAudioRecorder()
  const uploaded = useRef<{ blob: Blob; path: string } | null>(null)

  async function send() {
    if (sending || recorder.isRecording || (!text.trim() && !recorder.audioBlob)) return
    setSending(true)
    setNotice(null)
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
      const result = await sendPronunciationMessage({ submissionId: conversationId, text: text.trim(), audioPath })
      if (!result.success) { setNotice('error'); return }
      setText('')
      recorder.reset()
      uploaded.current = null
      setNotice('success')
      await onMessageSent()
      router.refresh()
    } catch (error) {
      console.error('Sending conversation message failed', error)
      setNotice('error')
    } finally {
      setSending(false)
    }
  }

  const button = 'inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base font-semibold transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-50'
  const micError = recorder.status === 'denied' ? t('mic_denied') : recorder.status === 'unsupported' ? t('mic_unsupported') : recorder.status === 'failed' ? t('record_failed') : null

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <label htmlFor={`message-${conversationId}`} className="block text-base font-semibold">{t('reply_label')}</label>
      <textarea
        id={`message-${conversationId}`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={sending}
        maxLength={5000}
        rows={3}
        placeholder={t('reply_placeholder')}
        className="w-full resize-y rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-base focus:outline-2 focus:outline-[var(--accent)] disabled:opacity-50"
      />
      {recorder.isRecording && (
        <LiveWaveform levels={recorder.levels} isActive elapsedSeconds={recorder.elapsedSeconds} analyserRef={recorder.analyserRef} ariaLabel={t('waveform_live_aria')} />
      )}
      {recorder.hasRecording && (
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <WaveformPlayer src={recorder.audioUrl} blob={recorder.audioBlob} t={t} label={t('your_recording')} compact />
          </div>
          <button type="button" className={button} disabled={sending} onClick={recorder.reset} aria-label={t('delete_recording_aria')}>
            <Trash2 size={20} />
          </button>
        </div>
      )}
      {micError && <p role="status" className="text-base text-[var(--danger)]">{micError}</p>}
      {notice && (
        <p role="status" className={`text-base ${notice === 'error' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
          {t(notice === 'error' ? 'message_failed' : 'message_sent')}
        </p>
      )}
      <div className="flex flex-wrap justify-between gap-3">
        {recorder.isRecording ? (
          <button type="button" className={button} onClick={recorder.stop}>
            <Square size={20} />
            {t('stop_recording')}
          </button>
        ) : !recorder.hasRecording && (
          <button type="button" className={button} disabled={sending || recorder.status === 'requesting'} onClick={() => void recorder.start()}>
            {recorder.status === 'requesting' ? <Loader2 size={20} className="animate-spin" /> : <Mic size={20} />} {t('voice_message')}
          </button>
        )}
        <button
          type="button"
          disabled={sending || recorder.isRecording || (!text.trim() && !recorder.audioBlob)}
          onClick={() => void send()}
          className="ml-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-base font-semibold text-[var(--accent-foreground)] disabled:opacity-50"
        >
          {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={18} />} {t(sending ? 'sending_message' : 'send_message')}
        </button>
      </div>
    </div>
  )
}
