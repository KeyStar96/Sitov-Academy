import LearningPathPage from '@/app/[lang]/dashboard/level/[level]/path/page'
import ExercisesPage from '@/app/[lang]/dashboard/level/[level]/exercises/page'
import { getLearningPath } from '@/app/actions/learning-path'
import { redirect } from 'next/navigation'
import { modeFromPathname, modeHref } from '@/lib/mode-targets'

jest.mock('@/app/actions/learning-path', () => ({ getLearningPath: jest.fn() }))
jest.mock('@/components/learning-path/LearningPathClient', () => () => null)
jest.mock('@/components/dashboard/TrainerLanguageRequired', () => () => null)
jest.mock('@/app/actions/exercises', () => ({ getExercises: jest.fn() }))
jest.mock('@/components/exercises/ExerciseClient', () => () => null)
jest.mock('@/lib/dictionary', () => ({ getDictionary: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: jest.fn() }))

beforeEach(() => jest.clearAllMocks())

test('one path RPC supplies the complete map on the canonical route', async () => {
  const map = { paths: [{ id: 'path-one', nodes: [{ id: 'node-one' }, { id: 'node-two' }] }] }
  ;(getLearningPath as jest.Mock).mockResolvedValue({ data: map })
  const element = await LearningPathPage({ params: Promise.resolve({ lang: 'en', level: 'A1.1' }) })
  expect(getLearningPath).toHaveBeenCalledTimes(1)
  expect(getLearningPath).toHaveBeenCalledWith('A1.1', 'en')
  expect(element.props.initialPath).toBe(map)
})

test('old bookmarks redirect without loading or grading exercises', async () => {
  await ExercisesPage({ params: Promise.resolve({ lang: 'uk', level: 'A1.1' }) })
  expect(redirect).toHaveBeenCalledWith('/uk/dashboard/level/A1.1/path')
  expect(getLearningPath).not.toHaveBeenCalled()
  expect(modeHref('uk', 'A1.1', 'path')).toBe('/uk/dashboard/level/A1.1/path')
  expect(modeFromPathname('/uk/dashboard/level/A1.1/exercises')).toBe('path')
})
