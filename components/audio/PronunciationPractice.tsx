'use client'

import { useMemo, useState } from 'react'
import { Check, ListMusic } from 'lucide-react'
import AudioRecorder from '@/components/audio/AudioRecorder'
import WaveformPlayer from '@/components/audio/WaveformPlayer'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import {
  createPronunciationTranslator,
  type PronunciationTranslations,
} from '@/lib/pronunciation-i18n'
import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'

/**
 * Satzauswahl + Referenzhören + Aufnahme.
 *
 * Die Waveform der Referenz nutzt denselben `AnalyserNode`-Pfad wie die
 * Wiedergabe eigener Aufnahmen, sobald eine Audio-URL vorliegt. Fehlt die
 * Datei, lädt der Neural-Player eine gecachte deutsche MP3.
 */
export default function PronunciationPractice({
  prompts,
  level,
  translations,
}: {
  prompts: readonly PronunciationPrompt[]
  level: string
  translations?: PronunciationTranslations
}) {
  const t = createPronunciationTranslator(translations ?? {})
  const [selectedId, setSelectedId] = useState<string | null>(prompts[0]?.id ?? null)

  const selected = useMemo(
    () => prompts.find((prompt) => prompt.id === selectedId) ?? prompts[0] ?? null,
    [prompts, selectedId]
  )

  if (prompts.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-muted)]">
          <ListMusic className="h-8 w-8 text-[var(--accent)]" aria-hidden="true" />
        </div>
        <p className="text-lg font-bold text-[var(--foreground)]">{t('prompts_empty')}</p>
        <p className="mx-auto mt-2 max-w-md text-base text-[var(--muted)]">
          {t('prompts_empty_hint')}
        </p>
        <div className="mt-8">
          <AudioRecorder level={level} translations={translations} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section
        aria-label={t('prompts_title')}
        className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6"
      >
        <h2 className="text-xl font-bold text-[var(--foreground)]">{t('prompts_title')}</h2>
        <p className="mt-1 text-base text-[var(--muted)]">{t('prompts_hint')}</p>

        <ul className="mt-4 grid grid-cols-1 gap-3">
          {prompts.map((prompt, index) => {
            const isSelected = selected?.id === prompt.id
            return (
              <li key={prompt.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(prompt.id)
                  }}
                  aria-pressed={isSelected}
                  className={`flex min-h-14 w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--surface-muted)]'
                      : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isSelected ? 'bg-[var(--accent)] text-[var(--accent-foreground)]' : 'bg-[var(--surface-muted)] text-[var(--muted)]'
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected ? <Check size={20} /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-semibold text-[var(--foreground)]">
                      {prompt.sentenceDe}
                    </span>
                    {prompt.focus && (
                      <span className="mt-1 block text-sm font-medium text-[var(--muted)]">
                        {t('prompt_focus', { focus: prompt.focus })}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {selected && (
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
          <p className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
            {t('reference_label')}
          </p>
          <p className="mt-2 text-2xl font-extrabold leading-snug text-[var(--foreground)]">
            {selected.sentenceDe}
          </p>

          <div className="mt-5">
            {selected.audioUrl ? (
              <WaveformPlayer
                src={selected.audioUrl}
                t={t}
                label={t('reference_listen')}
              />
            ) : (
              <SolutionAudioButton
                text={selected.sentenceDe}
                language="de"
                label={t('reference_listen')}
                ariaLabel={t('reference_listen_aria')}
              />
            )}
          </div>
        </section>
      )}

      <AudioRecorder level={level} translations={translations} />
    </div>
  )
}
