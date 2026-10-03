import { z } from 'zod'

const count = z.number().int().nonnegative()
export const sitovPronunciationModeSchema = z.enum(['logical', 'hard'])
export type SitovPronunciationMode = z.infer<typeof sitovPronunciationModeSchema>
export const sitovPronunciationRequirementSchema = z.object({
  tier: count.min(1).max(3), knownWords: count, grammarNodes: count, passedTests: count,
  legacyGrammarExercises: count, legacyGrammarTopics: count, confidentVerbForms: count,
})
/** These learning milestones are independent of CEFR level and elapsed time. */
export const SITOV_PRONUNCIATION_REQUIREMENTS = [
  { tier: 1, knownWords: 30, grammarNodes: 2, passedTests: 0, legacyGrammarExercises: 8, legacyGrammarTopics: 2, confidentVerbForms: 3 },
  { tier: 2, knownWords: 80, grammarNodes: 5, passedTests: 1, legacyGrammarExercises: 20, legacyGrammarTopics: 3, confidentVerbForms: 8 },
  { tier: 3, knownWords: 160, grammarNodes: 10, passedTests: 2, legacyGrammarExercises: 40, legacyGrammarTopics: 5, confidentVerbForms: 15 },
] as const
export const sitovPronunciationReadinessSchema = z.object({
  level: z.string(), mode: sitovPronunciationModeSchema, tier: count.max(3),
  stats: z.object({ knownWords: count, grammarNodes: count, passedTests: count,
    legacyGrammarExercises: count, legacyGrammarTopics: count, confidentVerbForms: count, verbEvidenceRequired: z.boolean(), availableVerbForms: count.optional() }),
  requirements: z.array(sitovPronunciationRequirementSchema),
  texts: z.array(z.object({ id: z.string().uuid(), title: z.string(), tier: count.min(1).max(3),
    ready: z.boolean(), wordCount: count, coveragePercent: count.max(100), requiredCoveragePercent: count.max(100) })),
})
export type SitovPronunciationReadiness = z.infer<typeof sitovPronunciationReadinessSchema>
