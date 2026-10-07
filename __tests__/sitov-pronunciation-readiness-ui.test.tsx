import { fireEvent, render, screen, within } from '@testing-library/react'
import SitovPronunciationReadinessCard, { SitovLockedReadings } from '@/components/audio/SitovPronunciationReadinessCard'
import { SITOV_PRONUNCIATION_REQUIREMENTS, type SitovPronunciationReadiness } from '@/lib/sitov-pronunciation-readiness'
jest.unmock('lucide-react')

const readiness: SitovPronunciationReadiness = {
  level: 'A1.1', mode: 'logical', tier: 0, requirements: [...SITOV_PRONUNCIATION_REQUIREMENTS],
  stats: { knownWords: 15, grammarNodes: 1, passedTests: 0, legacyGrammarExercises: 0, legacyGrammarTopics: 0, confidentVerbForms: 1, verbEvidenceRequired: true },
  texts: [{ id: 'fd1297a1-999f-5759-b0d9-1f77c381d114', title: 'Am Samstag im Park', tier: 1, ready: false, wordCount: 38, coveragePercent: 40, requiredCoveragePercent: 60 }],
}

it('explains all next milestones and provides the actual trainer routes', () => {
  render(<SitovPronunciationReadinessCard readiness={readiness} lang="en" level="A1.1" onRetry={jest.fn()} />)
  expect(screen.getByText('Next step: 1 of 3')).toBeVisible()
  expect(screen.getByRole('progressbar', { name: 'Words you know' })).toHaveAttribute('aria-valuenow', '50')
  expect(screen.getByRole('progressbar', { name: 'Grammar practised' })).toHaveAttribute('aria-valuenow', '50')
  expect(screen.getByRole('link', { name: 'Learning path' })).toHaveAttribute('href', '/en/dashboard/level/A1.1/path')
  expect(screen.getByRole('link', { name: 'Verb trainer' })).toHaveAttribute('href', '/en/dashboard/level/A1.1/verbs')
})

it('keeps a locked reading discoverable through its title and known-word requirements', () => {
  render(<SitovLockedReadings readiness={readiness} lang="en" />)
  expect(screen.getByText('Am Samstag im Park')).toBeVisible()
  expect(screen.getByText('Opens at learning step 1')).toBeVisible()
  expect(screen.getByText('40% of content words known · required: 60%')).toBeVisible()
  expect(screen.queryByRole('button')).toBeNull()
})

it('explains direct teacher access without requiring learner milestones', () => {
  render(<SitovPronunciationReadinessCard readiness={{ ...readiness, mode: 'hard' }} lang="en" level="A1.1" onRetry={jest.fn()} />)
  expect(screen.getByText('Your teacher has unlocked this directly')).toBeVisible()
  expect(screen.queryByRole('progressbar')).toBeNull()
})

it('offers a retry and mailbox explanation when readiness cannot be checked', () => {
  render(<SitovPronunciationReadinessCard readiness={null} lang="en" level="A1.1" onRetry={jest.fn()} />)
  expect(screen.getByRole('button', { name: 'Reload learning progress' })).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent('Your previous recordings remain in your mailbox.')
})

it('makes completed counts and exact remaining work immediately visible', () => {
  render(<SitovPronunciationReadinessCard readiness={readiness} lang="en" level="A1.1" onRetry={jest.fn()} />)
  expect(screen.getByText('15 secure words still needed')).toBeVisible()
  expect(screen.getByText('2 secure verb forms still needed')).toBeVisible()
  expect(screen.getByText('1 / 2')).toBeVisible()
  expect(screen.getByText('1 still needed')).toBeVisible()
  expect(screen.getByRole('progressbar', { name: 'Learning goal progress · Learning step 1' })).toHaveAttribute('aria-valuenow', '44')
  expect(screen.queryByText('Or through previous grammar exercises')).toBeNull()
})

it('lets learners inspect the next steps without granting text access', () => {
  render(<SitovPronunciationReadinessCard readiness={readiness} lang="en" level="A1.1" onRetry={jest.fn()} />)
  const medium = screen.getByRole('button', { name: 'Medium texts Later' })
  fireEvent.click(medium)
  expect(medium).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('65 secure words still needed')).toBeVisible()
  expect(screen.getByText('Passed tests')).toBeVisible()
  expect(screen.getByText('1 still needed')).toBeVisible()
  expect(screen.getByText('0 texts ready')).toBeVisible()
})

it('explains both grammar routes when there is historical grammar evidence', () => {
  render(<SitovPronunciationReadinessCard readiness={{ ...readiness, stats: { ...readiness.stats, legacyGrammarExercises: 4, legacyGrammarTopics: 1 } }} lang="en" level="A1.1" onRetry={jest.fn()} />)
  expect(screen.getByText('Or through previous grammar exercises')).toBeVisible()
  expect(screen.getByText('4 / 8')).toBeVisible()
  expect(screen.getAllByText('1 / 2')).toHaveLength(2)
  expect(screen.getByText('Complete either route. Sections and tests cannot be combined with the other route.')).toBeVisible()
})

it('separates a completed learning step from missing text vocabulary and pending content access', () => {
  const readyStep = { ...readiness, tier: 1 }
  const { rerender } = render(<SitovLockedReadings readiness={readyStep} lang="en" />)
  expect(screen.getByText('Learning step 1 completed')).toBeVisible()
  expect(screen.getByText('20 percentage points of text vocabulary still needed')).toBeVisible()
  expect(screen.getByRole('link', { name: 'Keep practising text vocabulary' })).toHaveAttribute('href', '/en/dashboard/level/A1.1/vocabulary')
  expect(screen.getByText('Am Samstag im Park')).toHaveAttribute('lang', 'de')
  expect(screen.getByText('Am Samstag im Park')).toHaveAttribute('translate', 'no')
  rerender(<SitovLockedReadings readiness={{ ...readyStep, texts: readyStep.texts.map(row => ({ ...row, coveragePercent: 60 })) }} lang="en" />)
  expect(screen.getByText('Content access for this text is still being prepared.')).toBeVisible()
  expect(screen.queryByRole('link')).toBeNull()
})

it.each(['de', 'en', 'ru', 'uk', 'tr'])('renders the goals and roadmap in interface language %s', lang => {
  render(<SitovPronunciationReadinessCard readiness={readiness} lang={lang} level="A1.1" onRetry={jest.fn()} />)
  expect(screen.getAllByRole('progressbar')).toHaveLength(4)
  expect(within(screen.getByRole('group')).getAllByRole('button')).toHaveLength(3)
  expect(screen.getAllByRole('link')).toHaveLength(3)
  for (const link of screen.getAllByRole('link')) expect(link.getAttribute('href')).toMatch(new RegExp(`^/${lang}/dashboard/`))
  if (lang !== 'de') expect(screen.queryByText('Noch 15 sichere Wörter')).toBeNull()
})

it('delivers readable server HTML and starts decorative motion paused', () => {
  const { renderToStaticMarkup } = require('react-dom/server.node') as typeof import('react-dom/server')
  const html = renderToStaticMarkup(<SitovPronunciationReadinessCard readiness={readiness} lang="en" level="A1.1" onRetry={() => {}} />)
  expect(html).toContain('15 secure words still needed')
  expect(html).toContain('aria-valuenow="44"')
  expect(html).toContain('data-sitov-live="false"')
  expect(html).toContain('scaleX(0.5)')
  expect(html).not.toMatch(/opacity:\s*0(?:[;"\s])/u)
})
