import { render, screen } from '@testing-library/react'
import VisualDiff from '@/components/exercises/VisualDiff'
import { computeVisualDiff } from '@/lib/visual-diff'

function highlighted(actual: string, expected: string) {
  return computeVisualDiff(actual, expected).filter(chunk => chunk.status !== 'correct').map(chunk => chunk.value).join('')
}

it.each([
  ['ich lerne Deutsch.', 'Ich lerne Deutsch.', 'I'],
  ['Ich lere Deutsch.', 'Ich lerne Deutsch.', 'n'],
  ['Ich lorne Deutsch.', 'Ich lerne Deutsch.', 'e'],
  ['Ich lerne Deutsch', 'Ich lerne Deutsch.', '.'],
  ['Ich bin mude.', 'Ich bin müde.', 'ü'],
  ['Я учу немекий.', 'Я учу немецкий.', 'ц'],
  ['Привіт', 'Привіт!', '!'],
  ['Ich lerne  Deutsch.', 'Ich lerne Deutsch.', ''],
  ['Ich lerne Deutsch.', 'Ich lerne Deutsch.', ''],
  ['', 'Hallo!', 'Hallo!'],
])('highlights only the corrected graphemes for %s', (actual, expected, changed) => {
  const chunks = computeVisualDiff(actual, expected)
  expect(chunks.map(chunk => chunk.value).join('')).toBe(expected)
  expect(highlighted(actual, expected)).toBe(changed)
})

it('preserves graphemes, combining accents, whitespace and line breaks', () => {
  const expected = 'Grüße 👩🏽‍🏫!\n  schön'
  expect(computeVisualDiff(expected, expected)).toEqual([{ value: expected, status: 'correct' }])
  expect(highlighted(expected.normalize('NFD'), expected)).toBe('üö')
})

it('shows the exact solution without injecting deleted input or a strike-through', () => {
  const { container } = render(<VisualDiff actual="ich lere wirklich Deutsch!" expected="Ich lerne Deutsch." />)
  const paragraph = container.querySelector('p')!
  expect(paragraph.textContent).toBe('Ich lerne Deutsch.')
  expect(screen.queryByText(/wirklich/)).not.toBeInTheDocument()
  expect(container.querySelector('del, s, .line-through')).toBeNull()
  expect(container.querySelectorAll('.text-\\[var\\(--danger\\)\\]').length).toBeGreaterThan(0)
})
