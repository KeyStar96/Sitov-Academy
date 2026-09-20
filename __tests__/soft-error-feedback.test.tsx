import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import SoftErrorBadge from '@/components/exercises/SoftErrorBadge'
import { answerGradeSchema, SOFT_ERROR_REASONS } from '@/lib/answer-grading'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

describe('server answer contract', () => {
  it.each([
    { status: 'EXACT', matched: 'Haus', reason: 'typo' },
    { status: 'INCORRECT', matched: 'Haus', reason: null },
    { status: 'SOFT_ERROR', matched: 'Haus', reason: null },
    { status: 'SOFT_ERROR', matched: null, reason: 'typo' },
    { status: 'SOFT_ERROR', matched: 'Haus', reason: 'unknown' },
    { status: 'correct', matched: 'Haus', reason: null },
  ])('rejects contradictory or unknown grades: %j', value => {
    expect(answerGradeSchema.safeParse(value).success).toBe(false)
  })
})

describe.each(Object.entries({ de, en, ru, uk, tr }))('%s soft-error feedback', (_locale, dictionary) => {
  it.each(SOFT_ERROR_REASONS)('renders the dictionary message for %s in a warning badge', reason => {
    render(<SoftErrorBadge reason={reason} translations={dictionary.exercises.soft_error} />)
    expect(screen.getByRole('status')).toHaveTextContent(dictionary.exercises.soft_error[reason])
    expect(screen.getByRole('status')).toHaveClass('bg-[var(--warning)]', 'text-[var(--warning-foreground)]')
  })
})

it.each([':root', '.dark'])('warning text meets WCAG AA in %s', selector => {
  const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')
  // Resolve the cascade, so a later override cannot silently bypass this test.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const blocks = [...css.matchAll(new RegExp(`^${escaped} \\{([^}]+)\\}`, 'gm'))]
  const colors = Object.fromEntries(blocks.flatMap(block => [...block[1].matchAll(/--(warning(?:-foreground)?):\s*#([a-f\d]{6});/gi)]).map(match => [match[1], match[2]]))
  const luminance = (hex: string) => {
    const linear = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
  }
  expect(colors.warning).toMatch(/^[a-f\d]{6}$/i)
  expect(colors['warning-foreground']).toMatch(/^[a-f\d]{6}$/i)
  const [light, dark] = [luminance(colors.warning), luminance(colors['warning-foreground'])].sort((a, b) => b - a)
  expect((light + 0.05) / (dark + 0.05)).toBeGreaterThanOrEqual(4.5)
})
