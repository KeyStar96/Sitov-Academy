import { notFound } from 'next/navigation'
import PronunciationStudio from '@/components/audio/PronunciationStudio'
import MotionProvider from '@/components/motion/MotionProvider'
import SitovPreviewAppearance from '@/components/dashboard/SitovPreviewAppearance'
import { getPronunciationTranslations } from '@/lib/pronunciation-i18n'
import { SITOV_PRONUNCIATION_REQUIREMENTS, type SitovPronunciationReadiness } from '@/lib/sitov-pronunciation-readiness'
import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'
import '@/components/dashboard/student.css'

const sitovPrompt: PronunciationPrompt = {
  id: 'fd1297a1-999f-5759-b0d9-1f77c381d114', unitId: 'fd1297a1-999f-5759-b0d9-1f77c381d114', lesson: 'Am Samstag im Park', title: 'Am Samstag im Park', cefrLevel: 'A1',
  sentenceDe: 'Heute ist Samstag. Die Sonne scheint. Mein Freund und ich gehen in den Park. Dort sind viele Bäume und Blumen. Wir sitzen auf einer Bank. Ein kleiner Hund spielt im Gras. Wir hören Musik und essen unser Brot.',
  focus: 'a und r; ruhiger Rhythmus', audioUrl: null, sortOrder: 0,
}
/** Local visual QA only; no sample learner or private recording is created. */
export default async function SitovPronunciationPreview({ params, searchParams }: {
  params: Promise<{ lang: string }>; searchParams: Promise<{ locked?: string; hard?: string }>
}) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  const { locked, hard } = await searchParams
  const sitovReadiness: SitovPronunciationReadiness = {
    level: 'A1.1', mode: hard ? 'hard' : 'logical', tier: locked ? 0 : 1, requirements: [...SITOV_PRONUNCIATION_REQUIREMENTS],
    stats: { knownWords: locked ? 12 : 41, grammarNodes: locked ? 1 : 2, passedTests: 0, legacyGrammarExercises: 0, legacyGrammarTopics: 0, confidentVerbForms: locked ? 1 : 4, verbEvidenceRequired: true },
    texts: [{ id: sitovPrompt.id, title: sitovPrompt.title!, ready: !locked, tier: 1, wordCount: 38, coveragePercent: locked ? 25 : 72, requiredCoveragePercent: 60 },
      { id: 'fd1297a1-999f-5759-b0d9-1f77c381d115', title: 'Leon erzählt von seinem Tag', ready: false, tier: 2, wordCount: 80, coveragePercent: 44, requiredCoveragePercent: 60 }],
  }
  return <MotionProvider><main className="academy-container" style={{ maxWidth: 1120, paddingBlock: '2rem' }}>
    <div className="mb-6"><SitovPreviewAppearance /></div>
    <PronunciationStudio prompts={locked ? [] : [sitovPrompt]} conversations={[]} level="A1.1" lang={lang} translations={getPronunciationTranslations(lang)} readiness={sitovReadiness} />
  </main></MotionProvider>
}
