import { useInsertionEffect } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import NavigationProgress from '@/components/effects/NavigationProgress'

let originalPushState: typeof history.pushState
let originalReplaceState: typeof history.replaceState
beforeEach(() => {
  jest.useFakeTimers()
  originalPushState = history.pushState
  originalReplaceState = history.replaceState
  history.replaceState(null, '', '/')
})
afterEach(() => {
  cleanup()
  history.pushState = originalPushState
  history.replaceState = originalReplaceState
  history.replaceState(null, '', '/')
  jest.useRealTimers()
  jest.restoreAllMocks()
})
function LinkFixture() {
  // Exercise the global click listener without Next.js adding its own navigation.
  // eslint-disable-next-line @next/next/no-html-link-for-pages
  return <><NavigationProgress /><a href="/courses" onClick={event => event.preventDefault()}>Courses</a></>
}

it.each(['pushState', 'replaceState'] as const)('defers progress completion when history.%s is patched', method => {
  render(<LinkFixture />)
  fireEvent.click(screen.getByRole('link', { name: 'Courses' }))
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  act(() => { history[method]({ navigation: true }, '', '/courses') })
  expect(window.location.pathname).toBe('/courses')
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  act(() => { jest.advanceTimersByTime(0) })
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  act(() => { jest.advanceTimersByTime(300) })
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})

it('does not schedule React updates from a Next-style history write in an insertion effect', () => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
  function CommitNavigation({ revision }: { revision: number }) {
    useInsertionEffect(() => { history.replaceState({ revision }, '', `/courses?revision=${revision}`) }, [revision])
    return null
  }
  const view = render(<><NavigationProgress /><CommitNavigation revision={0} /></>)
  view.rerender(<><NavigationProgress /><CommitNavigation revision={1} /></>)
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  expect(errors.mock.calls.flat().join(' ')).not.toContain('useInsertionEffect must not schedule updates')
  act(() => { jest.advanceTimersByTime(0) })
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
})

it('coalesces repeated completion signals and clears callbacks/history patches on unmount', () => {
  const view = render(<LinkFixture />)
  fireEvent.click(screen.getByRole('link', { name: 'Courses' }))
  act(() => {
    history.pushState(null, '', '/first')
    history.replaceState(null, '', '/second')
  })
  expect(jest.getTimerCount()).toBe(2) // One progress interval and one deferred completion.
  view.unmount()
  expect(history.pushState).toBe(originalPushState)
  expect(history.replaceState).toBe(originalReplaceState)
  expect(jest.getTimerCount()).toBe(0)
  act(() => { jest.runAllTimers() })
})

it('does not clobber a later history wrapper or let its retained inactive patch schedule updates', () => {
  const view = render(<NavigationProgress />)
  const patched = history.replaceState
  const laterWrapper: typeof history.replaceState = function (...args) { patched.apply(this, args) }
  history.replaceState = laterWrapper
  view.unmount()
  expect(history.replaceState).toBe(laterWrapper)
  history.replaceState(null, '', '/after-unmount')
  expect(jest.getTimerCount()).toBe(0)
})

it('keeps only the latest hide timer when multiple completions arrive', () => {
  render(<LinkFixture />)
  fireEvent.click(screen.getByRole('link', { name: 'Courses' }))
  act(() => { history.replaceState(null, '', '/courses'); jest.advanceTimersByTime(0) })
  act(() => { jest.advanceTimersByTime(100); history.replaceState(null, '', '/courses?refresh=1'); jest.advanceTimersByTime(0) })
  expect(jest.getTimerCount()).toBe(1)
  act(() => { jest.advanceTimersByTime(200) })
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  act(() => { jest.advanceTimersByTime(100) })
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})

it('ignores certificate download links because a file download has no history completion', () => {
  render(<><NavigationProgress /><a href="/api/certificates/00000000-0000-4000-8000-000000000001" download="" onClick={event => event.preventDefault()}>Download certificate</a></>)
  fireEvent.click(screen.getByRole('link', { name: 'Download certificate' }))
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  expect(jest.getTimerCount()).toBe(0)
})
