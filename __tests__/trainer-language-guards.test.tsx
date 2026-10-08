jest.mock('@/app/actions/learning-checkpoints', () => ({
  loadLearningCheckpoint: jest.fn().mockResolvedValue({ ok: true, learnerId: '00000000-0000-4000-8000-000000000001', checkpoint: null }),
  saveLearningCheckpoint: jest.fn(async (_kind, _level, state, revision) => ({ ok: true, learnerId: '00000000-0000-4000-8000-000000000001', checkpoint: { state, revision: revision + 1, updatedAt: '2026-10-03T09:00:00Z' } })),
  clearLearningCheckpoint: jest.fn(async (_kind, _level, revision) => ({ ok: true, learnerId: '00000000-0000-4000-8000-000000000001', checkpoint: { state: {}, revision: revision + 1, updatedAt: '2026-10-03T09:00:00Z' } })),
}))
import React from 'react'
import { render, screen } from '@testing-library/react'
import VocabularyPage from '@/app/[lang]/dashboard/level/[level]/vocabulary/page'
import TrainPage from '@/app/[lang]/dashboard/level/[level]/vocabulary/train/page'
import LearningPathPage from '@/app/[lang]/dashboard/level/[level]/path/page'
import PronunciationPage from '@/app/[lang]/dashboard/level/[level]/pronunciation/page'
import VideosPage from '@/app/[lang]/dashboard/level/[level]/videos/page'
import TrainerAccessGuard from '@/components/dashboard/TrainerAccessGuard'
import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { getDictionary } from '@/lib/dictionary'
import { getVocabularySession, getVocabularyOverview } from '@/app/actions/vocabulary'
import { getLearningPath } from '@/app/actions/learning-path'
import { getPronunciationPrompts } from '@/app/actions/pronunciation'
import { getPronunciationConversations } from '@/app/actions/pronunciation-conversations'
import { currentUserHasTrainerAccess } from '@/lib/access/server'
import { createClient } from '@/utils/supabase/server'

