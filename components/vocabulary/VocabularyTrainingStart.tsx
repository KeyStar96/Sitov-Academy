'use client'

import { useState, type ComponentProps } from 'react'
import { getVocabularySession } from '@/app/actions/vocabulary'
import VocabCardSession from './VocabCardSession'
import VocabularyStartGate from './VocabularyStartGate'
import type { VocabularySession } from '@/lib/types/vocabulary'

/** Refresh after the persisted choice so carried cards enter this very first round. */
export default function VocabularyTrainingStart({ level, lesson, emptyWithoutCandidates = false, ...props }: ComponentProps<typeof VocabCardSession> & {
  level: string
  lesson?: string
  /** Read-only server check: opening an empty route must not consume first start. */
  emptyWithoutCandidates?: boolean
}) {
  const [session, setSession] = useState<VocabularySession | null>(null)
  if (emptyWithoutCandidates) return <VocabCardSession {...props} level={level} />
  return <VocabularyStartGate level={level} lang={props.uiLanguage ?? 'de'} learnerId={props.learnerId} onReady={async () => {
    const refreshed = await getVocabularySession(level, props.uiLanguage)
    if (refreshed.learnerId !== props.learnerId) throw new Error('learner_changed')
    setSession(refreshed)
  }}>
    {session && <VocabCardSession {...props} level={level} cards={lesson ? session.cards.filter(item => item.card.lesson === lesson || item.originLevel) : session.cards}
      initialDeferredCount={session.deferredCount} previousCardId={session.previousCardId} />}
  </VocabularyStartGate>
}
