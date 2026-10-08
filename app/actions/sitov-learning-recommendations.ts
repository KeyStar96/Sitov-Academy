'use server'
import { resolveSitovLearningRecommendations } from '@/lib/learning/sitov-learning-recommendations-server'

export async function getSitovLearningRecommendations(input: unknown) {
  return resolveSitovLearningRecommendations(input)
}
