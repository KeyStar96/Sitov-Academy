import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import PressableCard from '@/components/motion/PressableCard'
import CountUp from '@/components/motion/CountUp'
import NewBadge from '@/components/motion/NewBadge'
import SlidingPill from '@/components/motion/SlidingPill'
import FeedbackMotion from '@/components/motion/FeedbackMotion'
import { EASE_OUT_SOFT, MOTION, PRESS_SCALE, SPRING, STAGGER, STAGGER_LIMIT, staggerDelay, useReducedMotionSafe } from '@/lib/motion'

// Echte Framer-Bewegung: Die Bausteine sollen zeigen, dass sie sich unter
// „weniger Bewegung" wirklich nicht bewegen — ein Mock würde das verdecken.
jest.unmock('framer-motion')

const globals = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')
const student = readFileSync(resolve(process.cwd(), 'components/dashboard/student.css'), 'utf8')

function preferReducedMotion(reduce: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'), media: query, onchange: null,
    addEventListener: jest.fn(), removeEventListener: jest.fn(), addListener: jest.fn(), removeListener: jest.fn(), dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia
}

describe('D4-Bewegungstokens', () => {
  it('stehen in globals.css mit den Werten aus D4', () => {
    for (const [name, value] of [['motion-fast', '120ms'], ['motion-base', '200ms'], ['motion-slow', '320ms'], ['motion-slower', '500ms'], ['motion-stagger', '40ms']]) {
      expect(globals).toMatch(new RegExp(`--${name}: ${value};`))
    }
    expect(globals).toMatch(/--ease-out-soft: cubic-bezier\(\.22, 1, \.36, 1\);/)
  })

  it('und in lib/motion.ts in Sekunden, mit Feder 420/34 und 40-ms-Staffel für höchstens acht Elemente', () => {
    expect(MOTION).toEqual({ fast: 0.12, base: 0.2, slow: 0.32, slower: 0.5 })
    expect(EASE_OUT_SOFT).toEqual([0.22, 1, 0.36, 1])
    expect(SPRING).toMatchObject({ type: 'spring', stiffness: 420, damping: 34 })
    expect(PRESS_SCALE).toBe(0.97)
    expect(STAGGER).toBe(0.04)
    expect(STAGGER_LIMIT).toBe(8)
    expect([0, 1, 7, 8, 30].map(staggerDelay)).toEqual([0, 0.04, 0.28, 0.28, 0.28])
  })

  it('die Feder kommt auch über lange Wege (Layout 0 → 1000) innerhalb von 500 ms zur Ruhe (D13)', () => {
    const { spring } = jest.requireActual('framer-motion') as typeof import('framer-motion')
    for (const distance of [1, 100, 450, 1000, 1200]) {
      const generator = spring({ keyframes: [0, distance], ...SPRING })
      let at = 0
      while (!generator.next(at).done && at < 5000) at += 5
      expect(at).toBeLessThanOrEqual(500)
    }
  })

  it('der Lernraum kürzt keine Animation nur, er schaltet sie bei „weniger Bewegung" ab', () => {
    expect(student).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.academy-student-shell \*, \.academy-student-shell \*::before, \.academy-student-shell \*::after \{\s*animation: none !important;\s*transition: none !important;/)
    // Keine endlosen Pulse mehr in den Bereichen von Phase 2 (D13).
    for (const selector of ['.st-today__ping::after', '.st-cta::after', '.st-cta__arrow', ".st-path__stop[data-state='current'] .st-path__node"]) {
      const rule = student.slice(student.indexOf(selector)).split('}')[0]
      expect(rule).not.toMatch(/infinite/)
    }
  })
})

