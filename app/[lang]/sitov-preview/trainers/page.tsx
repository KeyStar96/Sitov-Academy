import { notFound } from 'next/navigation'
import TrainerStatusTiles from '@/components/dashboard/TrainerStatusTiles'
import SitovPreviewAppearance from '@/components/dashboard/SitovPreviewAppearance'
import ModeDock from '@/components/dashboard/ModeDock'
import MotionProvider from '@/components/motion/MotionProvider'
import { LEARNING_MODES } from '@/lib/mode-targets'
import type { LevelLearningStatus } from '@/lib/learning-status-server'
import '@/components/dashboard/student.css'

const sitovStatus: LevelLearningStatus = {
  level: 'A1.1', lessons: [], ownWords: null,
  vocabulary: { locked: false, due: 24, activeWords: 45, total: 120, learned: 12 },
  grammar: { locked: false, total: 30, solved: 12, topics: 8, openTopics: 4 },
  pronunciation: { locked: false, texts: 10, open: 8, waiting: 1, unread: 2 },
  media: { locked: false, total: 12, fresh: 0 },
  verbs: { locked: false, total: 93, selected: 24, due: 8, mastered: 6 },
  fresh: { vocabulary: false, path: false, pronunciation: false, media: false, verbs: true },
}

/** Local visual QA only; every preview returns 404 in production. */
export default async function SitovTrainerPreviewPage({ params }: { params: Promise<{ lang: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  return <MotionProvider><div className="academy-container" style={{ display: 'grid', gap: '2rem', maxWidth: 1120, paddingBlock: '2rem' }}>
    <h1 className="text-2xl font-bold">Sitov Academy · Trainer preview</h1>
    <SitovPreviewAppearance />
    <ModeDock lang={lang} level="A1.1" entries={LEARNING_MODES.map(mode => ({ mode, lock: null, count: mode === 'vocabulary' ? 24 : undefined }))} />
    <div style={{ maxWidth: 448 }}><TrainerStatusTiles lang={lang} level="A1.1" status={sitovStatus} languageLocked={false} title="Home" /></div>
    <TrainerStatusTiles lang={lang} level="A1.1" status={sitovStatus} languageLocked={false} title="Level overview" layout="modes" />
    <TrainerStatusTiles lang={lang} level="B2" status={{ ...sitovStatus, level: 'B2', vocabulary: { ...sitovStatus.vocabulary!, locked: true }, grammar: { ...sitovStatus.grammar!, locked: true }, pronunciation: { ...sitovStatus.pronunciation!, locked: true }, media: { ...sitovStatus.media!, locked: true } }} languageLocked={false} title="B2 · Verb trainer access" layout="modes" />
  </div></MotionProvider>
}
