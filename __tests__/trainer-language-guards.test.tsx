import React from 'react'
import { render, screen } from '@testing-library/react'
import VocabularyPage from '@/app/[lang]/dashboard/level/[level]/vocabulary/page'
import TrainPage from '@/app/[lang]/dashboard/level/[level]/vocabulary/train/page'
import ExercisesPage from '@/app/[lang]/dashboard/level/[level]/exercises/page'
import PronunciationPage from '@/app/[lang]/dashboard/level/[level]/pronunciation/page'
import VideosPage from '@/app/[lang]/dashboard/level/[level]/videos/page'
import VideoPage from '@/app/[lang]/dashboard/level/[level]/videos/[id]/page'
import TrainerAccessGuard from '@/components/dashboard/TrainerAccessGuard'
import TrainerLanguageRequired from '@/components/dashboard/TrainerLanguageRequired'
import { getDictionary } from '@/lib/dictionary'
import { getVocabularySession, getLessonStats } from '@/app/actions/vocabulary'
import { getExercises } from '@/app/actions/exercises'
import { getPronunciationPrompts } from '@/app/actions/pronunciation'
import { getPronunciationConversations } from '@/app/actions/pronunciation-conversations'
import { currentUserHasTrainerAccess } from '@/lib/access/server'
import { createClient } from '@/utils/supabase/server'

jest.unmock('lucide-react')
jest.mock('@/components/vocabulary/VocabTrainerPageClient', () => () => null)
jest.mock('@/components/vocabulary/VocabCardSession', () => () => null)
jest.mock('@/components/exercises/ExerciseClient', () => () => null)
jest.mock('@/components/audio/PronunciationPractice', () => () => null)
jest.mock('@/components/audio/PronunciationInbox', () => () => null)
jest.mock('@/components/dashboard/VideoLibrary', () => () => null)
jest.mock('@/app/actions/vocabulary', () => ({ getVocabularySession: jest.fn(), getLessonStats: jest.fn() }))
jest.mock('@/app/actions/exercises', () => ({ getExercises: jest.fn() }))
jest.mock('@/app/actions/pronunciation', () => ({ getPronunciationPrompts: jest.fn() }))
jest.mock('@/app/actions/pronunciation-conversations', () => ({ getPronunciationConversations: jest.fn() }))
jest.mock('@/lib/access/server', () => ({ currentUserHasTrainerAccess: jest.fn() }))
jest.mock('@/lib/dictionary', () => ({ getDictionary: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))

const params = Promise.resolve({ lang: 'de', level: 'A1.1', id: 'video-id' })
const cases = [
  ['vocabulary', () => VocabularyPage({ params })],
  ['learning box', () => TrainPage({ params, searchParams: Promise.resolve({}) })],
  ['grammar', () => ExercisesPage({ params })],
  ['pronunciation', () => PronunciationPage({ params })],
  ['video deep link', () => VideoPage({ params })],
  ['trainer guard', () => TrainerAccessGuard({ params, trainer: 'vocabulary', children: <p>Hidden trainer</p> })],
] as const

beforeEach(() => jest.clearAllMocks())

test.each(cases)('German %s shows a language choice before loading learner data', async (_name, page) => {
  render(await page())
  expect(screen.getByRole('link', { name: 'Sprache im Profil auswählen' })).toHaveAttribute('href', '/de/dashboard/profile#language-settings')
  for (const loader of [getDictionary, getVocabularySession, getLessonStats, getExercises, getPronunciationPrompts, getPronunciationConversations, currentUserHasTrainerAccess, createClient]) expect(loader).not.toHaveBeenCalled()
  expect(screen.queryByText('Hidden trainer')).not.toBeInTheDocument()
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
  expect(screen.queryByRole('link', { name: 'Sprache im Profil auswählen' })).not.toBeInTheDocument()
})
