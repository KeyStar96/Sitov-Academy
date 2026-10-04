import { fireEvent, render, screen } from '@testing-library/react'
import LearningScreen, { scrollLearningWorkspace } from '@/components/vocabulary/LearningScreen'
jest.unmock('lucide-react')

it('keeps the shared navigation interactive and document scrolling available during practice', () => {
  const navigate = jest.fn()
  const exit = jest.fn()
  document.body.style.overflow = ''
  render(<><header><button onClick={navigate}>Learning path</button></header>
    <LearningScreen title="Practice" progress={25} onExit={exit} t={() => 'Back'}><button>Check answer</button></LearningScreen>
  </>)
  expect(document.body.style.overflow).toBe('')
  expect(screen.getByRole('button', { name: 'Learning path' }).closest('[inert]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Learning path' }))
  expect(navigate).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(exit).toHaveBeenCalledTimes(1)
})

it('returns document-flow tasks to their frame instead of a non-scrolling workspace', () => {
  const frame = document.createElement('section')
  frame.className = 'learning-screen'
  frame.dataset.presentation = 'embedded'
  const workspace = document.createElement('div')
  frame.append(workspace)
  frame.scrollIntoView = jest.fn()
  workspace.scrollTo = jest.fn()
  scrollLearningWorkspace(workspace)
  expect(frame.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
  expect(workspace.scrollTo).not.toHaveBeenCalled()
  frame.dataset.presentation = 'fullscreen'
  scrollLearningWorkspace(workspace)
  expect(workspace.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
})

describe('stable embedded vocabulary frame', () => {
  const scrollIntoView = jest.fn()
  const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')

  beforeEach(() => {
    scrollIntoView.mockClear()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
    jest.replaceProperty(window, 'innerHeight', 844)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll)
    else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
  })

  function bounds(top: number, bottom: number): DOMRect {
    return { x: 0, y: top, left: 0, right: 390, top, bottom, width: 390, height: bottom - top, toJSON: () => ({}) }
  }

  function mountFrame(top: number, bottom: number, stable = true, navStyle?: React.CSSProperties) {
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      return this.classList.contains('st-tabbar') ? bounds(760, 844) : bounds(top, bottom)
    })
    return render(<>
      <nav className="st-tabbar" style={navStyle} aria-label="Main navigation"><button>Home</button></nav>
      <LearningScreen title="Practice" progress={25} onExit={() => undefined} t={() => 'Back'} {...(stable ? { sitovStableFrame: true } : {})}>
        <button>Reveal answer</button>
      </LearningScreen>
    </>)
  }

  it('focuses an already visible frame without moving it or covering the bottom navigation', () => {
    mountFrame(240, 740)
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Practice')).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Home' }).closest('[inert]')).toBeNull()
  })

  it.each([
    ['beneath the viewport', 900, 1400],
    ['behind the visible bottom navigation', 240, 800],
    ['above the viewport', -20, 700],
  ] as const)('brings a frame %s back into view', (_position, top, bottom) => {
    mountFrame(top, bottom)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
  })

  it.each([{ visibility: 'hidden' }, { display: 'none' }] as const)('uses the full viewport when the navigation is hidden with %o', navStyle => {
    mountFrame(240, 800, true, navStyle)
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Practice')).toHaveFocus()
  })

  it('preserves the existing scroll-on-mount behavior when stable framing is not enabled', () => {
    mountFrame(240, 740, false)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
  })
})
