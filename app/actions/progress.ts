'use server'

import { createClient } from '@/utils/supabase/server'
import { readVocabularyProgress } from '@/lib/vocabulary-queries'

export async function getAllLevelsProgress() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return {}

  // 1. Hole alle Übungen und deren Level
  const { data: exercises } = await supabase.from('learning_exercises').select('id, unit:learning_units!inner(level)')
  
  // 2. Hole alle Vokabelkarten und deren Level
  const { data: vocabCards } = await supabase.from('learning_vocabulary_cards').select('id, unit:learning_units!inner(level)')

  // 3. Hole den Fortschritt des Users für Übungen
  const { data: exerciseProgress } = await supabase
    .from('user_exercise_progress')
    .select('exercise_id')
    .eq('auth_user_id', user.id)
    .eq('completed', true)

  // 4. Hole den Fortschritt des Users für Vokabeln (Box 7 = gemeistert)
  const vocabProgress = (await readVocabularyProgress(supabase, user.id)).filter(row => row.box_number === 7)

  // Map IDs to Level
  const exerciseLevelMap = new Map((exercises || []).map(e => [e.id, e.unit.level]))
  const vocabLevelMap = new Map((vocabCards || []).map(v => [v.id, v.unit.level]))

  // Total items per level
  const totalPerLevel: Record<string, number> = {}
  exercises?.forEach(e => {
    totalPerLevel[e.unit.level] = (totalPerLevel[e.unit.level] || 0) + 1
  })
  vocabCards?.forEach(v => {
    totalPerLevel[v.unit.level] = (totalPerLevel[v.unit.level] || 0) + 1
  })

  // Completed items per level
  const completedPerLevel: Record<string, number> = {}
  exerciseProgress?.forEach(p => {
    const level = exerciseLevelMap.get(p.exercise_id)
    if (level) {
      completedPerLevel[level] = (completedPerLevel[level] || 0) + 1
    }
  })
  const learnedDirections = new Map<string, Set<string>>()
  vocabProgress?.forEach(item => {
    const directions = learnedDirections.get(item.card_id) ?? new Set<string>()
    directions.add(item.direction)
    learnedDirections.set(item.card_id, directions)
  })
  learnedDirections.forEach((directions, cardId) => {
    if (!directions.has('de_to_native') || !directions.has('native_to_de')) return
    const level = vocabLevelMap.get(cardId)
    if (level) {
      completedPerLevel[level] = (completedPerLevel[level] || 0) + 1
    }
  })

  // Calculate percentages
  const progressPercentages: Record<string, number> = {}
  
  // Initialize all known levels with 0%
  Object.keys(totalPerLevel).forEach(level => {
    progressPercentages[level] = 0
  })

  // Calculate actual percentage
  Object.keys(totalPerLevel).forEach(level => {
    const total = totalPerLevel[level] || 0
    if (total > 0) {
      const completed = completedPerLevel[level] || 0
      progressPercentages[level] = Math.round((completed / total) * 100)
    }
  })

  return progressPercentages
}
