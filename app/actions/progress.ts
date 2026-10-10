'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { requestSession } from '@/lib/request-session'
import { readVocabularyProgress } from '@/lib/vocabulary-queries'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import { readSitovLearningPathStatistics } from '@/lib/sitov-learning-path-statistics'

async function readSitovCourseVocabulary(supabase: Awaited<ReturnType<typeof createClient>>) {
  const cards: { id: string; unit: { level: string } }[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('learning_vocabulary_cards')
      .select('id, unit:learning_units!inner(level,owner_auth_user_id)')
      .is('unit.owner_auth_user_id', null).eq('unit.is_active', true)
      .order('id').range(offset, offset + 499)
    if (error) throw new Error(`level_progress_unavailable: ${error.code}`)
    cards.push(...(data ?? []))
    if (!data || data.length < 500) return cards
  }
}

const sitovLevelCounts = z.record(z.string(), z.object({ total: z.number().int().nonnegative(), learned: z.number().int().nonnegative() }))

/**
 * Aktive Kurskarten und in beiden Richtungen gelernte Karten je Niveau.
 *
 * Die Datenbank zählt unter denselben Zeilenrichtlinien in einem Aufruf
 * (Migration 122). Fehlt die Funktion noch, werden Katalog und Lernstand wie
 * zuvor vollständig und seitenweise gelesen.
 */
async function readSitovVocabularyCounts(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase.rpc('get_sitov_vocabulary_level_counts')
  if (!error) return sitovLevelCounts.parse(data)
  if (error.code !== 'PGRST202' && error.code !== '42883') throw new Error(`level_progress_unavailable: ${error.code}`)
  const [vocabCards, vocabProgress] = await Promise.all([readSitovCourseVocabulary(supabase), readVocabularyProgress(supabase, userId)])
  const counts: z.infer<typeof sitovLevelCounts> = {}
  // Nur aktive Kurslektionen: eigene Wörter zählen weiterhin in der Lernbox.
  const vocabLevelMap = new Map(vocabCards.map(card => [card.id, card.unit.level]))
  vocabCards.forEach(card => { (counts[card.unit.level] ??= { total: 0, learned: 0 }).total += 1 })
  const learnedDirections = new Map<string, Set<string>>()
  vocabProgress.filter(row => row.box_number === 7).forEach(item => {
    const directions = learnedDirections.get(item.card_id) ?? new Set<string>()
    directions.add(item.direction)
    learnedDirections.set(item.card_id, directions)
  })
  learnedDirections.forEach((directions, cardId) => {
    if (!directions.has('de_to_native') || !directions.has('native_to_de')) return
    const level = vocabLevelMap.get(cardId)
    if (level) counts[level].learned += 1
  })
  return counts
}

export async function getAllLevelsProgress() {
  const { supabase, user } = await requestSession()

  if (!user) return {}

  // R10: Fehler bleiben Fehler, statt als „0 %“ zu erscheinen. Der Lernpfad
  // ersetzt den Alt-Grammatik-Katalog vollständig; seine Kernknoten zählen
  // einmal, optionale Zusatzknoten nicht. Alle Vokabelabfragen sind vollständig.
  const [paths, vocabulary] = await Promise.all([
    Promise.all(ACCESS_LEVELS.map(async level => ({ level,
      stats: await readSitovLearningPathStatistics(supabase, level, 'de') }))),
    readSitovVocabularyCounts(supabase, user.id),
  ]).catch(error => {
    console.error('[progress] level_progress_unavailable')
    throw error
  })

  const totalPerLevel: Record<string, number> = {}
  const completedPerLevel: Record<string, number> = {}
  paths.forEach(({ level, stats }) => {
    if (!stats) return // Absichtlich gesperrte Trainer tragen keinen Nenner bei.
    totalPerLevel[level] = stats.total
    completedPerLevel[level] = stats.solved
  })
  Object.entries(vocabulary).forEach(([level, count]) => {
    totalPerLevel[level] = (totalPerLevel[level] || 0) + count.total
    if (count.learned > 0) completedPerLevel[level] = (completedPerLevel[level] || 0) + count.learned
  })

  const progressPercentages: Record<string, number> = {}
  Object.keys(totalPerLevel).forEach(level => {
    const total = totalPerLevel[level] || 0
    const completed = completedPerLevel[level] || 0
    progressPercentages[level] = total > 0 ? Math.round((completed / total) * 100) : 0
  })

  return progressPercentages
}
