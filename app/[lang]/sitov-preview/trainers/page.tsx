import { notFound } from 'next/navigation'
import TrainerStatusTiles from '@/components/dashboard/TrainerStatusTiles'
import SitovPreviewAppearance from '@/components/dashboard/SitovPreviewAppearance'
import ModeDock from '@/components/dashboard/ModeDock'
import MotionProvider from '@/components/motion/MotionProvider'
import { LEARNING_MODES, modeHref } from '@/lib/mode-targets'
import { studentTranslator } from '@/lib/student-ui-i18n'
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

const sitovNewLearner: LevelLearningStatus = {
  ...sitovStatus,
  vocabulary: { locked: false, due: 0, activeWords: 0, total: 120, learned: 0 },
  grammar: { locked: false, total: 0, solved: 0, topics: 0, openTopics: 0 },
  pronunciation: { locked: false, texts: 10, open: 10, waiting: 0, unread: 0 },
  media: { locked: false, total: 0, fresh: 0 },
  verbs: { locked: false, total: 140, selected: 0, due: 0, mastered: 0 },
  fresh: { vocabulary: false, path: false, pronunciation: false, media: false, verbs: false },
}

/** Local visual QA only; every preview returns 404 in production. */
export default async function SitovTrainerPreviewPage({ params }: { params: Promise<{ lang: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  const sitovCopy = studentTranslator(lang)
  return <MotionProvider><div className="academy-container" style={{ display: 'grid', gap: '2rem', maxWidth: 1120, paddingBlock: '2rem' }}>
    <h1 className="text-2xl font-bold">Sitov Academy · Trainer preview</h1>
    <SitovPreviewAppearance />
    <div style={{ maxWidth: 448 }}><TrainerStatusTiles lang={lang} level="A1.1" status={sitovNewLearner} languageLocked={false} title={sitovCopy('areas_title_level', { level: 'A1.1' })} continueLink={{ href: modeHref(lang, 'A1.1', 'path'), label: sitovCopy('continue_to_path') }} /></div>
    <div style={{ maxWidth: 448 }}><TrainerStatusTiles lang={lang} level="A1.1" status={sitovStatus} languageLocked={false} title="Active learning areas" /></div>
    <ModeDock lang={lang} level="A1.1" entries={LEARNING_MODES.map(mode => ({ mode, lock: null, count: mode === 'vocabulary' ? 24 : undefined }))} />
    <TrainerStatusTiles lang={lang} level="A1.1" status={sitovStatus} languageLocked={false} title="Level overview" layout="modes" />
    <TrainerStatusTiles lang={lang} level="B2" status={{ ...sitovStatus, level: 'B2', vocabulary: { ...sitovStatus.vocabulary!, locked: true }, grammar: { ...sitovStatus.grammar!, locked: true }, pronunciation: { ...sitovStatus.pronunciation!, locked: true }, media: { ...sitovStatus.media!, locked: true } }} languageLocked={false} title="B2 · Verb trainer access" layout="modes" />
  </div></MotionProvider>
}