jest.unmock('lucide-react')
jest.mock('@/lib/learning-new-server', () => ({ loadLearningNewItems: jest.fn().mockResolvedValue({ items: {}, lessonIds: {} }), loadLearningNewCounts: jest.fn().mockResolvedValue(null) }))
jest.mock('@/components/vocabulary/VocabTrainerPageClient', () => () => null)
jest.mock('@/components/vocabulary/VocabCardSession', () => () => null)
jest.mock('@/components/learning-path/LearningPathClient', () => () => null)
jest.mock('@/components/audio/PronunciationStudio', () => () => null)
jest.mock('@/components/dashboard/VideoLibrary', () => () => null)
jest.mock('@/app/actions/vocabulary', () => ({ getVocabularySession: jest.fn(), getVocabularyOverview: jest.fn(), getVocabularyCarryover: jest.fn().mockResolvedValue({ total: 0 }) }))
jest.mock('@/app/actions/learning-path', () => ({ getLearningPath: jest.fn() }))
jest.mock('@/app/actions/pronunciation', () => ({ getPronunciationPrompts: jest.fn() }))
jest.mock('@/app/actions/sitov-pronunciation-access', () => ({ getSitovPronunciationReadiness: jest.fn().mockResolvedValue(null) }))
jest.mock('@/app/actions/pronunciation-conversations', () => ({ getPronunciationConversations: jest.fn() }))
jest.mock('@/app/actions/media', () => ({ getMediaFolders: jest.fn().mockResolvedValue({ success: true, data: [] }) }))
jest.mock('@/lib/access/server', () => ({ currentUserHasTrainerAccess: jest.fn() }))
jest.mock('@/lib/dictionary', () => ({ getDictionary: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))

const params = Promise.resolve({ lang: 'de', level: 'A1.1', id: 'video-id' })
const cases = [
  ['vocabulary', () => VocabularyPage({ params })],
  ['learning box', () => TrainPage({ params, searchParams: Promise.resolve({}) })],
] as const

beforeEach(() => jest.clearAllMocks())

test('German learning path loads its authorized content', async () => {
  jest.mocked(getLearningPath).mockResolvedValue({ data: {} } as never)
  render(await LearningPathPage({ params }))
  expect(getLearningPath).toHaveBeenCalledWith('A1.1', 'de')
})

test('German pronunciation route loads individually authorized prompts and preserved conversations', async () => {
  jest.mocked(getDictionary).mockResolvedValue({ pronunciation: {} } as never)
  jest.mocked(getPronunciationPrompts).mockResolvedValue([])
  jest.mocked(getPronunciationConversations).mockResolvedValue([])
  render(await PronunciationPage({ params, searchParams: Promise.resolve({}) }))
  expect(getPronunciationPrompts).toHaveBeenCalledWith('A1.1')
  expect(getPronunciationConversations).toHaveBeenCalledWith('A1.1')
})

test('German trainer guard checks commercial rights and admits an authorized child', async () => {
  jest.mocked(getDictionary).mockResolvedValue({ dashboard: {} } as never)
  jest.mocked(currentUserHasTrainerAccess).mockResolvedValue(true)
  render(await TrainerAccessGuard({ params, trainer: 'vocabulary', children: <p>Authorized trainer</p> }))
  expect(currentUserHasTrainerAccess).toHaveBeenCalledWith('A1.1', 'vocabulary')
  expect(screen.getByText('Authorized trainer')).toBeInTheDocument()
})

test.each(cases)('German %s shows a source choice only after the authenticated source check', async (_name, page) => {
  jest.mocked(getDictionary).mockResolvedValue({ vocabulary: {} } as never)
  jest.mocked(getVocabularyOverview).mockResolvedValue({ box: {}, carryover: null } as never)
  jest.mocked(getVocabularySession).mockResolvedValue({ learnerId: 'learner', cards: [], deferredCount: 0, previousCardId: null, learningSourceRequired: true })
  render(await page())
  expect(screen.getByRole('link', { name: 'Sprachangaben prüfen' })).toHaveAttribute('href', '/de/dashboard/profile#language-settings')
  expect(getVocabularySession).toHaveBeenCalledWith('A1.1', 'de', ...( _name === 'learning box' ? [undefined] : [] ))
})

test.each(cases)('German %s keeps a valid stored source and shows no language denial', async (_name, page) => {
  jest.mocked(getDictionary).mockResolvedValue({ vocabulary: {} } as never)
  jest.mocked(getVocabularyOverview).mockResolvedValue({ box: {}, carryover: null } as never)
  jest.mocked(getVocabularySession).mockResolvedValue({ learnerId: 'learner', cards: [], deferredCount: 0, previousCardId: null, learningSourceLanguage: 'tr' })
  render(await page())
  expect(screen.queryByRole('link', { name: 'Sprachangaben prüfen' })).not.toBeInTheDocument()
})

test.each(['de', 'en', 'ru', 'uk', 'tr'])('language notice has a usable localized profile link in %s', lang => {
  render(<TrainerLanguageRequired lang={lang} />)
  expect(screen.getByRole('heading')).toHaveTextContent(/./)
  expect(screen.getByRole('link')).toHaveAttribute('href', `/${lang}/dashboard/profile#language-settings`)
})

test('uploaded videos remain reachable by level even with a German interface', async () => {
  jest.mocked(getDictionary).mockResolvedValue({ videos: {} } as never)
  const order = jest.fn().mockResolvedValue({ data: [], error: null })
  jest.mocked(createClient).mockResolvedValue({ from: () => ({ select: () => ({ eq: () => ({ order }) }) }) } as never)
  render(await VideosPage({ params }))
  expect(order).toHaveBeenCalled()
  expect(currentUserHasTrainerAccess).not.toHaveBeenCalled()
  expect(screen.queryByRole('link', { name: 'Sprachangaben prüfen' })).not.toBeInTheDocument()
})
