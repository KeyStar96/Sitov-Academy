'use server'

export async function getSitovLearningRecommendations(input: unknown) {
  const { resolveSitovLearningRecommendations } = await import('@/lib/learning/sitov-learning-recommendations-server')
  return resolveSitovLearningRecommendations(input)
}
