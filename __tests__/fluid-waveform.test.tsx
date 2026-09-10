import React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import FluidWaveform from '@/components/audio/FluidWaveform'

type Point = readonly [number, number]
interface RecordedFill { points: Point[]; alpha: number; shadowBlur: number; rule: CanvasFillRule | undefined }

let reducedMotion = false
let path: Point[] = []
let fills: RecordedFill[] = []
let strokes: Point[][] = []
let callbacks: Map<number, FrameRequestCallback>
let motionListeners: Set<() => void>
let nextFrame = 1
const originalMatchMedia = window.matchMedia
const context = {
  globalAlpha: 1, shadowBlur: 0, fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '', lineJoin: '', shadowColor: '',
  clearRect: jest.fn(), closePath: jest.fn(),
  beginPath: () => { path = [] },
  moveTo: (x: number, y: number) => { path.push([x, y]) },
  lineTo: (x: number, y: number) => { path.push([x, y]) },
  createLinearGradient: () => ({ addColorStop: jest.fn() }),
  fill: (rule?: CanvasFillRule) => { fills.push({ points: [...path], alpha: context.globalAlpha, shadowBlur: context.shadowBlur, rule }) },
  stroke: () => { strokes.push([...path]) },
}

function frame(timestamp: number) {
  const entries = [...callbacks.entries()]
  callbacks.clear()
  act(() => entries.forEach(([, callback]) => callback(timestamp)))
}

beforeEach(() => {
  reducedMotion = false; fills = []; strokes = []; callbacks = new Map(); motionListeners = new Set()
  window.matchMedia = jest.fn(() => ({
    get matches() { return reducedMotion },
    addEventListener: (_event: string, listener: () => void) => motionListeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => motionListeners.delete(listener),
  })) as unknown as typeof window.matchMedia
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { const id = nextFrame++; callbacks.set(id, callback); return id })
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { callbacks.delete(id) })
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => context) as unknown as HTMLCanvasElement['getContext'])
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, width: 320, height: 64,
    top: 0, right: 320, bottom: 64, left: 0, toJSON: () => ({}) })
})

afterEach(() => { cleanup(); jest.restoreAllMocks(); window.matchMedia = originalMatchMedia })

it('fills precisely between the two rendered contours, including their crossings', () => {
  render(<FluidWaveform isActive getVolume={() => 0.8} />)
  frame(0)
  const fill = fills[0]
  expect(fill.points).toEqual([...strokes[0], ...[...strokes[1]].reverse()])
  expect(fill.rule).toBe('evenodd')
  expect(fill.shadowBlur).toBe(0)
  expect(strokes).toHaveLength(3)
  expect(context.closePath).toHaveBeenCalled()
})

it('breathes only while active and cancels the animation on pause', () => {
  const { rerender } = render(<FluidWaveform isActive getVolume={() => 0.8} />)
  frame(0); const startOpacity = fills[0].alpha
  for (let index = 1; index <= 60; index += 1) frame(index * 16.67)
  expect(fills.at(-1)?.alpha).not.toBe(startOpacity)
  expect(callbacks.size).toBe(1)
  rerender(<FluidWaveform isActive={false} getVolume={() => 0} />)
  expect(callbacks.size).toBe(0)
  const fillCount = fills.length
  frame(2000)
  expect(fills).toHaveLength(fillCount)
  expect(fills.at(-1)?.points.every(point => point[1] === 32)).toBe(true)
})

it('renders a fixed filled contour with reduced motion and follows preference changes', () => {
  reducedMotion = true
  const { unmount } = render(<FluidWaveform isActive getVolume={() => 0.8} />)
  expect(callbacks.size).toBe(0)
  expect(fills).toHaveLength(1)
  expect(fills[0].points.some(point => point[1] !== 32)).toBe(true)
  frame(1000)
  expect(fills).toHaveLength(1)
  reducedMotion = false
  act(() => motionListeners.forEach(listener => listener()))
  expect(callbacks.size).toBe(1)
  frame(1016)
  reducedMotion = true
  act(() => motionListeners.forEach(listener => listener()))
  expect(callbacks.size).toBe(0)
  unmount()
  expect(motionListeners.size).toBe(0)
})
