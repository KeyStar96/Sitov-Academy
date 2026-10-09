import 'server-only'

import { sitovServerFailure } from '@/lib/sitov-server-failure'
import { cache } from 'react'
import { createClient } from '@/utils/supabase/server'
import { NO_NEW_ITEMS, parseLearningNewCounts, parseLearningNewItems, type LearningNewCounts, type LevelNewItems } from '@/lib/learning-new'

/**
 * Alle „Neu"-Zähler der Person in **einem** Aufruf (Startseite, Modus-Dock,
 * untere Leiste). Pro Anfrage nur einmal gelesen. Ein Fehler ist kein „nichts
 * Neues" mit Nachdruck, sondern schlicht kein Kennzeichen (`null`): Die Seite
 * darf daran nie scheitern.
 */
export const loadLearningNewCounts = cache(async (): Promise<LearningNewCounts | null> => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_learning_new_counts')
    if (error) { console.error('[learning-new] counts_unavailable', { failure: sitovServerFailure(error) }); return null }
    const counts = parseLearningNewCounts(data)
    if (!counts) console.error('[learning-new] counts_invalid', { failure: sitovServerFailure(data) })
    return counts
  } catch (error) { console.error('[learning-new] counts_unavailable', { failure: sitovServerFailure(error) }); return null }
})

/** Objekt-Schlüssel je Art für die Kennzeichen an Kacheln und Karten eines Niveaus. */
export const loadLearningNewItems = cache(async (level: string): Promise<LevelNewItems> => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_learning_new_items', { p_level: level })
    if (error) { console.error('[learning-new] items_unavailable', { failure: sitovServerFailure(error) }); return NO_NEW_ITEMS }
    const items = parseLearningNewItems(data)
    if (items === NO_NEW_ITEMS) console.error('[learning-new] items_invalid', { failure: sitovServerFailure(data) })
    return items
  } catch (error) { console.error('[learning-new] items_unavailable', { failure: sitovServerFailure(error) }); return NO_NEW_ITEMS }
})
