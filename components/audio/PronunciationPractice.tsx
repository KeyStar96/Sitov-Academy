'use client'

import { useEffect, useState } from 'react'
import { prefetchNeuralAudio } from '@/lib/audio/neural-client'
import { BookOpen, Check, Headphones, Mic, MessageCircle } from 'lucide-react'
import AudioRecorder from '@/components/audio/AudioRecorder'
import WaveformPlayer from '@/components/audio/WaveformPlayer'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import { createPronunciationTranslator, type PronunciationTranslations } from '@/lib/pronunciation-i18n'
import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'

export default function PronunciationPractice({ prompts, level, translations }: { prompts: readonly PronunciationPrompt[]; level: string; translations?: PronunciationTranslations }) {
  const t = createPronunciationTranslator(translations ?? {})
  const [selectedId, setSelectedId] = useState(prompts[0]?.id)
  const [recordingBusy, setRecordingBusy] = useState(false)
  const selected = prompts.find((prompt) => prompt.id === selectedId) ?? prompts[0]
  useEffect(() => {
    if (!selected) return
    return prefetchNeuralAudio([{ text: selected.sentenceDe, language: 'de', audioUrl: selected.audioUrl }])
  }, [selected?.sentenceDe, selected?.audioUrl])
  if (!selected) return <section className="rounded-[2rem] border border-dashed border-[var(--border)] p-10 text-center"><BookOpen className="mx-auto mb-4 text-[var(--accent)]" size={32} /><h2 className="text-xl font-semibold">{t('prompts_empty')}</h2><p className="mt-3 text-[var(--muted)]">{t('prompts_empty_hint')}</p></section>
  const wordCount = selected.sentenceDe.split(/\s+/).length
  return <div className="pronunciation-practice space-y-6">
    <ol className="grid gap-3 sm:grid-cols-3">
      {([{ icon: BookOpen, key: 'step_read' }, { icon: Mic, key: 'step_record' }, { icon: MessageCircle, key: 'step_feedback' }] as const).map(({ icon: Icon, key }, index) => <li key={key} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--accent)]"><Icon size={20} /></span><span className="text-base font-semibold"><span className="mr-2 text-[var(--muted)]">0{index + 1}</span>{t(key)}</span></li>)}
    </ol>
    <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="min-w-0 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:sticky lg:top-8">
        <div className="mb-4 px-2"><h2 className="font-semibold">{t('prompts_title')}</h2><p className="mt-1 text-base text-[var(--muted)]">{t('text_count', { count: prompts.length })} · {level}</p></div>
        <label className="sr-only" htmlFor="pronunciation-text">{t('choose_text')}</label>
        <select id="pronunciation-text" value={selected.id} onChange={(event) => setSelectedId(event.target.value)} disabled={recordingBusy} className="min-h-12 w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-base disabled:opacity-50 lg:hidden">{prompts.map((prompt,index) => <option key={prompt.id} value={prompt.id}>{index + 1}. {prompt.title ?? prompt.sentenceDe}</option>)}</select>
        <ol className="hidden space-y-1 lg:block">{prompts.map((prompt,index) => <li key={prompt.id}><button type="button" disabled={recordingBusy && prompt.id !== selected.id} aria-pressed={prompt.id === selected.id} onClick={() => setSelectedId(prompt.id)} className={`flex min-h-14 w-full items-center gap-3 rounded-xl p-3 text-left text-base transition-colors disabled:opacity-40 ${prompt.id === selected.id ? 'bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))] text-[var(--accent)]' : 'text-[var(--muted)] hover:bg-[var(--surface-muted)]'}`}><span className="w-5 shrink-0 font-semibold">{prompt.id === selected.id ? <Check size={18} /> : String(index+1).padStart(2,'0')}</span><span className="font-medium">{prompt.title ?? prompt.sentenceDe}</span></button></li>)}</ol>
      </aside>
      <div className="min-w-0 space-y-5">
        <article className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <header className="border-b border-[var(--border)] p-6 sm:p-8"><div className="mb-4 flex flex-wrap gap-2 text-base font-semibold text-[var(--muted)]"><span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5">{level}</span><span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5">{t('words', { count: wordCount })}</span><span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5">{t('reading_time', { minutes: Math.max(1, Math.ceil(wordCount / 70)) })}</span></div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{selected.title ?? t('reference_label')}</h2>{selected.focus && <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{t('prompt_focus', { focus: selected.focus })}</p>}</header>
          <div className="pronunciation-reading-text p-6 sm:p-8"><p data-testid="pronunciation-reading-text" lang="de" className="whitespace-pre-line text-lg leading-[1.95] text-[var(--foreground)] sm:text-xl">{selected.sentenceDe}<span data-testid="pronunciation-text-end" className="pronunciation-text-end block h-px" aria-hidden="true" /></p><div className="mt-7 border-t border-[var(--border)] pt-6">{selected.audioUrl ? <WaveformPlayer src={selected.audioUrl} t={t} label={t('reference_listen')} /> : <SolutionAudioButton text={selected.sentenceDe} language="de" label={t('reference_listen')} ariaLabel={t('reference_listen_aria')} />}</div></div>
        </article>
        <p className="flex items-start gap-3 px-2 text-base leading-relaxed text-[var(--muted)]"><Headphones size={20} className="mt-0.5 shrink-0 text-[var(--accent)]" />{t('reading_tip')}</p>
        {/* Auswertung und Einreichen stehen im normalen Textfluss unter dem Vorlesetext.
            Start und Stopp liegen auf dem Handy in der schwebenden Ebene des Recorders. */}
        <AudioRecorder key={selected.id} promptId={selected.id} level={level} translations={translations} onRecordingStateChange={setRecordingBusy} mobileFloating />
        <p className="px-3 text-center text-base leading-relaxed text-[var(--muted)]">{t('recording_privacy')}</p>
      </div>
    </div>
  </div>
}
