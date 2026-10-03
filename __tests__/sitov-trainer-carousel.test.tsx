import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SitovTrainerCarousel, { type SitovTrainerSlide } from '@/components/dashboard/SitovTrainerCarousel'
import { LEARNING_MODES, modeHref, type LearningMode } from '@/lib/mode-targets'

// Real motion values keep gesture/snap behavior observable; the user's motion
// preference makes every selected state immediate rather than mocking Framer.
jest.unmock('framer-motion')
jest.unmock('lucide-react')

const sitovLabels: Record<LearningMode, string> = {
  vocabulary: 'Vocabulary', verbs: 'Verb trainer', path: 'Learning path',
  pronunciation: 'Pronunciation', media: 'Media library',
}
const sitovOriginalMatchMedia = window.matchMedia

beforeEach(() => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion'), media: query, onchange: null,
    addEventListener: jest.fn(), removeEventListener: jest.fn(), addListener: jest.fn(),
    removeListener: jest.fn(), dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia
})

afterEach(() => { jest.useRealTimers() })
afterAll(() => { window.matchMedia = sitovOriginalMatchMedia })

function sitovRender(locked: LearningMode[] = []) {
  const navigate = jest.fn()
  const items: SitovTrainerSlide[] = LEARNING_MODES.map(id => ({
    id, label: sitovLabels[id], locked: locked.includes(id),
    card: locked.includes(id)
      ? <div aria-disabled="true">{sitovLabels[id]} — Locked</div>
      : <a href={modeHref('en', 'A1.1', id)} onClick={event => { event.preventDefault(); navigate(id) }}>{sitovLabels[id]}</a>,
  }))
  render(<SitovTrainerCarousel items={items} lang="en" label="Your learning areas" />)
  const region = screen.getByRole('region', { name: 'Your learning areas' })
  // Pointer and wheel gestures belong to the scene that contains the cards.
  const scene = region.querySelector('ul')!.parentElement!
  return { region, scene, navigate }
}

function sitovChoose(mode: LearningMode) {
  fireEvent.click(screen.getByRole('button', { name: `Show ${sitovLabels[mode]}` }))
}

function sitovExpectFront(mode: LearningMode) {
  expect(screen.getByRole('status')).toHaveTextContent(`${sitovLabels[mode]}, ${LEARNING_MODES.indexOf(mode) + 1} of 5`)
  expect(screen.getByRole('button', { name: `Show ${sitovLabels[mode]}` })).toHaveAttribute('aria-pressed', 'true')
}

function sitovPointer(target: HTMLElement, type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  fields: Partial<Pick<PointerEvent, 'clientX' | 'clientY' | 'pointerId' | 'button' | 'isPrimary'>> = {}) {
  // JSDOM may lack PointerEvent; explicit native fields still exercise React's
  // pointer handlers with the same values a browser supplies.
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, Object.fromEntries(Object.entries({
    pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: 200, clientY: 30, ...fields,
  }).map(([name, value]) => [name, { value, configurable: true }])))
  fireEvent(target, event)
  return event
}

function sitovWheel(target: HTMLElement, deltaX: number, deltaY = 0, shiftKey = false) {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX, deltaY, shiftKey })
  fireEvent(target, event)
  return event
}

