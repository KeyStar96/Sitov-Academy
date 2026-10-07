import { buildSitovVerbLearningBox } from '@/lib/verbs/learning-box'
import { getSitovVerbById } from '@/lib/verbs/catalog'
import type { SitovVerbTrainerState } from '@/lib/verbs/contracts'
import type { SitovVerbProgress, SitovVerbTense } from '@/lib/verbs/types'

const fahren = { ...getSitovVerbById('sitov-verb-fahren')!, unitId: 'sitov-test-unit' }
const sein = { ...getSitovVerbById('sitov-verb-sein')!, unitId: 'sitov-test-unit' }
const now = Date.parse('2026-10-07T12:00:00Z')
function progress(verbId: string, tense: SitovVerbTense, box: number, nextReviewAt = '2099-01-01T10:00:00Z'): SitovVerbProgress {
  return { verbId, tense, box, attempts: 8, correct: 7, lapses: 1, nextReviewAt, lastAnsweredAt: '2026-10-01T10:00:00Z' }
}
function state(rows: SitovVerbProgress[] = []): SitovVerbTrainerState {
  return { learnerId: 'sitov-independent-learner', level: 'A1.2', authorizedLevels: ['A1.1', 'A1.2'], tenses: ['present', 'perfect'],
    verbs: [fahren, sein], selectedIds: [fahren.id, sein.id], progress: rows }
}

test('places every selected visible verb once in its least advanced unlocked tense', () => {
  const box = buildSitovVerbLearningBox(state([progress(fahren.id, 'present', 6), progress(fahren.id, 'perfect', 2),
    progress(sein.id, 'present', 7), progress(sein.id, 'perfect', 7)]), now)
  expect(box.buckets.find(bucket => bucket.key === 2)).toMatchObject({ count: 1, halfKnown: 1, due: 0 })
  expect(box.buckets.find(bucket => bucket.key === 'learned')).toMatchObject({ count: 1, due: 0 })
  expect(box.buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(2)
  expect(box).toMatchObject({ totalVerbs: 2, totalForms: 4, practicedForms: 4, learnedForms: 2, learnedVerbs: 1, confidentForms: 3, progressPercent: 75 })
})

test('a newly unlocked tense starts at one while earlier progress stays stored and unmodified', () => {
  const stored = progress(fahren.id, 'present', 7)
  const source = { ...state([stored]), selectedIds: [fahren.id] }
  const before = JSON.parse(JSON.stringify(source))
  const initial = buildSitovVerbLearningBox({ ...source, level: 'A1.1', tenses: ['present'] }, now)
  expect(initial).toMatchObject({ learnedVerbs: 1, totalForms: 1, freshForms: 0, progressPercent: 100 })
  const expanded = buildSitovVerbLearningBox(source, now)
  expect(expanded.cards[0]).toMatchObject({ box: 1, partlyAhead: true })
  expect(expanded).toMatchObject({ learnedVerbs: 0, totalForms: 2, learnedForms: 1, freshForms: 1, dueForms: 1, progressPercent: 50 })
  expect(source).toEqual(before)
})

test('unselected verbs, out-of-context selections and locked tense receipts cannot inflate learning totals', () => {
  const source = { ...state([progress(fahren.id, 'present', 6), progress(fahren.id, 'past', 7), progress(sein.id, 'present', 7)]),
    selectedIds: [fahren.id, 'sitov-verb-not-visible'] }
  expect(buildSitovVerbLearningBox(source, now)).toMatchObject({ totalVerbs: 1, totalForms: 2, practicedForms: 1, learnedForms: 0, confidentForms: 1 })
  const a2 = buildSitovVerbLearningBox({ ...state(), level: 'A2.1', tenses: ['present', 'perfect', 'past'] }, now)
  expect(a2.cards.find(card => card.verb.id === fahren.id)?.forms.map(form => form.tense)).toEqual(['present', 'perfect'])
  expect(a2.cards.find(card => card.verb.id === sein.id)?.forms.map(form => form.tense)).toEqual(['present', 'perfect', 'past'])
})

test('learned forms still report their scheduled review and invalid dates are treated as ready', () => {
  const source = { ...state([progress(fahren.id, 'present', 7, '2026-10-01T10:00:00Z'), progress(fahren.id, 'perfect', 7, 'not-a-date')]), selectedIds: [fahren.id] }
  const box = buildSitovVerbLearningBox(source, now)
  expect(box).toMatchObject({ dueForms: 2, learnedForms: 2, learnedVerbs: 1, nextReviewAt: null })
  expect(box.buckets.find(bucket => bucket.key === 'learned')).toMatchObject({ count: 1, due: 1 })
})

test('removing and restoring a verb changes its visibility while reusing the exact same independent receipts', () => {
  const stored = [progress(fahren.id, 'present', 4), progress(fahren.id, 'perfect', 5)]
  const source = { ...state(stored), selectedIds: [fahren.id] }
  expect(buildSitovVerbLearningBox({ ...source, selectedIds: [] }, now)).toMatchObject({ totalVerbs: 0, totalForms: 0, progressPercent: 0 })
  const restored = buildSitovVerbLearningBox(source, now)
  expect(restored.cards[0]).toMatchObject({ box: 4, partlyAhead: true })
  expect(restored.cards[0].forms.map(form => form.progress)).toEqual(stored)
})
