import { fireEvent, render, screen, within } from '@testing-library/react'
import PathTrail, { currentNodeId } from '@/components/learning-path/PathTrail'
import { pathTranslator } from '@/lib/learning-path-i18n'
import { sitovTrainerHeroCopy } from '@/lib/sitov-trainer-hero-i18n'
import type { PathMap, PathNode } from '@/lib/learning-path-contract'

jest.unmock('lucide-react')

const sitovId = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`
const sitovNode = (value: number, patch: Partial<PathNode> = {}): PathNode => ({
  id: sitovId(value), kind: 'practice', title: `Lesson ${value}`, sort_order: value,
  available: true, status: null, stars: 0, tests: [], ...patch,
})
const sitovMap = (nodes: PathNode[], patch: Partial<PathMap> = {}): PathMap => ({
  level: 'A1.1', completed: false, next_level: 'A1.2', next_level_available: false,
  paths: [{ id: sitovId(100), source_id: 'P1', title: 'First path', sort_order: 1,
    available: true, completed: false, nodes }], ...patch,
})
function sitovRender(map: PathMap, { busy = false, lang = 'en' } = {}) {
  const onOpen = jest.fn()
  const result = render(<PathTrail map={map} lang={lang} busy={busy} onOpen={onOpen}
    isNewPath={() => false} isNewBranch={() => false} newLabel="New" />)
  return { ...result, onOpen, hero: screen.getByTestId('path-level-progress') }
}

it('starts exactly the same available current station as the trail without changing the server map', () => {
  const map = sitovMap([
    sitovNode(1, { status: 'completed', stars: 3 }),
    sitovNode(2, { kind: 'special' }),
    sitovNode(3, { available: false }),
    sitovNode(4),
  ])
  const before = JSON.stringify(map)
  const { hero, onOpen } = sitovRender(map)
  const target = screen.getByTestId(`path-node-${currentNodeId(map)}`)
  expect(target).toHaveAttribute('aria-current', 'step')
  expect(hero).toHaveAttribute('data-sitov-trainer-hero', 'path')
  expect(hero).toHaveTextContent('Sitov Academy')
  expect(hero).toHaveTextContent('A1.1')
  fireEvent.click(within(hero).getByRole('button', { name: sitovTrainerHeroCopy('en').pathAction }))
  fireEvent.click(target)
  expect(onOpen).toHaveBeenCalledTimes(2)
  expect(onOpen.mock.calls[0]).toEqual(onOpen.mock.calls[1])
  expect(onOpen.mock.calls[0]).toEqual([map.paths[0].nodes[3], map.paths[0]])
  expect(JSON.stringify(map)).toBe(before)
})

it('continues the current active lesson through the existing open callback', () => {
  const node = sitovNode(1, { status: 'in_progress' })
  const map = sitovMap([node])
  const { hero, onOpen } = sitovRender(map)
  fireEvent.click(within(hero).getByRole('button', { name: sitovTrainerHeroCopy('en').pathAction }))
  expect(onOpen).toHaveBeenCalledWith(node, map.paths[0])
})

it('prioritizes the actual server checkpoint over an earlier unstarted station', () => {
  const pending = sitovNode(2, { status: 'in_progress' })
  const map = sitovMap([sitovNode(1), pending], { resume_node_id: pending.id })
  const { hero, onOpen } = sitovRender(map)
  expect(currentNodeId(map)).toBe(pending.id)
  expect(screen.getByTestId(`path-node-${pending.id}`)).toHaveAttribute('aria-current', 'step')
  fireEvent.click(within(hero).getByRole('button'))
  expect(onOpen).toHaveBeenCalledWith(pending, map.paths[0])
})

it.each(['missing', 'locked'])('ignores a %s checkpoint and keeps the next available station', scenario => {
  const map = sitovMap([sitovNode(1), sitovNode(2, { available: false })], {
    resume_node_id: sitovId(scenario === 'missing' ? 99 : 2),
  })
  const { hero, onOpen } = sitovRender(map)
  fireEvent.click(within(hero).getByRole('button'))
  expect(currentNodeId(map)).toBe(sitovId(1))
  expect(onOpen).toHaveBeenCalledWith(map.paths[0].nodes[0], map.paths[0])
})

it.each([false, true])('keeps a real extra checkpoint resumable even with completed level %s', completed => {
  const extra = sitovNode(2, { kind: 'special', status: 'in_progress' })
  const map = sitovMap([sitovNode(1, { status: 'completed' }), extra], { completed, resume_node_id: extra.id })
  const { hero, onOpen } = sitovRender(map)
  fireEvent.click(within(hero).getByRole('button'))
  expect(currentNodeId(map)).toBe(extra.id)
  expect(onOpen).toHaveBeenCalledWith(extra, map.paths[0])
  expect(hero.querySelector('[data-state="current"]')).toBeInTheDocument()
})

it('uses the explicit continuation callback only for the hero and keeps ordinary trail opening', () => {
  const map = sitovMap([sitovNode(1)])
  const onOpen = jest.fn(), onContinue = jest.fn()
  render(<PathTrail map={map} lang="en" busy={false} onOpen={onOpen} onContinue={onContinue}
    isNewPath={() => false} isNewBranch={() => false} newLabel="New" />)
  fireEvent.click(within(screen.getByTestId('path-level-progress')).getByRole('button'))
  expect(onContinue).toHaveBeenCalledWith(map.paths[0].nodes[0], map.paths[0])
  expect(onOpen).not.toHaveBeenCalled()
  fireEvent.click(screen.getByTestId(`path-node-${sitovId(1)}`))
  expect(onOpen).toHaveBeenCalledWith(map.paths[0].nodes[0], map.paths[0])
})

it.each([false, true])('opens an available test in a locked path and honours its active attempt (%s)', active => {
  const test = sitovNode(3, { kind: 'test', tests: active
    ? [{ id: sitovId(200), status: 'active', percentage: null, passed: null }] : [] })
  const base = sitovMap([sitovNode(1, { available: false }), sitovNode(2, { kind: 'review', available: false }), test])
  const map = { ...base, paths: [{ ...base.paths[0], available: false }] }
  const { hero, onOpen } = sitovRender(map)
  const target = screen.getByTestId(`path-node-${test.id}`)
  expect(target).toHaveAttribute('aria-current', 'step')
  expect(screen.getByTestId(`path-node-${sitovId(1)}`)).toBeDisabled()
  fireEvent.click(within(hero).getByRole('button', { name: sitovTrainerHeroCopy('en').pathAction }))
  expect(onOpen).toHaveBeenCalledWith(test, map.paths[0])
})

it('disables the actual hero button and the trail while a request is pending', () => {
  const map = sitovMap([sitovNode(1)])
  const { hero, onOpen } = sitovRender(map, { busy: true })
  const action = within(hero).getByRole('button')
  expect(action).toBeDisabled()
  expect(action).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByTestId(`path-node-${sitovId(1)}`)).toBeDisabled()
  fireEvent.click(action)
  expect(onOpen).not.toHaveBeenCalled()
})

it.each([
  ['only locked stations', sitovMap([sitovNode(1, { available: false })])],
  ['only optional extras', sitovMap([sitovNode(1, { kind: 'special' })])],
  ['all stations completed', sitovMap([sitovNode(1, { status: 'completed' })], { completed: true })],
  ['level passed by tests before every practice is completed', sitovMap([sitovNode(1)], { completed: true })],
  ['no stations', sitovMap([])],
] as const)('offers no misleading start with %s', (_scenario, map) => {
  const { hero, onOpen } = sitovRender(map)
  expect(within(hero).queryByRole('button')).not.toBeInTheDocument()
  expect(onOpen).not.toHaveBeenCalled()
})

it('shows actual lesson progress once and exposes the same numbers accessibly', () => {
  const map = sitovMap([
    sitovNode(1, { status: 'completed' }), sitovNode(2, { kind: 'review' }),
    sitovNode(3, { kind: 'test', status: 'completed' }), sitovNode(4, { kind: 'special', status: 'completed' }),
  ])
  const label = pathTranslator('en')('level_progress', { done: 1, total: 2 })
  const { hero } = sitovRender(map)
  expect(within(hero).getAllByText(label)).toHaveLength(1)
  const progress = within(hero).getByRole('progressbar', { name: label })
  expect(progress).toHaveAttribute('aria-valuenow', '1')
  expect(progress).toHaveAttribute('aria-valuemax', '2')
})

it.each(['de', 'en', 'ru', 'uk', 'tr'])('follows the %s interface language', lang => {
  const { hero } = sitovRender(sitovMap([sitovNode(1)]), { lang })
  const t = pathTranslator(lang)
  expect(within(hero).getByRole('heading', { name: t('title') })).toBeInTheDocument()
  expect(within(hero).getByRole('button', { name: sitovTrainerHeroCopy(lang).pathAction })).toBeEnabled()
  expect(within(hero).getByRole('progressbar', { name: t('level_progress', { done: 0, total: 1 }) })).toBeInTheDocument()
})
