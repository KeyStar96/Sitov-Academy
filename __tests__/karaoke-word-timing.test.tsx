import { render } from '@testing-library/react'
import KaraokeText from '@/components/audio/KaraokeText'

it('uses actual word timing for long German words and umlauts instead of a length estimate', () => {
  const text = 'Die Straßenverkehrsordnung\nändert sich.'
  const { container, rerender } = render(<KaraokeText text={text} progress={0.9} activeWordIndex={1} />)
  expect(container.querySelector('[data-state="current"]')).toHaveTextContent('Straßenverkehrsordnung')
  expect(container.querySelectorAll('[data-state="read"]')).toHaveLength(1)
  expect(container.textContent).toBe(text)
  rerender(<KaraokeText text={text} progress={0.1} activeWordIndex={2} />)
  expect(container.querySelector('[data-state="current"]')).toHaveTextContent('ändert')
  expect(container.querySelectorAll('[data-state="read"]')).toHaveLength(2)
})

it('clears exact highlighting on pause/end without falling back to stale fractional progress', () => {
  const { container, rerender } = render(<KaraokeText text="Guten Tag!" progress={0.6} activeWordIndex={1} />)
  expect(container.querySelector('[data-state="current"]')).toHaveTextContent('Tag!')
  rerender(<KaraokeText text="Guten Tag!" progress={0.6} activeWordIndex={null} />)
  expect(container.querySelector('[data-state]')).toBeNull()
  expect(container.querySelector('p')).toHaveAttribute('data-following', 'false')
})

it('keeps the fraction estimate for recordings without word timing', () => {
  const { container } = render(<KaraokeText text="Guten Tag! Ich heiße Anna." progress={0.5} />)
  expect(container.querySelector('[data-state="current"]')).toHaveTextContent('Ich')
})
