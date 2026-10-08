import { resolveSitovVerbTarget } from '@/lib/learning/sitov-learning-target-server'
import VerbTrainerClient from '@/components/verbs/VerbTrainerClient'
import { loadSitovVerbTrainer } from '@/app/actions/verbs'
import { getSitovVerbCopy } from '@/lib/verbs/i18n'

export default async function SitovVerbPage({ params, searchParams }: { params: Promise<{ lang: string; level: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { lang, level } = await params
  const query = await searchParams
  const state = await loadSitovVerbTrainer(decodeURIComponent(level), lang)
  if (state.error) return <div role="alert" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">{getSitovVerbCopy(lang).failed}</div>
  const sitovTarget = resolveSitovVerbTarget(query.sitov_target, query.tense, state.data)
  return <VerbTrainerClient sitovTarget={sitovTarget} key={`${state.data.learnerId}:${state.data.level}:${lang}:${query.sitov_target ?? ''}`} initialState={state.data} lang={lang} />
}
