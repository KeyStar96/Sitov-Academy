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
import { requestSession } from '@/lib/request-session'
import { resolveSitovPathRecommendationTopics } from '@/lib/learning/sitov-learning-recommendations-path-server'
import { getSitovPronunciationPretests } from '@/app/actions/sitov-pronunciation-pretest'
import { sitovPronunciationPretestCatalogSchema } from '@/lib/sitov-pronunciation-pretest-contract'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

jest.unmock('lucide-react')
jest.mock('@/lib/learning-new-server', () => ({ loadLearningNewItems: jest.fn().mockResolvedValue({ items: {}, lessonIds: {} }), loadLearningNewCounts: jest.fn().mockResolvedValue(null) }))
jest.mock('@/components/vocabulary/VocabTrainerPageClient', () => () => null)
jest.mock('@/components/vocabulary/VocabCardSession', () => () => null)
jest.mock('@/components/learning-path/LearningPathClient', () => () => null)
jest.mock('@/components/audio/PronunciationStudio', () => () => null)
jest.mock('@/components/dashboard/VideoLibrary', () => () => null)
jest.mock('@/app/actions/vocabulary', () => ({ getVocabularySession: jest.fn(), getVocabularyOverview: jest.fn(), getVocabularyCarryover: jest.fn().mockResolvedValue({ total: 0 }) }))
jest.mock('@/app/actions/learning-path', () => ({ getLearningPath: jest.fn() }))
jest.mock('@/lib/request-session', () => ({ requestSession: jest.fn() }))
jest.mock('@/lib/learning/sitov-learning-recommendations-path-server', () => ({ resolveSitovPathRecommendationTopics: jest.fn().mockResolvedValue([]) }))
jest.mock('@/app/actions/sitov-pronunciation-pretest', () => ({ getSitovPronunciationPretests: jest.fn() }))
jest.mock('@/app/actions/pronunciation', () => ({ getPronunciationPrompts: jest.fn() }))
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

const actor = '00000000-0000-4000-8000-000000000001'
const dictionaries = { de, en, ru, uk, tr }
beforeEach(() => {
  jest.clearAllMocks()
  const rpc = jest.fn(async (name: string) => {
    if (name !== 'get_learning_path') throw new Error(`Unexpected fixture RPC: ${name}`)
    return { data: { level: 'A1.1', paths: [], completed: false, next_level: null, next_level_available: false }, error: null }
  })
  jest.mocked(requestSession).mockResolvedValue({ user: { id: actor }, supabase: { rpc } } as unknown as Awaited<ReturnType<typeof requestSession>>)
  jest.mocked(getSitovPronunciationPretests).mockReset().mockResolvedValue({ ok: true, data: [] })
  jest.mocked(currentUserHasTrainerAccess).mockReset().mockResolvedValue(false)
})

test('German learning path loads its authorized content', async () => {
  const element = await LearningPathPage({ params })
  render(element)
  const session = await jest.mocked(requestSession).mock.results[0].value
  expect(session.supabase.rpc).toHaveBeenCalledWith('get_learning_path', { p_level: 'A1.1', p_locale: 'de' })
  expect(getLearningPath).not.toHaveBeenCalled()
  expect(element.props.initialError).toBeUndefined()
  expect(element.props.recommendationAccountKey).toBe(actor)
  expect(resolveSitovPathRecommendationTopics).toHaveBeenCalledWith(session, element.props.initialPath)
})

test('German pronunciation route loads individually authorized prompts and preserved conversations', async () => {
  jest.mocked(getDictionary).mockResolvedValue({ pronunciation: {} } as never)
  jest.mocked(getPronunciationPrompts).mockResolvedValue([])
  jest.mocked(getPronunciationConversations).mockResolvedValue([])
  const element = await PronunciationPage({ params, searchParams: Promise.resolve({}) })
  render(element)
  expect(getPronunciationPrompts).toHaveBeenCalledWith('A1.1')
  expect(getPronunciationConversations).toHaveBeenCalledWith('A1.1')
  expect(getSitovPronunciationPretests).toHaveBeenCalledWith('A1.1')
  expect(element.props).toMatchObject({ catalog: { ok: true, data: [] }, learnerId: actor, prompts: [], conversations: [] })
})

test('German trainer guard checks commercial rights and admits an authorized child', async () => {
  jest.mocked(getDictionary).mockResolvedValue({ dashboard: {} } as never)
  jest.mocked(currentUserHasTrainerAccess).mockResolvedValue(true)
  render(await TrainerAccessGuard({ params, trainer: 'vocabulary', children: <p>Authorized trainer</p> }))
  expect(currentUserHasTrainerAccess).toHaveBeenCalledWith('A1.1', 'vocabulary')
  expect(screen.getByText('Authorized trainer')).toBeInTheDocument()
})

test.each(['de', 'en', 'ru', 'uk', 'tr'] as const)('a denied trainer retains the localized level route and never renders its child in %s', async lang => {
  jest.mocked(getDictionary).mockResolvedValue(dictionaries[lang])
  render(await TrainerAccessGuard({ params: Promise.resolve({ lang, level: 'A1%2E1' }), trainer: 'vocabulary', children: <p>Forbidden trainer</p> }))
  expect(currentUserHasTrainerAccess).toHaveBeenCalledWith('A1.1', 'vocabulary')
  expect(screen.queryByText('Forbidden trainer')).not.toBeInTheDocument()
  expect(screen.getByRole('heading')).toHaveTextContent(dictionaries[lang].dashboard.trainer_locked_title)
  expect(screen.getByRole('link')).toHaveAttribute('href', `/${lang}/dashboard/level/A1.1`)
})

