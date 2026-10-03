import { act, fireEvent, render, screen } from '@testing-library/react'
import SitovMotionStage from '@/components/motion/SitovMotionStage'

let sitovReduced = false
let sitovPreferenceListeners: (() => void)[] = []
let sitovObservers: Map<Element, (entries: IntersectionObserverEntry[]) => void>

function visibility(element: Element, visible: boolean) {
  act(() => sitovObservers.get(element)?.([{ isIntersecting: visible } as IntersectionObserverEntry]))
}

function pointer(element: Element, type = 'mouse') {
  const event = new Event('pointermove', { bubbles: true })
  Object.assign(event, { pointerType: type, clientX: 25, clientY: 40 })
  fireEvent(element, event)
  act(() => jest.advanceTimersByTime(32))
}

beforeEach(() => {
  jest.useFakeTimers()
  sitovReduced = false
  sitovPreferenceListeners = []
  sitovObservers = new Map()
  jest.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: query.includes('prefers-reduced-motion') ? sitovReduced : true,
    addEventListener: (_type: string, callback: () => void) => { sitovPreferenceListeners.push(callback) },
    removeEventListener: () => {},
  } as unknown as MediaQueryList))
  jest.spyOn(window, 'IntersectionObserver').mockImplementation(callback => ({
    observe: element => sitovObservers.set(element, callback as (entries: IntersectionObserverEntry[]) => void),
    disconnect: () => {},
  } as unknown as IntersectionObserver))
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100 } as DOMRect)
})

afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers() })

it('pauses decoration outside the viewport and when the page is hidden', () => {
  render(<SitovMotionStage data-testid="stage"><button data-sitov-surface="">Card</button></SitovMotionStage>)
  const stage = screen.getByTestId('stage')
  const card = screen.getByRole('button')
  expect(stage).toHaveAttribute('data-sitov-live', 'false')
  visibility(stage, true)
  pointer(card)
  expect(stage).toHaveAttribute('data-sitov-live', 'true')
  expect(card).toHaveAttribute('data-sitov-pointer', 'true')
  visibility(stage, false)
  expect(stage).toHaveAttribute('data-sitov-live', 'false')
  expect(card).toHaveAttribute('data-sitov-pointer', 'false')
  visibility(stage, true)
  pointer(card)
  jest.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  fireEvent(document, new Event('visibilitychange'))
  expect(stage).toHaveAttribute('data-sitov-live', 'false')
  expect(card).toHaveAttribute('data-sitov-pointer', 'false')
})

it('lets a nested scene keep its own lighting when the pointer bubbles to its parent', () => {
  render(<SitovMotionStage data-testid="outer"><SitovMotionStage data-testid="inner"><button data-sitov-surface="">Card</button></SitovMotionStage></SitovMotionStage>)
  visibility(screen.getByTestId('outer'), true)
  visibility(screen.getByTestId('inner'), true)
  const card = screen.getByRole('button')
  pointer(card)
  expect(card).toHaveAttribute('data-sitov-pointer', 'true')
  expect(card.style.getPropertyValue('--sitov-light-x')).toBe('25.0%')
  fireEvent.pointerLeave(screen.getByTestId('inner'))
  expect(card).toHaveAttribute('data-sitov-pointer', 'false')
})

it('stops lighting for reduced motion, touch and disabled controls', () => {
  render(<SitovMotionStage data-testid="stage"><button data-sitov-surface="">Card</button><button disabled data-sitov-surface="">Locked</button></SitovMotionStage>)
  const stage = screen.getByTestId('stage')
  const card = screen.getByRole('button', { name: 'Card' })
  visibility(stage, true)
  pointer(card)
  pointer(card, 'touch')
  expect(card).toHaveAttribute('data-sitov-pointer', 'false')
  pointer(screen.getByRole('button', { name: 'Locked' }))
  expect(screen.getByRole('button', { name: 'Locked' })).not.toHaveAttribute('data-sitov-pointer', 'true')
  pointer(card)
  act(() => { sitovReduced = true; sitovPreferenceListeners.forEach(listener => listener()) })
  expect(stage).toHaveAttribute('data-sitov-live', 'false')
  expect(card).toHaveAttribute('data-sitov-pointer', 'false')
})
