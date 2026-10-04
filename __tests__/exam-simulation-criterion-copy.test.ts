jest.mock('server-only', () => ({}), { virtual: true })
import { SIMULATION_TASK_POOL } from '@/lib/exam-simulation/content'
import { SITOV_SIMULATION_UI_LANGUAGES, sitovSimulationCopy } from '@/lib/exam-simulation/ui-copy'
import { hasSitovSimulationCriterionTranslation, sitovSimulationCriterion } from '@/lib/exam-simulation/criterion-copy'

const criteria = [...new Set(SIMULATION_TASK_POOL.flatMap(task => task.criteria ?? []))]

it('covers every current assessment criterion without changing the German task pool', () => {
  expect(criteria).toHaveLength(35)
  for (const source of criteria) {
    expect(hasSitovSimulationCriterionTranslation(source)).toBe(true)
    for (const lang of SITOV_SIMULATION_UI_LANGUAGES) {
      const translated = sitovSimulationCriterion(lang, source)
      expect(translated).toBeTruthy()
      if (lang === 'de') expect(translated).toBe(source)
      else expect(translated).not.toBe(source)
    }
  }
})

it('uses localized guidance for unknown historical criteria and preserves German in German UI', () => {
  const source = 'Ein historisches, individuelles Bewertungskriterium.'
  expect(sitovSimulationCriterion('de', source)).toBe(source)
  for (const lang of ['en', 'ru', 'uk', 'tr']) {
    expect(sitovSimulationCriterion(lang, source)).toBe(sitovSimulationCopy(lang).t('criterionFallback'))
  }
})