describe('Sitov Academy trainer carousel navigation', () => {
  it('exposes only the front card as a reachable link while keeping all five choices available', async () => {
    const { region } = sitovRender()
    const front = screen.getByRole('link', { name: 'Vocabulary' })
    expect(screen.getAllByRole('link')).toEqual([front])
    expect(screen.getAllByRole('link', { hidden: true }).map(link => link.tabIndex)).toEqual([0, -1, -1, -1, -1])
    expect(within(screen.getByRole('group', { name: 'Choose a trainer' })).getAllByRole('button')).toHaveLength(5)
    expect(region).toHaveAttribute('aria-roledescription', 'Carousel')
    const user = userEvent.setup()
    await user.tab()
    expect(front).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Previous trainer' })).toHaveFocus()
  })

  it('wraps both arrows and selects a trainer through its named choice without navigation', () => {
    const { navigate } = sitovRender()
    fireEvent.click(screen.getByRole('button', { name: 'Previous trainer' }))
    sitovExpectFront('media')
    fireEvent.click(screen.getByRole('button', { name: 'Next trainer' }))
    sitovExpectFront('vocabulary')
    fireEvent.click(screen.getByRole('button', { name: 'Next trainer' }))
    sitovExpectFront('verbs')
    sitovChoose('path')
    sitovExpectFront('path')
    expect(screen.getByRole('link', { name: 'Learning path' })).toHaveAttribute('href', '/en/dashboard/level/A1.1/path')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('brings a rear card forward on the first click and activates its link only on a later click', () => {
    const { navigate } = sitovRender()
    const rear = screen.getByText('Verb trainer').closest('a')!
    fireEvent.click(rear, { detail: 1 })
    sitovExpectFront('verbs')
    expect(navigate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('link', { name: 'Verb trainer' }), { detail: 1 })
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('verbs')
  })

  it('moves keyboard focus with arrows, Home and End to the selected front link', async () => {
    sitovRender()
    const user = userEvent.setup()
    screen.getByRole('link', { name: 'Vocabulary' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('link', { name: 'Verb trainer' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('link', { name: 'Media library' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('link', { name: 'Vocabulary' })).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('link', { name: 'Media library' })).toHaveFocus()
  })

  it('moves focus to the selected choice when the next trainer is locked, without exposing a link', async () => {
    const { navigate } = sitovRender(['verbs'])
    const user = userEvent.setup()
    screen.getByRole('link', { name: 'Vocabulary' }).focus()
    await user.keyboard('{ArrowRight}')
    sitovExpectFront('verbs')
    expect(screen.getByRole('button', { name: 'Show Verb trainer' })).toHaveFocus()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Verb trainer — Locked')).toHaveAttribute('aria-disabled', 'true')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('starts with the first unlocked trainer rather than an inaccessible first card', () => {
    sitovRender(['vocabulary', 'verbs'])
    sitovExpectFront('path')
    expect(screen.getByRole('link', { name: 'Learning path' })).toHaveAttribute('tabindex', '0')
  })

  it('keeps selection controls usable when all five trainers are locked', () => {
    const { navigate } = sitovRender([...LEARNING_MODES])
    expect(screen.queryByRole('link', { hidden: true })).toBeNull()
    sitovChoose('media')
    sitovExpectFront('media')
    expect(screen.getByText('Media library — Locked')).toHaveAttribute('aria-disabled', 'true')
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('Sitov Academy trainer carousel gestures', () => {
  it('selects by swipe, suppresses the resulting pointer click and allows a later deliberate tap', () => {
    const { scene, navigate } = sitovRender()
    sitovPointer(screen.getByRole('link'), 'pointerdown')
    const move = sitovPointer(scene, 'pointermove', { clientX: 120 })
    expect(move.defaultPrevented).toBe(true)
    sitovPointer(scene, 'pointerup', { clientX: 120 })
    sitovExpectFront('verbs')
    const front = screen.getByRole('link', { name: 'Verb trainer' })
    fireEvent.click(front, { detail: 1 })
    expect(navigate).not.toHaveBeenCalled()
    sitovPointer(front, 'pointerdown', { clientX: 120 })
    sitovPointer(front, 'pointerup', { clientX: 120 })
    fireEvent.click(front, { detail: 1 })
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('verbs')
  })

  it('does not block a keyboard activation after a cancelled swipe produced no pointer click', async () => {
    const { scene, navigate } = sitovRender()
    const front = screen.getByRole('link', { name: 'Vocabulary' })
    sitovPointer(front, 'pointerdown')
    sitovPointer(scene, 'pointermove', { clientX: 120 })
    sitovPointer(scene, 'pointercancel', { clientX: 120 })
    sitovExpectFront('vocabulary')
    front.focus()
    await userEvent.setup().keyboard('{Enter}')
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('vocabulary')
  })

  it('lets a vertical touch gesture scroll without selecting or activating another trainer', () => {
    const { scene, navigate } = sitovRender()
    sitovPointer(screen.getByRole('link'), 'pointerdown')
    const move = sitovPointer(scene, 'pointermove', { clientX: 185, clientY: 100 })
    expect(move.defaultPrevented).toBe(false)
    sitovPointer(scene, 'pointercancel', { clientX: 185, clientY: 100 })
    sitovExpectFront('vocabulary')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('preserves ordinary vertical wheel scrolling, including a small incidental horizontal delta', () => {
    jest.useFakeTimers()
    const { scene } = sitovRender()
    expect(sitovWheel(scene, 0, 160).defaultPrevented).toBe(false)
    expect(sitovWheel(scene, 20, 160).defaultPrevented).toBe(false)
    act(() => { jest.advanceTimersByTime(200) })
    sitovExpectFront('vocabulary')
  })

  it('debounces horizontal wheel movement into one selected trainer and never activates its link', () => {
    jest.useFakeTimers()
    const { scene, navigate } = sitovRender()
    expect(sitovWheel(scene, 110).defaultPrevented).toBe(true)
    act(() => { jest.advanceTimersByTime(100) })
    sitovExpectFront('vocabulary')
    sitovWheel(scene, 110)
    act(() => { jest.advanceTimersByTime(149) })
    sitovExpectFront('vocabulary')
    act(() => { jest.advanceTimersByTime(1) })
    sitovExpectFront('verbs')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('supports Shift plus mouse wheel as a horizontal trainer gesture', () => {
    jest.useFakeTimers()
    const { scene } = sitovRender()
    expect(sitovWheel(scene, 0, 210, true).defaultPrevented).toBe(true)
    act(() => { jest.advanceTimersByTime(150) })
    sitovExpectFront('verbs')
  })

  it.each(['choice', 'pointer'] as const)('discards partial reduced-motion wheel movement when interrupted by %s', interruption => {
    jest.useFakeTimers()
    const { scene, navigate } = sitovRender()
    sitovWheel(scene, 100)
    act(() => { jest.advanceTimersByTime(70) })
    if (interruption === 'choice') sitovChoose('media')
    else {
      sitovPointer(scene, 'pointerdown')
      sitovPointer(scene, 'pointerup')
    }
    const current: LearningMode = interruption === 'choice' ? 'media' : 'vocabulary'
    sitovWheel(scene, 100)
    act(() => { jest.advanceTimersByTime(150) })
    sitovExpectFront(current)
    sitovWheel(scene, 140)
    act(() => { jest.advanceTimersByTime(150) })
    sitovExpectFront(interruption === 'choice' ? 'vocabulary' : 'verbs')
    expect(navigate).not.toHaveBeenCalled()
  })
})
