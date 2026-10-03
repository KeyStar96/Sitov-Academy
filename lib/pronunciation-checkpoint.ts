import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'

export interface PronunciationReadingCheckpoint {
  promptId: string
  listened: boolean
  referencePosition: number
}
export interface PronunciationCheckpointSnapshot {
  state: Record<string, unknown>
  revision: number
  updatedAt: string
}

/** A saved text is only resumed while it remains in the learner's accessible catalogue. */
export function pronunciationReadingCheckpoint(
  state: Record<string, unknown> | undefined,
  prompts: readonly PronunciationPrompt[],
): PronunciationReadingCheckpoint | null {
  if (!state || typeof state.promptId !== 'string' || !prompts.some(prompt => prompt.id === state.promptId)
    || typeof state.listened !== 'boolean' || typeof state.referencePosition !== 'number'
    || !Number.isFinite(state.referencePosition) || state.referencePosition < 0 || state.referencePosition > 1) return null
  return { promptId: state.promptId, listened: state.listened, referencePosition: state.referencePosition }
}
