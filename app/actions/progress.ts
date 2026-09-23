'use server'

import { createClient } from '@/utils/supabase/server'
import { readVocabularyProgress } from '@/lib/vocabulary-queries'

export async function getAllLevelsProgress() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return {}

  // R10: Ein Lesefehler darf niemals als "0 % Fortschritt" erscheinen. Ohne die
  // Fehlerprüfung liefert PostgREST `data: null`, und die Nullish-Guards weiter
  // unten erzeugen daraus stillschweigend einen falschen, zu niedrigen Wert.
  // 1. Hole alle Übungen und deren Level
  const { data: exercises, error: exercisesError } = await supabase.from('learning_exercises').select('id, unit:learning_units!inner(level)')

  // 2. Hole alle Vokabelkarten und deren Level — nur Kursvokabeln: „Eigene
  //    Wörter" zählen in der Lernbox, nicht im Kursfortschritt des Niveaus.
  const { data: vocabCards, error: vocabCardsError } = await supabase.from('learning_vocabulary_cards')
    .select('id, unit:learning_units!inner(level,owner_auth_user_id)').is('unit.owner_auth_user_id', null)

  // 3. Hole den Fortschritt des Users für Übungen
  const { data: exerciseProgress, error: exerciseProgressError } = await supabase
    .from('user_exercise_progress')
    .select('exercise_id')
    .eq('auth_user_id', user.id)
    .eq('completed', true)

  const readFailure = exercisesError ?? vocabCardsError ?? exerciseProgressError
  if (readFailure) {
    console.error('[progress] level_progress_unavailable')
    throw new Error(`level_progress_unavailable: ${readFailure.code ?? 'unknown'}`)
  }

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
