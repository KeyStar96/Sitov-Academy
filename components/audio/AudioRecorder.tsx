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
 *
 * Auf Handys (`mobileFloating`) läuft die Bedienung über eine schwebende
 * Ebene statt über eine Karte im Textfluss:
 *   Ruhezustand  → runder Aufnahme-Knopf (FAB) unten rechts,
 *   Aufnahme     → schmale Glasleiste mit Stopp-Knopf und Live-Wellenform,
 *   Auswertung   → die schwebende Ebene verschwindet, Player und Aktionen
 *                  stehen als normale Karte unter dem Vorlesetext.
 * So verdeckt die Aufnahme-UI den vorzulesenden Text zu keinem Zeitpunkt.
 */
export default function AudioRecorder({
  promptId,
  onRecordingStateChange,
  level,
  translations,
  onSubmitted,
  compact = false,
  mobileFloating = false,
  onPhaseChange,
}: {
  promptId: string
  onRecordingStateChange?: (busy: boolean) => void
  level?: string
  translations?: PronunciationTranslations
  onSubmitted?: () => void
  compact?: boolean
  mobileFloating?: boolean
  /** Ablauf für die Schritt-Anzeige im Sprechstudio. */
  onPhaseChange?: (phase: 'idle' | 'recording' | 'review' | 'submitted') => void
}) {
  const t = createPronunciationTranslator(translations ?? {})
  const recorder = useAudioRecorder()
  const router = useRouter()

  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [uploadFailed, setUploadFailed] = useState(false)
  useEffect(() => { onRecordingStateChange?.(recorder.status === 'requesting' || recorder.isRecording || isUploading || (recorder.hasRecording && !isSubmitted)) }, [recorder.status, recorder.isRecording, recorder.hasRecording, isUploading, isSubmitted, onRecordingStateChange])
  const phase = isSubmitted ? 'submitted' : recorder.isRecording ? 'recording' : recorder.hasRecording ? 'review' : 'idle'
  useEffect(() => { onPhaseChange?.(phase) }, [phase, onPhaseChange])

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

  /** Auf dem Handy trägt die schwebende Ebene die Bedienung – die Karte bleibt dort leer. */
  const isReviewing = recorder.hasRecording && !recorder.isRecording
  const cardOnlyOnDesktop = mobileFloating && !isReviewing
  const mobileHidden = mobileFloating ? 'hidden lg:block' : undefined

  const statusBanner = statusMessage && (
    <p
      className="mx-auto mb-6 flex max-w-xl items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-left text-lg text-[var(--danger)]"
      role="status"
    >
      <TriangleAlert size={24} className="mt-0.5 shrink-0" aria-hidden="true" />
      {statusMessage}
    </p>
  )

  const card = (
    <div
      className={`min-w-0 break-words rounded-3xl border border-[var(--border)] bg-[var(--surface)] text-center text-[var(--foreground)] shadow-sm transition-colors ${
        compact ? 'p-5 shadow-none' : mobileFloating ? 'p-5 lg:p-8' : 'p-5 sm:p-8'
      } ${cardOnlyOnDesktop ? 'hidden lg:block' : ''}`}
    >
      {!compact && (
        <div className={mobileHidden}>
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
                <span className="flex items-center gap-2 text-base font-bold text-[var(--accent-text)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))] px-2 py-1 rounded">
                  <span className="h-2 w-2 bg-[var(--accent-strong)] rounded-full animate-pulse"></span>
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
                  className="mt-4 flex min-h-[56px] min-w-[56px] w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-[var(--muted)] transition-colors hover:border-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_8%,var(--surface))] hover:text-[var(--danger)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50 sm:mt-0 sm:w-auto"
                >
                  <Trash2 size={24} aria-hidden="true" />
                  {/* Der volle Balken bleibt auf dem Handy sonst ein Icon ohne Bedeutung. */}
                  <span className="text-base font-semibold sm:sr-only">{t('delete_recording')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Im Ruhezustand ist die Karte auf dem Handy ausgeblendet – dort meldet
          die schwebende Ebene den Fehler, sodass er nie doppelt vorgelesen wird. */}
      {statusBanner}

      {recorder.status === 'requesting' && (
        <p role="status" className="mb-4 text-base text-[var(--muted)]">{t('requesting_mic')}</p>
      )}
      <div className={`mb-2 flex-col items-center justify-center gap-4 sm:flex-row ${mobileFloating ? 'hidden lg:flex' : 'flex'}`}>
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
              className="st-mic flex min-h-[4.5rem] min-w-[56px] w-full items-center justify-center gap-3 rounded-full bg-[var(--accent-strong)] px-8 py-3 text-xl font-bold text-[var(--accent-foreground)] shadow-lg transition-colors hover:bg-[var(--accent-strong-hover)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
              className="mx-auto flex min-h-16 min-w-14 w-full items-center justify-center gap-3 rounded-2xl bg-[var(--accent-strong)] px-5 py-3 text-lg font-semibold text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[var(--accent-strong-hover)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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

  if (!mobileFloating) return card

  return (
    <>
      {card}

      {/* Schwebende Bedienebene – nur auf Handys, nie während der Auswertung. */}
      {!isReviewing && (
        <div
          data-testid="pronunciation-recording-bar"
          className="pronunciation-recorder-dock pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
            {statusMessage && (
              <p
                role="status"
                className="pronunciation-recorder-glass pointer-events-auto flex w-full items-start gap-3 rounded-2xl p-4 text-left text-base text-[var(--danger)] shadow-lg"
              >
                <TriangleAlert size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
                {statusMessage}
              </p>
            )}

            {recorder.isRecording ? (
              <div className="pronunciation-recorder-glass pointer-events-auto flex w-full items-center gap-3 rounded-2xl p-2 pr-4 shadow-xl">
                <button
                  type="button"
                  onClick={recorder.stop}
                  aria-label={t('stop_recording')}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--danger)] text-white shadow-md transition-transform duration-200 hover:scale-105 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100"
                >
                  <Square size={24} fill="currentColor" aria-hidden="true" />
                </button>
                <LiveWaveform
                  compact
                  levels={recorder.levels}
                  isActive
                  elapsedSeconds={recorder.elapsedSeconds}
                  ariaLabel={t('waveform_live_aria')}
                  analyserRef={recorder.analyserRef}
                />
                <span className="sr-only" role="status">{t('recording_running')}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                disabled={recorder.status === 'requesting' || isUploading}
                aria-label={t('start_recording')}
                className="st-mic pointer-events-auto relative flex min-h-[4.25rem] shrink-0 items-center justify-center gap-3 rounded-full bg-[var(--accent-strong)] px-7 text-lg font-bold text-[var(--accent-foreground)] shadow-xl shadow-black/25 ring-1 ring-white/20 transition-transform duration-200 hover:scale-105 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none motion-reduce:hover:scale-100"
              >
                {recorder.status === 'requesting' ? (
                  <Loader2 size={28} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Mic size={28} aria-hidden="true" />
                )}
                <span aria-hidden="true">{t('start_recording')}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
