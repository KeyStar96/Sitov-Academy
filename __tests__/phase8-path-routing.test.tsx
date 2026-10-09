import LearningPathPage from '@/app/[lang]/dashboard/level/[level]/path/page'
import ExercisesPage from '@/app/[lang]/dashboard/level/[level]/exercises/page'
import { getLearningPath } from '@/app/actions/learning-path'
import { requestSession } from '@/lib/request-session'
import { resolveSitovPathRecommendationTopics } from '@/lib/learning/sitov-learning-recommendations-path-server'
import { pathMapSchema, type PathMap } from '@/lib/learning-path-contract'
import { redirect } from 'next/navigation'
import { modeFromPathname, modeHref } from '@/lib/mode-targets'

jest.mock('@/lib/learning-new-server', () => ({ loadLearningNewItems: jest.fn().mockResolvedValue({ items: {}, lessonIds: {} }) }))
jest.mock('@/lib/request-session', () => ({ requestSession: jest.fn() }))
jest.mock('@/lib/learning/sitov-learning-recommendations-path-server', () => ({ resolveSitovPathRecommendationTopics: jest.fn().mockResolvedValue([]) }))
// A tripwire: the canonical page must use its authenticated session directly.
jest.mock('@/app/actions/learning-path', () => ({ getLearningPath: jest.fn(() => { throw new Error('Unexpected legacy action') }) }))
jest.mock('@/components/learning-path/LearningPathClient', () => () => null)
jest.mock('next/navigation', () => ({ redirect: jest.fn(() => { throw new Error('SITOV_REDIRECT') }) }))

const actor = '00000000-0000-4000-8000-000000000001'
const map: PathMap = { level: 'A1.1', completed: false, next_level: null, next_level_available: false,
 paths: [{ id: '00000000-0000-4000-8000-000000000002', source_id: 'sitov-test-path', title: 'Erster Pfad', sort_order: 1, available: true, completed: false,
  nodes: [3, 4].map(n => ({ id: `00000000-0000-4000-8000-00000000000${n}`, kind: 'practice' as const, title: 'Übung', sort_order: n, available: true, status: null, stars: 0, tests: [] })) }] }
function setup({ data = map as unknown, error = null as unknown, signedIn = true, throws = false } = {}) {
 const rpc = jest.fn(async (name: string) => {
  if (name !== 'get_learning_path') throw new Error(`Unexpected fixture RPC: ${name}`)
  if (throws) throw new Error('transport')
  return { data, error }
 })
 const session = { user: signedIn ? { id: actor } : null, supabase: { rpc } }
 jest.mocked(requestSession).mockResolvedValue(session as unknown as Awaited<ReturnType<typeof requestSession>>)
 return { rpc, session }
}
beforeEach(() => jest.clearAllMocks())

test.each(['de', 'en', 'ru', 'uk', 'tr'])('one current authenticated RPC supplies the complete canonical map in %s', async lang => {
 const { rpc, session } = setup()
 expect(pathMapSchema.safeParse(map).success).toBe(true)
 jest.mocked(resolveSitovPathRecommendationTopics).mockResolvedValueOnce(['sitov.test.topic'])
 const element = await LearningPathPage({ params: Promise.resolve({ lang, level: 'A1%2E1' }), searchParams: Promise.resolve({ sitov_target: map.paths[0].nodes[0].id }) })
 expect(requestSession).toHaveBeenCalledTimes(1)
 expect(rpc).toHaveBeenCalledTimes(1)
 expect(rpc).toHaveBeenCalledWith('get_learning_path', { p_level: 'A1.1', p_locale: lang })
 expect(getLearningPath).not.toHaveBeenCalled()
 expect(element.props.initialPath).toEqual(map)
 expect(element.props.initialError).toBeUndefined()
 expect(element.props).toMatchObject({ lang, level: 'A1.1', recommendationAccountKey: actor, recommendationTopicIds: ['sitov.test.topic'], sitovTarget: map.paths[0].nodes[0].id })
 expect(resolveSitovPathRecommendationTopics).toHaveBeenCalledWith(session, element.props.initialPath)
})

test('an authorized level without imported paths keeps the empty state', async () => {
 const empty: PathMap = { level: 'B1.2', paths: [], completed: false, next_level: null, next_level_available: false }
 const { rpc } = setup({ data: empty })
 const element = await LearningPathPage({ params: Promise.resolve({ lang: 'ru', level: 'B1.2' }) })
 expect(element.props.initialPath).toEqual(empty)
 expect(element.props.initialError).toBeUndefined()
 expect(rpc).toHaveBeenCalledTimes(1)
})

test.each([{ data: null }, { data: { paths: [] } }, { data: { ...map, level: 'A2.1' } },
 { error: { message: 'access_denied' } }, { throws: true }])('current RPC failure or malformed/foreign map fails closed: %p', async options => {
 const { rpc, session } = setup(options)
 const element = await LearningPathPage({ params: Promise.resolve({ lang: 'uk', level: 'A1.1' }) })
 expect(element.props.initialError).toBe('request_failed')
 expect(element.props.initialPath).toBeUndefined()
 expect(rpc).toHaveBeenCalledTimes(1)
 expect(getLearningPath).not.toHaveBeenCalled()
 expect(resolveSitovPathRecommendationTopics).toHaveBeenCalledWith(session, undefined)
})

test.each([{ lang: 'de', level: 'A1.1', signedIn: false }, { lang: 'xx', level: 'A1.1' }, { lang: 'de', level: 'C2.1' }])('does not call the canonical RPC without current auth or valid scope: %p', async ({ lang, level, signedIn }) => {
 const { rpc } = setup({ signedIn })
 const element = await LearningPathPage({ params: Promise.resolve({ lang, level }) })
 expect(element.props.initialError).toBe('authentication_required')
 expect(element.props.initialPath).toBeUndefined()
 expect(rpc).not.toHaveBeenCalled()
 expect(getLearningPath).not.toHaveBeenCalled()
})

test('old bookmarks redirect without loading or grading exercises', async () => {
 const { rpc } = setup()
 await expect(ExercisesPage({ params: Promise.resolve({ lang: 'uk', level: 'A1%2E1' }) })).rejects.toThrow('SITOV_REDIRECT')
 expect(redirect).toHaveBeenCalledWith('/uk/dashboard/level/A1.1/path')
 expect(requestSession).not.toHaveBeenCalled()
 expect(rpc).not.toHaveBeenCalled()
 expect(getLearningPath).not.toHaveBeenCalled()
 expect(modeHref('uk', 'A1.1', 'path')).toBe('/uk/dashboard/level/A1.1/path')
 expect(modeFromPathname('/uk/dashboard/level/A1.1/exercises')).toBe('path')
})
