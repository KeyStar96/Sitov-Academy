'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPronunciationSubmission } from '@/app/actions/pronunciation-conversations'
import { CheckCircle2, Loader2, Mic, Square, Trash2, TriangleAlert, UploadCloud } from 'lucide-react'
import { uploadPrivatePronunciationRecording } from '@/lib/audio/upload'
import { useAudioRecorder } from '@/lib/audio/useAudioRecorder'
import {
  createPronunciationTranslator,
  type PronunciationTranslations,
} from '@/lib/pronunciation-i18n'
import LiveWaveform from '@/components/audio/LiveWaveform'
import WaveformPlayer from '@/components/audio/WaveformPlayer'

/**
 * Aufnahme-Karte für Schüler: aufnehmen, anhören, einreichen.
 *
 * Die Aufnahme-Mechanik liegt in `useAudioRecorder`, der Upload in
 * `lib/audio/upload.ts`. Diese Komponente ist reine UI und Ablaufsteuerung.
 */
export default function AudioRecorder({
  promptId,
  onRecordingStateChange,
  level,
  translations,
  onSubmitted,
  compact = false,
  mobileSticky = false,
}: {
  promptId: string
  onRecordingStateChange?: (busy: boolean) => void
  level?: string
  translations?: PronunciationTranslations
  onSubmitted?: () => void
  compact?: boolean
  mobileSticky?: boolean
}) {
  const t = createPronunciationTranslator(translations ?? {})
  const recorder = useAudioRecorder()
  const router = useRouter()

  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [uploadFailed, setUploadFailed] = useState(false)
  useEffect(() => { onRecordingStateChange?.(recorder.status === 'requesting' || recorder.isRecording || isUploading || (recorder.hasRecording && !isSubmitted)) }, [recorder.status, recorder.isRecording, recorder.hasRecording, isUploading, isSubmitted, onRecordingStateChange])

  const statusMessage = (() => {
    if (recorder.status === 'denied') return t('mic_denied')
    if (recorder.status === 'unsupported') return t('mic_unsupported')
    if (recorder.status === 'failed') return t('record_failed')
    if (uploadFailed) return t('upload_failed')
    return null
  })()

  const handleStart = async () => {
    setUploadFailed(false)
    setIsSubmitted(false)
    await recorder.start()
  }

  const handleSubmit = async () => {
    if (!recorder.audioBlob || isUploading) return

    setIsUploading(true)
    setUploadFailed(false)

    try {
      const upload = await uploadPrivatePronunciationRecording(recorder.audioBlob)
      if (upload.success === false) {
        // Details stehen bereits im Log des privaten Uploads
        // (Bucket, Pfad, MIME-Type, Fehlergrund) – hier nur der Ablaufkontext.
        console.error("Einreichung abgebrochen: Audio-Upload fehlgeschlagen.")
        setUploadFailed(true)
        return
      }

      const result = await createPronunciationSubmission({ promptId, audioPath: upload.audioPath })

      if (!result.success) {
        console.error("Einreichung abgebrochen: Speichern in der Datenbank fehlgeschlagen.")
        setUploadFailed(true)
        return
      }

      setIsSubmitted(true)
      onSubmitted?.()
      router.refresh()
    } catch (err) {
      // Fängt z.B. Netzwerkabbrüche beim Aufruf der Server Action ab, die
      // sonst als unbehandelte Promise-Rejection verschwinden würden.
      console.error("Unerwarteter Fehler beim Einreichen der Aufnahme:")
      setUploadFailed(true)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div
      className={`min-w-0 break-words rounded-3xl border border-[var(--border)] bg-[var(--surface)] text-center text-[var(--foreground)] shadow-sm transition-colors ${
        compact ? 'p-5 shadow-none' : mobileSticky ? 'p-3 lg:p-8' : 'p-5 sm:p-8'
      }`}
    >
      {!compact && (
        <div className={mobileSticky ? 'hidden lg:block' : undefined}>
          <h2 className="mb-4 text-2xl font-bold text-[var(--foreground)]">
            {t('record_title')}
          </h2>
          <p className="mb-8 text-lg text-[var(--muted)]">{t('record_hint')}</p>
        </div>
      )}

      {(recorder.isRecording || recorder.hasRecording) && (
        <div className="mb-6 bg-[var(--surface-muted)] p-3 sm:p-5 rounded-2xl border border-[var(--border)] text-left">
          {recorder.isRecording ? (
            <div className="mb-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-base font-bold uppercase tracking-wider text-[var(--muted)]">
                  {t('your_recording')}
                </span>
                <span className="flex items-center gap-2 text-base font-bold text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))] px-2 py-1 rounded">
                  <span className="h-2 w-2 bg-[var(--accent)] rounded-full animate-pulse"></span>
                  {t('recording_running')}
                </span>
              </div>
              <LiveWaveform
                levels={recorder.levels}
                isActive
                elapsedSeconds={recorder.elapsedSeconds}
                ariaLabel={t('waveform_live_aria')}
                analyserRef={recorder.analyserRef}
              />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="min-w-0 flex-1 w-full">
                <WaveformPlayer
                  src={recorder.audioUrl}
                  blob={recorder.audioBlob}
                  t={t}
                  label={t('your_recording')}
                  compact
                />
              </div>
              {!isSubmitted && (
                <button
                  type="button"
                  onClick={recorder.reset}
                  disabled={isUploading}
                  aria-label={t('delete_recording_aria')}
                  className="mt-4 flex min-h-[56px] min-w-[56px] w-full shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--muted)] transition-colors hover:border-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface))] hover:text-[var(--danger)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50 sm:mt-0 sm:w-auto"
                >
                  <Trash2 size={24} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {statusMessage && (
        <p
          className="mx-auto mb-6 flex max-w-xl items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-left text-lg text-[var(--danger)]"
          role="status"
        >
          <TriangleAlert size={24} className="mt-0.5 shrink-0" aria-hidden="true" />
          {statusMessage}
        </p>
      )}

      {recorder.status === 'requesting' && (
        <p role="status" className="mb-4 text-base text-[var(--muted)]">{t('requesting_mic')}</p>
      )}
      <div className="mb-2 flex flex-col items-center justify-center gap-4 sm:flex-row">
        {recorder.isRecording ? (
          <button
            type="button"
            onClick={recorder.stop}
            className="flex min-h-[56px] min-w-[56px] w-full items-center justify-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-5 py-3 text-lg font-semibold text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:w-auto"
          >
            <Square size={26} aria-hidden="true" /> {t('stop_recording')}
          </button>
        ) : (
          !recorder.hasRecording && (
            <button
              type="button"
              onClick={handleStart}
              disabled={recorder.status === 'requesting' || isUploading}
              className="flex min-h-[56px] min-w-[56px] w-full items-center justify-center gap-3 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {recorder.status === 'requesting' ? (
                <Loader2 size={26} className="animate-spin" aria-hidden="true" />
              ) : (
                <Mic size={26} aria-hidden="true" />
              )}
              {t('start_recording')}
            </button>
          )
        )}
      </div>

      {recorder.hasRecording && (
        <div className="mt-6 border-t border-[var(--border)] pt-6">
          {isSubmitted ? (
            <div className="mx-auto inline-flex max-w-xl items-center gap-4 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--success)_10%,var(--surface))] p-4 text-left sm:p-6">
              <CheckCircle2 className="h-8 w-8 shrink-0 text-[var(--success)]" aria-hidden="true" />
              <div>
                <p className="text-xl font-bold text-[var(--success)]">
                  {t('submitted')}
                </p>
                <p className="mt-1 text-lg text-[var(--success)]">
                  {t('submitted_hint')}
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isUploading}
              className="mx-auto flex min-h-16 min-w-14 w-full items-center justify-center gap-3 rounded-2xl bg-[var(--accent)] px-5 py-3 text-lg font-semibold text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isUploading ? (
                <Loader2 className="animate-spin" size={28} aria-hidden="true" />
              ) : (
                <UploadCloud size={28} aria-hidden="true" />
              )}
              {isUploading ? t('submitting') : t('submit_for_review')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
