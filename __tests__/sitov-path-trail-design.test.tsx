import { fireEvent, render, screen, within } from '@testing-library/react'
import PathTrail from '@/components/learning-path/PathTrail'
import type { PathMap, PathNode } from '@/lib/learning-path-contract'
import { pathTranslator } from '@/lib/learning-path-i18n'

jest.unmock('lucide-react')

const sitovId = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`
const sitovNode = (value: number, patch: Partial<PathNode> = {}): PathNode => ({
  id: sitovId(value), title: `Station ${value}`, kind: 'practice', sort_order: value,
  available: true, status: null, stars: 0, tests: [], ...patch,
})
const sitovMap = (nodes: PathNode[], patch: Partial<PathMap> = {}): PathMap => ({
  level: 'A1.1', completed: false, next_level: 'A1.2', next_level_available: false,
  paths: [{ id: sitovId(100), source_id: 'sitov-design-fixture', title: 'First path', sort_order: 1,
    available: true, completed: false, nodes }], ...patch,
})
function sitovRender(map: PathMap, { lang = 'en', busy = false } = {}) {
  const onOpen = jest.fn()
  render(<PathTrail map={map} lang={lang} busy={busy} onOpen={onOpen}
    isNewPath={() => false} isNewBranch={() => false} newLabel="New" />)
  return { onOpen }
}
const sitovButton = (value: number) => screen.getByTestId(`path-node-${sitovId(value)}`)

it.each(['de', 'en', 'ru', 'uk', 'tr'])('visibly explains the passing threshold separately from the last result in %s', lang => {
  const t = pathTranslator(lang)
  sitovRender(sitovMap([
    sitovNode(1, { status: 'completed', stars: 3 }),
    sitovNode(2, { status: 'in_progress' }),
    sitovNode(3, { kind: 'review', available: false }),
    sitovNode(4, { kind: 'test', tests: [{ id: sitovId(200), status: 'completed', percentage: 60, passed: false }] }),
  ], { resume_node_id: sitovId(2) }), { lang })

  const test = sitovButton(4)
  const goal = within(test).getByText(t('sitov_test_goal'))
  expect(goal).toBeVisible()
  expect(goal.closest('.sr-only')).toBeNull()
  const last = within(test).getByText(t('sitov_test_last', { value: 60 }))
  expect(last).toBeVisible()
  expect(last.closest('.sr-only')).toBeNull()
  expect(goal).not.toBe(last)
  expect(test).toHaveTextContent(t('sitov_test_available'))

  expect(sitovButton(1)).toHaveAttribute('data-state', 'completed')
  expect(sitovButton(1)).toHaveTextContent(t('completed'))
  expect(sitovButton(2)).toHaveAttribute('aria-current', 'step')
  expect(sitovButton(2)).toHaveTextContent(t('sitov_stage_continue'))
  expect(sitovButton(3)).toBeDisabled()
  expect(sitovButton(3)).toHaveTextContent(t('sitov_stage_locked'))
})

it('keeps an unattempted test available in a locked path without implying a score', () => {
  const test = sitovNode(2, { kind: 'test' })
  const base = sitovMap([sitovNode(1, { available: false }), test])
  const map = { ...base, paths: [{ ...base.paths[0], available: false }] }
  const { onOpen } = sitovRender(map)
  expect(sitovButton(1)).toBeDisabled()
  expect(sitovButton(2)).toBeEnabled()
  expect(sitovButton(2)).toHaveTextContent(pathTranslator('en')('sitov_test_goal'))
  expect(sitovButton(2)).not.toHaveTextContent(/Last attempt|Passed/)
  fireEvent.click(sitovButton(2))
  expect(onOpen).toHaveBeenCalledWith(test, map.paths[0])
})

it('keeps the threshold visible after a pass and labels the actual saved score', () => {
  const t = pathTranslator('en')
  sitovRender(sitovMap([sitovNode(1, { kind: 'test', status: 'completed', tests: [
    { id: sitovId(200), status: 'completed', percentage: 86.67, passed: true },
  ] })]))
  const test = sitovButton(1)
  expect(within(test).getByText(t('sitov_test_goal'))).toBeVisible()
  expect(test).toHaveTextContent(t('sitov_test_passed', { value: 86 }))
  expect(test).not.toHaveTextContent(/100\s*%/)
})

it('does not invent a perfect result for a completed test without a saved percentage', () => {
  sitovRender(sitovMap([sitovNode(1, { kind: 'test', status: 'completed' })]))
  expect(sitovButton(1)).toHaveTextContent(pathTranslator('en')('passed'))
  expect(sitovButton(1)).toHaveTextContent(pathTranslator('en')('sitov_test_goal'))
  expect(sitovButton(1)).not.toHaveTextContent(/100\s*%/)
})

it('shows continuation for an active test without presenting a pending attempt as a result', () => {
  const t = pathTranslator('en')
  sitovRender(sitovMap([sitovNode(1, { kind: 'test', tests: [
    { id: sitovId(201), status: 'active', percentage: null, passed: null },
  ] })], { resume_node_id: sitovId(1) }))
  expect(sitovButton(1)).toHaveAttribute('aria-current', 'step')
  expect(sitovButton(1)).toHaveTextContent(t('sitov_test_resume'))
  expect(sitovButton(1)).toHaveTextContent(t('sitov_test_goal'))
  expect(sitovButton(1)).not.toHaveTextContent(/Last attempt|Passed/)
})

it('retains the result choice for an active test that also has a completed attempt', () => {
  const t = pathTranslator('en')
  sitovRender(sitovMap([sitovNode(1, { kind: 'test', tests: [
    { id: sitovId(201), status: 'active', percentage: null, passed: null },
    { id: sitovId(200), status: 'completed', percentage: 60, passed: false },
  ] })], { resume_node_id: sitovId(1) }))
  expect(sitovButton(1)).toHaveAttribute('aria-current', 'step')
  expect(sitovButton(1)).toHaveTextContent(t('review_open'))
  expect(sitovButton(1)).toHaveTextContent(t('sitov_test_last', { value: 60 }))
  expect(sitovButton(1)).toHaveTextContent(t('sitov_test_goal'))
})

it('passes the unchanged server node and path to the open callback', () => {
  const map = sitovMap([sitovNode(1), sitovNode(2, { available: false })])
  const before = JSON.stringify(map)
  const { onOpen } = sitovRender(map)
  fireEvent.click(sitovButton(1))
  fireEvent.click(sitovButton(2))
  expect(onOpen).toHaveBeenCalledTimes(1)
  expect(onOpen).toHaveBeenCalledWith(map.paths[0].nodes[0], map.paths[0])
  expect(JSON.stringify(map)).toBe(before)
})

it('prevents opening lessons and tests while a request is pending', () => {
  const { onOpen } = sitovRender(sitovMap([sitovNode(1), sitovNode(2, { kind: 'test' })]), { busy: true })
  for (const value of [1, 2]) {
    expect(sitovButton(value)).toBeDisabled()
    expect(sitovButton(value)).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(sitovButton(value))
  }
  expect(onOpen).not.toHaveBeenCalled()
})