test('a passed per-text catalog and historical conversation remain distinct authorized inputs', async () => {
  const textId = '00000000-0000-4000-8000-000000000002', unitId = '00000000-0000-4000-8000-000000000003'
  const attemptId = '00000000-0000-4000-8000-000000000004', textVersion = 'a'.repeat(64), testVersion = 'b'.repeat(64)
  const at = '2026-10-09T09:00:00Z'
  const catalog = sitovPronunciationPretestCatalogSchema.parse([{ textId, unitId, level: 'A1.1', title: 'Ein Tag im Park', focus: null, kind: 'regular', textVersion, testVersion,
    status: 'passed', lockedReason: null, target: 'pronunciation',
    attempt: { id: attemptId, textId, textVersion, testVersion, status: 'passed', revision: 1, startedAt: at, updatedAt: at,
      questionIds: ['sitov.q1', 'sitov.q2', 'sitov.q3'], answers: { 'sitov.q1': 'sitov.o1', 'sitov.q2': 'sitov.o2', 'sitov.q3': 'sitov.o3' }, answeredCount: 3, totalCount: 3 },
    proof: { id: '00000000-0000-4000-8000-000000000005', textId, textVersion, testVersion, passedAttemptId: attemptId, passedAt: at, compatibilityId: null } }])
  const prompts = [{ id: textId, unitId, title: 'Ein Tag im Park', lesson: 'Park', level: 'A1.1', cefrLevel: 'A1' as const, sentenceDe: 'Paul geht in den Park.', focus: null, audioUrl: null, sortOrder: 1 }]
  const conversations = [{ id: 'sitov-old-conversation', level: 'A1.1', title: 'Frühere Aufnahme', readingText: null, status: 'reviewed', studentName: null, studentEmail: null, createdAt: at, messages: [], hasUnseen: false }]
  jest.mocked(getDictionary).mockResolvedValue(de)
  jest.mocked(getPronunciationPrompts).mockResolvedValue(prompts)
  jest.mocked(getPronunciationConversations).mockResolvedValue(conversations)
  jest.mocked(getSitovPronunciationPretests).mockResolvedValue({ ok: true, data: catalog })
  const element = await PronunciationPage({ params, searchParams: Promise.resolve({ conversation: conversations[0].id, sitov_target: textId }) })
  expect(element.props).toMatchObject({ catalog: { ok: true, data: catalog }, prompts, conversations, learnerId: actor, initialTab: 'mailbox', focusConversation: conversations[0].id, focusTextId: textId })
  expect(getSitovPronunciationPretests).toHaveBeenCalledWith('A1.1')
})

test.each(['denied', 'transport'] as const)('preserves a %s per-text catalog failure without inventing prompts or a foreign conversation', async failure => {
  jest.mocked(getDictionary).mockResolvedValue(de)
  jest.mocked(getPronunciationPrompts).mockResolvedValue([])
  jest.mocked(getPronunciationConversations).mockResolvedValue([])
  if (failure === 'denied') jest.mocked(getSitovPronunciationPretests).mockResolvedValue({ ok: false, error: 'authentication_required', retryable: false })
  else jest.mocked(getSitovPronunciationPretests).mockRejectedValue(new Error('transport'))
  const element = await PronunciationPage({ params, searchParams: Promise.resolve({ conversation: 'sitov-foreign' }) })
  expect(element.props.catalog).toEqual(failure === 'denied' ? { ok: false, error: 'authentication_required', retryable: false } : { ok: false, error: 'retryable_failure', retryable: true })
  expect(element.props.prompts).toEqual([])
  expect(element.props.focusConversation).toBeUndefined()
  expect(element.props.initialTab).toBe('studio')
  expect(getPronunciationConversations).toHaveBeenCalledWith('A1.1')
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
  jest.mocked(getVocabularySession).mockResolvedValue({ learnerId: actor, cards: [], deferredCount: 0, previousCardId: null, learningSourceLanguage: 'tr' })
  const element = await page()
  render(element)
  expect(element.props.learnerId).toBe(actor)
  expect(element.props.learningSourceLanguage).toBe('tr')
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
  const eq = jest.fn().mockReturnValue({ order }), select = jest.fn().mockReturnValue({ eq }), from = jest.fn().mockReturnValue({ select })
  jest.mocked(createClient).mockResolvedValue({ from } as unknown as Awaited<ReturnType<typeof createClient>>)
  render(await VideosPage({ params }))
  expect(order).toHaveBeenCalled()
  expect(from).toHaveBeenCalledWith('learning_videos')
  expect(eq).toHaveBeenCalledWith('unit.level', 'A1.1')
  expect(order).toHaveBeenCalledWith('created_at')
  expect(currentUserHasTrainerAccess).not.toHaveBeenCalled()
  expect(screen.queryByRole('link', { name: 'Sprachangaben prüfen' })).not.toBeInTheDocument()
})
