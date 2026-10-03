import { render, screen } from '@testing-library/react'
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
