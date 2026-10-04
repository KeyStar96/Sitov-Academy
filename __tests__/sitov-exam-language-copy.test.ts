/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })

import { SIMULATION_TASK_POOL } from '@/lib/exam-simulation/content'
import { hasSitovSimulationFeedbackTranslation, sitovSimulationFeedbackCopy } from '@/lib/exam-simulation/feedback-copy'
import { SITOV_EXAM_ENTRY_COPY } from '@/lib/exam-entry-i18n'
import { EXAM_TASKS } from '@/lib/exam-preparation/content'
import { hasExamPrepExplanationTranslation, localizeExamPrepExplanation } from '@/lib/exam-preparation/feedback-copy'

const dynamicExplanation = /^(?:Die passende Aussage ist: |Das Hauptthema ist: |Die Aussage stimmt(?: nicht)?\. )/
const explanations = [...new Set(SIMULATION_TASK_POOL.map(task => task.explanation))].filter(text => !dynamicExplanation.test(text))

it.each(['en', 'ru', 'uk', 'tr'])('provides precise %s explanations for every published fixed exam explanation', lang => {
  expect(explanations.length).toBeGreaterThan(150)
  for (const source of explanations) {
    expect(hasSitovSimulationFeedbackTranslation(source)).toBe(true)
    const translated = sitovSimulationFeedbackCopy(lang, source)
    expect(translated).toBeTruthy()
    expect(translated).not.toBe(source)
  }
})

it('preserves German grammatical examples inside translated assessment prose', () => {
  const source = 'Im weil-Satz steht das konjugierte Verb am Ende.'
  expect(sitovSimulationFeedbackCopy('en', source)).toBe('In a “weil” clause, the conjugated verb goes at the end.')
  expect(sitovSimulationFeedbackCopy('de', source)).toBe(source)
  expect(sitovSimulationFeedbackCopy('en', 'An unknown teacher-authored explanation')).toBeNull()
})

it.each(['en', 'ru', 'uk', 'tr'])('translates every authored preparation explanation into %s', lang => {
  const sources = [...new Set(EXAM_TASKS.map(task => task.explanation).filter((text): text is string => !!text))]
  expect(sources.length).toBeGreaterThan(100)
  for (const source of sources) {
    expect(hasExamPrepExplanationTranslation(source)).toBe(true)
    expect(localizeExamPrepExplanation(lang, source)).not.toBe(source)
    expect(localizeExamPrepExplanation(lang, source).trim()).not.toBe('')
  }
  expect(localizeExamPrepExplanation(lang, 'An individual teacher comment')).toBe('An individual teacher comment')
})

it('keeps home copy keys complete in every supported interface language', () => {
  const keys = Object.keys(SITOV_EXAM_ENTRY_COPY.de).sort()
  for (const messages of Object.values(SITOV_EXAM_ENTRY_COPY)) {
    expect(Object.keys(messages).sort()).toEqual(keys)
    expect(Object.values(messages).every(text => text.trim().length > 0)).toBe(true)
  }
  expect(SITOV_EXAM_ENTRY_COPY.en.title).toBe('How ready are you for your exam?')
  expect(SITOV_EXAM_ENTRY_COPY.ru.reading).toBe('Чтение')
})
