'use client'

import { useMemo } from 'react'
import DailyQuestEngine, { type DailyQuestActions } from './DailyQuestEngine'
import { dailyQuestSubmissionSchema, type DailyQuestPreview as PreviewData, type DailyQuestStreak, type DailyQuestResult, type DailyQuestStepResult, type DailyQuestMutation } from '@/lib/daily-quest-contract'

const PREVIEW_STREAK: DailyQuestStreak = { current: 0, longest: 0, lastCompletedDate: null }

/** All mutations below stay in this closure. They never invoke a server action. */
export function createDailyQuestPreviewActions(preview: PreviewData): DailyQuestActions {
  let quest = { ...preview.quest, completedStepIds: [...preview.quest.completedStepIds] }
  const mutation = () => ({ data: { success: true as const, quest, streak: PREVIEW_STREAK } })
  return {
    async submit(input): Promise<DailyQuestResult<DailyQuestStepResult>> {
      const parsed = dailyQuestSubmissionSchema.safeParse(input)
      if (!parsed.success || parsed.data.assignmentId !== quest.id) return { error: 'invalid_input' }
      if (quest.status !== 'active') return { error: 'not_active' }
      const step = quest.steps.find(item => item.id === parsed.data.stepId)
      if (!step) return { error: 'not_found' }
      if (quest.completedStepIds.includes(step.id)) return { data: { ...mutation().data, correct: true, feedback: '' } }
      if (quest.steps.find(item => !quest.completedStepIds.includes(item.id))?.id !== step.id) return { error: 'step_out_of_order' }
      const answer = parsed.data.answer
      const key = preview.answerKey.steps[step.id]
      let correct = false
      if (step.kind === 'discover' && 'wordIds' in answer) {
        const supplied = new Set(answer.wordIds)
        correct = supplied.size === answer.wordIds.length && supplied.size === step.words.length && step.words.every(word => supplied.has(word.id))
      } else if (step.kind === 'sentence_build' && 'pieceIds' in answer) {
        correct = Boolean(key?.accepted?.some(order => order.length === answer.pieceIds.length && order.every((id, index) => id === answer.pieceIds[index])))
      } else if (step.kind === 'dialogue_choice' && 'optionId' in answer) {
        correct = key?.optionId === answer.optionId
      }
      if (correct) quest = { ...quest, completedStepIds: [...quest.completedStepIds, step.id] }
      return { data: { ...mutation().data, correct, feedback: '' } }
    },
    async complete(assignmentId): Promise<DailyQuestResult<DailyQuestMutation>> {
      if (assignmentId !== quest.id) return { error: 'invalid_input' }
      if (quest.status === 'skipped') return { error: 'not_active' }
      if (!quest.steps.every(step => quest.completedStepIds.includes(step.id))) return { error: 'steps_incomplete' }
      quest = { ...quest, status: 'completed' }
      return mutation()
    },
    async skip(assignmentId): Promise<DailyQuestResult<DailyQuestMutation>> {
      if (assignmentId !== quest.id) return { error: 'invalid_input' }
      if (quest.status === 'completed') return mutation()
      quest = { ...quest, status: 'skipped' }
      return mutation()
    },
  }
}

export default function DailyQuestPreview({ preview, locale }: { preview: PreviewData; locale: string }) {
  const actions = useMemo(() => createDailyQuestPreviewActions(preview), [preview])
  return <DailyQuestEngine key={preview.quest.id} initialQuest={preview.quest} initialStreak={PREVIEW_STREAK} locale={locale}
    dashboardHref={`/${locale}/admin`} actions={actions} preview />
}
