'use client'

import { useEffect } from 'react'
import { subscribeToLearningResets } from '@/lib/learning-reset-events'

/** Receives the verified learner ID from the server layout. The initiating tab
 * keeps its success message; other tabs discard stale queues by reloading. */
export default function LearningResetSync({ userId }: { userId: string }) {
  useEffect(() => subscribeToLearningResets(userId, () => { window.location.reload() }), [userId])
  return null
}
