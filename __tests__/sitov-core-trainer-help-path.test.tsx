import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LearningPathClient from '@/components/learning-path/LearningPathClient'
import { startLearningNode, startLearningTest, submitLearningAnswer, saveLearningTestAnswer } from '@/app/actions/learning-path'
import { sitovTrainerHelpCopy } from '@/lib/sitov-trainer-help-copy'
import type { PathMap, PracticeRun, PathTest } from '@/lib/learning-path-contract'
jest.unmock('lucide-react')
jest.unmock('framer-motion')
beforeAll(() => { window.PointerEvent = MouseEvent as typeof PointerEvent })
jest.mock('@/app/actions/learning-path', () => ({ getLearningPath: jest.fn(), startLearningNode: jest.fn(), submitLearningAnswer: jest.fn(), startLearningTest: jest.fn(), saveLearningTestAnswer: jest.fn(), finishLearningTest: jest.fn(), getLearningTestReview: jest.fn() }))
jest.mock('@/components/learning-path/SitovLearningSpecial', () => ({ __esModule: true, default: () => <div data-testid="existing-special">Existing Special</div> }))
const id = '00000000-0000-4000-8000-000000000001'
const node = { id, kind: 'practice' as const, title: 'Abschnitt', sort_order: 1, available: true, status: null, stars: 0, tests: [] }
const map: PathMap = { level: 'A1.1', completed: false, next_level: null, next_level_available: false, paths: [{ id, source_id: 'P1', title: 'Pfad', sort_order: 1, available: true, completed: false, nodes: [node] }] }
const run: PracticeRun = { run_id: id, node_id: id, total: 1, queue: [id], merkkarte: null, exercises: [{ id, type: 'fill_in_blank', content: { text_before: 'Ich', text_after: 'hier.', instruction: 'Ergänzen Sie.' } }] }
beforeEach(() => { jest.clearAllMocks(); jest.mocked(startLearningNode).mockResolvedValue({ data: run }) })
it.each(['de', 'en', 'ru', 'uk', 'tr'])('mounts one closed native Help on the actual %s map, with no learning action', async lang => {
  const copy = sitovTrainerHelpCopy(lang); render(<LearningPathClient initialPath={map} level="A1.1" lang={lang} />)
  const help = screen.getByRole('button', { name: copy.label }); expect(help).toHaveAttribute('aria-expanded', 'false')
  help.focus(); await userEvent.setup().keyboard('{Enter}')
  expect(screen.getByRole('region', { name: copy.label })).toHaveTextContent(copy.pathBody)
  expect(screen.getByRole('heading', { name: copy.pathTitle })).toBeInTheDocument()
  expect(startLearningNode).not.toHaveBeenCalled(); expect(startLearningTest).not.toHaveBeenCalled(); expect(submitLearningAnswer).not.toHaveBeenCalled()
})
it('keeps the same contextual Help in an active/resumed ordinary task and leaves submit visible', async () => {
  render(<LearningPathClient initialPath={{ ...map, paths: [{ ...map.paths[0], nodes: [{ ...node, status: 'in_progress' }] }] }} level="A1.1" lang="en" />)
  fireEvent.click(screen.getByTestId(`path-node-${id}`)); await screen.findByTestId('path-answer')
  expect(screen.getAllByRole('button', { name: 'Help' })).toHaveLength(1)
  expect(screen.getByTestId('path-check')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Help' })); expect(screen.getByRole('region', { name: 'Help' })).toHaveTextContent(sitovTrainerHelpCopy('en').pathBody)
  expect(submitLearningAnswer).not.toHaveBeenCalled()
})
it('includes Help in test state while answers remain server-owned', async () => {
  const test: PathTest = { attempt_id: id, node_id: id, total: 1, exercises: [{ ...run.exercises[0], answer: null }] }
  jest.mocked(startLearningTest).mockResolvedValue({ data: test })
  render(<LearningPathClient initialPath={{ ...map, paths: [{ ...map.paths[0], nodes: [{ ...node, kind: 'test' }] }] }} level="A1.1" lang="en" />)
  fireEvent.click(screen.getByTestId(`path-node-${id}`)); await screen.findByTestId('path-answer')
  expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument(); expect(screen.getByTestId('path-check')).toBeInTheDocument()
  expect(saveLearningTestAnswer).not.toHaveBeenCalled()
})
it('does not add normal-path Help to the existing Special branch', () => {
  render(<LearningPathClient initialPath={{ ...map, paths: [{ ...map.paths[0], nodes: [{ ...node, kind: 'special' }] }] }} level="A1.1" lang="en" />)
  fireEvent.click(screen.getByTestId(`path-node-${id}`)); expect(screen.getByTestId('existing-special')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Help' })).not.toBeInTheDocument(); expect(startLearningNode).not.toHaveBeenCalled()
})