describe('useReducedMotionSafe', () => {
  function Probe() { return <span>{useReducedMotionSafe() ? 'ruhig' : 'bewegt'}</span> }

  it('ist auf dem Server „ruhig" — Inhalte kommen nie versteckt im HTML an', () => {
    preferReducedMotion(false)
    // Die Node-Fassung des Server-Renderers (die Browser-Fassung braucht MessageChannel).
    const { renderToString } = require('react-dom/server.node') as typeof import('react-dom/server')
    expect(renderToString(<Probe />)).toContain('ruhig')
  })

  it('folgt im Browser der Systemeinstellung', () => {
    preferReducedMotion(false)
    const { unmount } = render(<Probe />)
    expect(screen.getByText('bewegt')).toBeInTheDocument()
    unmount()
    preferReducedMotion(true)
    render(<Probe />)
    expect(screen.getByText('ruhig')).toBeInTheDocument()
  })
})

describe('Bausteine unter „weniger Bewegung"', () => {
  beforeEach(() => preferReducedMotion(true))

  it('PressableCard bleibt ein gewöhnlicher Link bzw. Knopf und gibt beim Drücken nicht nach', () => {
    const onClick = jest.fn()
    render(<><PressableCard href="/de/dashboard" className="card">Start</PressableCard><PressableCard onClick={onClick}>Hilfe</PressableCard></>)
    const link = screen.getByRole('link', { name: 'Start' })
    expect(link).toHaveAttribute('href', '/de/dashboard')
    fireEvent.pointerDown(link)
    expect(link.style.transform).toBe('')
    const button = screen.getByRole('button', { name: 'Hilfe' })
    expect(button).toHaveAttribute('type', 'button')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('CountUp zeigt sofort den Endwert, Screenreader hören nur ihn', () => {
    render(<CountUp value={48} />)
    const [visible, spoken] = screen.getAllByText('48')
    expect(visible).toHaveAttribute('aria-hidden', 'true')
    expect(spoken).toHaveClass('sr-only')
  })

  it('CountUp begrenzt große Zahlen ohne Funktions-Prop', () => {
    render(<CountUp value={1200} cap={999} />)
    expect(screen.getAllByText('999+')).toHaveLength(2)
  })

  it('SlidingPill steht ohne Wanderweg (kein layoutId) an ihrem Platz', () => {
    const { container } = render(<SlidingPill group="test" className="pill" />)
    const pill = container.querySelector('[data-sliding-pill]')!
    expect(pill).toHaveAttribute('aria-hidden', 'true')
    expect(pill.getAttribute('style') ?? '').not.toMatch(/transform/)
  })

  it('FeedbackMotion zeigt die Rückmeldung ohne Wackeln oder Pop', () => {
    render(<FeedbackMotion correct={false}><p role="status">Leider falsch</p></FeedbackMotion>)
    const wrapper = screen.getByRole('status').parentElement!
    expect(wrapper).toHaveAttribute('data-feedback', 'incorrect')
    expect(wrapper.getAttribute('style') ?? '').not.toMatch(/translate/)
  })
})

describe('Bausteine mit Bewegung', () => {
  beforeEach(() => preferReducedMotion(false))

  it('CountUp zählt nach einer Wertänderung zum neuen Endwert hoch (500 ms)', async () => {
    jest.useFakeTimers()
    try {
      const { rerender } = render(<CountUp value={3} />)
      rerender(<CountUp value={12} />)
      await act(async () => { jest.advanceTimersByTime(600) })
      expect(screen.getAllByText('12')).toHaveLength(2)
    } finally { jest.useRealTimers() }
  })

  it('NewBadge ist eine beschriftete Pille bzw. ein Punkt mit Text für Screenreader', () => {
    render(<><NewBadge label="Neu" /><NewBadge label="Neu im Lernen" variant="dot" /></>)
    expect(screen.getByText('Neu')).toBeVisible()
    expect(screen.getByText('Neu im Lernen')).toHaveClass('sr-only')
  })

  it('„Neu" pulsiert zweimal (unter 500 ms) und ruht dann; nichts blinkt endlos', () => {
    const dot = student.slice(student.indexOf('.st-new-badge__dot {')).split('}')[0]
    expect(dot).toMatch(/animation: st-new-pulse 240ms var\(--ease-out-soft\) 2;/)
  })
})
