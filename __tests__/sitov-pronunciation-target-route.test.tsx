import PronunciationDashboard from '@/app/[lang]/dashboard/level/[level]/pronunciation/page'
import { getSitovPronunciationPretests } from '@/app/actions/sitov-pronunciation-pretest'
jest.mock('@/app/actions/pronunciation-conversations', () => ({ getPronunciationConversations: jest.fn().mockResolvedValue([]) }))
jest.mock('@/lib/dictionary', () => ({ getDictionary: jest.fn().mockResolvedValue({ pronunciation: {} }) }))
jest.mock('@/lib/pronunciation-i18n', () => ({ getPronunciationTranslations: () => ({}) }))
jest.mock('@/app/actions/pronunciation', () => ({ getPronunciationPrompts: jest.fn().mockResolvedValue([]) }))
jest.mock('@/components/audio/PronunciationStudio', () => ({ __esModule: true, default: () => null }))
jest.mock('@/lib/learning-new-server', () => ({ loadLearningNewItems: jest.fn().mockResolvedValue({ items: [] }) }))
jest.mock('@/app/actions/learning-checkpoints', () => ({ loadLearningCheckpoint: jest.fn().mockResolvedValue({ ok: true, checkpoint: null }) }))
jest.mock('@/app/actions/sitov-pronunciation-pretest', () => ({ getSitovPronunciationPretests: jest.fn() }))
jest.mock('@/lib/request-session', () => ({ requestSession: jest.fn().mockResolvedValue({ user: { id: 'student' } }) }))
beforeEach(() => { jest.mocked(getSitovPronunciationPretests).mockReset().mockResolvedValue({ ok: true, data: [] }) })
it.each([undefined, '', 'bad', '00000000-0000-4000-8000-000000000001', ['bad', 'other']])('preserves the exact provided route request %p', async raw => {
  const page = await PronunciationDashboard({ params: Promise.resolve({ lang: 'uk', level: 'A1.1' }), searchParams: Promise.resolve({ sitov_target: raw }) })
  expect(page.props.focusTextId).toEqual(raw)
  expect(page.props.lang).toBe('uk')
})
it('carries an honest retryable result when catalog transport throws', async () => {
  jest.mocked(getSitovPronunciationPretests).mockRejectedValue(new Error('transport'))
  const page = await PronunciationDashboard({ params: Promise.resolve({ lang: 'en', level: 'A1.1' }), searchParams: Promise.resolve({ sitov_target: '00000000-0000-4000-8000-000000000001' }) })
  expect(page.props.catalog).toEqual({ ok: false, error: 'retryable_failure', retryable: true })
  expect(page.props.focusTextId).toBe('00000000-0000-4000-8000-000000000001')
})
