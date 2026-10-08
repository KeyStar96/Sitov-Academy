import { notFound } from 'next/navigation'
import PronunciationStudio from '@/components/audio/PronunciationStudio'
import MotionProvider from '@/components/motion/MotionProvider'
import SitovPreviewAppearance from '@/components/dashboard/SitovPreviewAppearance'
import { getPronunciationTranslations } from '@/lib/pronunciation-i18n'
import type { SitovPronunciationPretestCatalogEntry } from '@/lib/sitov-pronunciation-pretest-contract'
import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'
import '@/components/dashboard/student.css'

const sitovPrompt: PronunciationPrompt = {
  id: 'fd1297a1-999f-5759-b0d9-1f77c381d114', unitId: 'fd1297a1-999f-5759-b0d9-1f77c381d114', lesson: 'Am Samstag im Park', title: 'Am Samstag im Park', cefrLevel: 'A1',
  sentenceDe: 'Heute ist Samstag. Die Sonne scheint. Mein Freund und ich gehen in den Park. Dort sind viele Bäume und Blumen. Wir sitzen auf einer Bank. Ein kleiner Hund spielt im Gras. Wir hören Musik und essen unser Brot.',
  focus: 'a und r; ruhiger Rhythmus', audioUrl: null, sortOrder: 0,
}
/** Local visual QA only; no sample learner or private recording is created. */
export default async function SitovPronunciationPreview({ params, searchParams }: {
  params: Promise<{ lang: string }>; searchParams: Promise<{ locked?: string }>
}) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  await searchParams
  // Sanitized development-only authoring state. No fictional pass or old hard override.
  const sitovEntry: SitovPronunciationPretestCatalogEntry = {
    textId: sitovPrompt.id, unitId: sitovPrompt.unitId, level: 'A1.1', title: sitovPrompt.title!, focus: sitovPrompt.focus,
    kind: 'regular', textVersion: '0'.repeat(64), testVersion: null, status: 'locked', lockedReason: 'authoring_not_ready',
    attempt: null, proof: null, target: null,
  }
  return <MotionProvider><main className="academy-container" style={{ maxWidth: 1120, paddingBlock: '2rem' }}>
    <div className="mb-6"><SitovPreviewAppearance /></div>
    <PronunciationStudio prompts={[]} conversations={[]} level="A1.1" lang={lang} translations={getPronunciationTranslations(lang)} catalog={{ ok: true, data: [sitovEntry] }} />
  </main></MotionProvider>
}
