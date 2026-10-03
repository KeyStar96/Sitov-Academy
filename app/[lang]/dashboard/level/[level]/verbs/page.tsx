import VerbTrainerClient from '@/components/verbs/VerbTrainerClient'
import { loadSitovVerbTrainer } from '@/app/actions/verbs'
import { getSitovVerbCopy } from '@/lib/verbs/i18n'

export default async function SitovVerbPage({ params }: { params: Promise<{ lang: string; level: string }> }) {
  const { lang, level } = await params
  const state = await loadSitovVerbTrainer(decodeURIComponent(level), lang)
  if (state.error) return <div role="alert" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">{getSitovVerbCopy(lang).failed}</div>
  return <VerbTrainerClient key={`${state.data.learnerId}:${state.data.level}:${lang}`} initialState={state.data} lang={lang} />
}
