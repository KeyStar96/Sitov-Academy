'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { dailyQuestSubmissionSchema, type DailyQuestResult, type DailyQuestStatus, type DailyQuestStepResult, type DailyQuestMutation } from '@/lib/daily-quest-contract'
import {
  loadDailyQuest, loadDailyQuestStatus, updateDailyQuestEnabled,
  submitDailyQuestAnswer, finishDailyQuest, dismissDailyQuest,
} from '@/lib/daily-quest-server'

const assignmentIdSchema = z.string().uuid()

export async function getDailyQuest() { return loadDailyQuest() }
export async function getDailyQuestStatus() { return loadDailyQuestStatus() }

export async function setDailyQuestEnabled(enabled: unknown): Promise<DailyQuestResult<DailyQuestStatus>> {
  const parsed = z.boolean().safeParse(enabled)
  if (!parsed.success) return { error: 'invalid_input' } as const
  const result = await updateDailyQuestEnabled(parsed.data)
  if (result.data) {
    revalidatePath('/[lang]/dashboard/profile', 'page')
    revalidatePath('/[lang]/dashboard', 'page')
  }
  return result
}

export async function submitDailyQuestStep(input: unknown): Promise<DailyQuestResult<DailyQuestStepResult>> {
  const parsed = dailyQuestSubmissionSchema.safeParse(input)
  if (!parsed.success) return { error: 'invalid_input' } as const
  return submitDailyQuestAnswer({ assignmentId: parsed.data.assignmentId, stepId: parsed.data.stepId, answer: parsed.data.answer })
}

export async function completeDailyQuest(assignmentId: unknown): Promise<DailyQuestResult<DailyQuestMutation>> {
  const parsed = assignmentIdSchema.safeParse(assignmentId)
  if (!parsed.success) return { error: 'invalid_input' } as const
  const result = await finishDailyQuest(parsed.data)
  if (result.data) revalidatePath('/[lang]/dashboard', 'page')
  return result
}

export async function skipDailyQuest(assignmentId: unknown): Promise<DailyQuestResult<DailyQuestMutation>> {
  const parsed = assignmentIdSchema.safeParse(assignmentId)
  if (!parsed.success) return { error: 'invalid_input' } as const
  const result = await dismissDailyQuest(parsed.data)
  if (result.data) revalidatePath('/[lang]/dashboard', 'page')
  return result
}
