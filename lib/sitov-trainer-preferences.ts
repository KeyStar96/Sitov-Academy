'use client'

import { useSyncExternalStore } from 'react'
import { loadRoundSize, loadStudyMode, saveRoundSize, saveStudyMode, subscribeVocabularyPreferences } from '@/lib/vocabulary-lernkasten'
import { DEFAULT_ROUND_SIZE, type RoundSize } from '@/lib/vocabulary-rounds'

export function useVocabularyStudyMode(): readonly ['flashcard' | 'typed', typeof saveStudyMode] {
  const mode = useSyncExternalStore(subscribeVocabularyPreferences, loadStudyMode, () => 'flashcard' as const)
  return [mode, saveStudyMode]
}

export function useVocabularyRoundSize(): readonly [RoundSize, typeof saveRoundSize] {
  const size = useSyncExternalStore(subscribeVocabularyPreferences, loadRoundSize, () => DEFAULT_ROUND_SIZE)
  return [size, saveRoundSize]
}
