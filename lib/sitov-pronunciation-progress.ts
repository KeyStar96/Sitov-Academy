import type { SitovPronunciationReadiness } from './sitov-pronunciation-readiness'

export type SitovPronunciationGoal = { current: number; required: number; remaining: number; fraction: number; met: boolean }

function goal(current: number, required: number): SitovPronunciationGoal {
  return { current, required, remaining: Math.max(0, required - current), fraction: required > 0 ? Math.min(1, current / required) : 1, met: current >= required }
}

/** Mirrors the server's AND between goals and OR between the two grammar routes.
 * This is presentation only: the server's tier and each text's ready flag grant access.
 */
export function sitovPronunciationProgress(readiness: SitovPronunciationReadiness, tier: number) {
  const requirement = readiness.requirements.find(row => row.tier === tier)
  if (!requirement) return null
  const stats = readiness.stats
  const words = goal(stats.knownWords, requirement.knownWords)
  const nodes = goal(stats.grammarNodes, requirement.grammarNodes)
  const tests = goal(stats.passedTests, requirement.passedTests)
  const exercises = goal(stats.legacyGrammarExercises, requirement.legacyGrammarExercises)
  const topics = goal(stats.legacyGrammarTopics, requirement.legacyGrammarTopics)
  const pathFraction = Math.min(nodes.fraction, tests.fraction)
  const legacyFraction = Math.min(exercises.fraction, topics.fraction)
  const grammarFraction = Math.max(pathFraction, legacyFraction)
  const grammarMet = (nodes.met && tests.met) || (exercises.met && topics.met)
  // RPC requirements already account for the number of available forms.
  const verbs = stats.verbEvidenceRequired ? goal(stats.confidentVerbForms, requirement.confidentVerbForms) : null
  const fractions = [words.fraction, grammarFraction, ...(verbs ? [verbs.fraction] : [])]
  const completed = Number(words.met) + Number(grammarMet) + Number(verbs?.met ?? false)
  const total = fractions.length
  // Rounding must never show a fully completed step while one goal is still missing.
  const percent = completed === total ? 100 : Math.min(99, Math.round(fractions.reduce((sum, value) => sum + value, 0) / total * 100))
  return { requirement, words, nodes, tests, exercises, topics, verbs, grammarFraction, grammarMet, percent, completed, total }
}
