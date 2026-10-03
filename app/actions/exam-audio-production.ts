'use server'

import { revalidatePath } from 'next/cache'
import {
  loadExamAudioProductionState, prepareExamProductionUpload, finishExamProductionUpload, changeExamProductionStatus,
  type ExamProductionStatus,
} from '@/lib/exam-preparation/audio-production-server'

export async function getExamAudioProductionState() { return loadExamAudioProductionState() }
export async function createExamProductionUpload(input: { audioId: string; kind: 'raw' | 'prepared'; contentType: string; size: number }) { return prepareExamProductionUpload(input) }
export async function completeExamProductionUpload(input: { audioId: string; kind: 'raw' | 'prepared'; path: string; filename: string; wordTimings?: unknown }) {
  const result = await finishExamProductionUpload(input)
  if (result.success) revalidatePath('/[lang]/admin/exam-preparation', 'page')
  return result
}
export async function setExamProductionStatus(input: { audioId: string; status: ExamProductionStatus; reviewNote?: string; checks?: boolean[] }) {
  const result = await changeExamProductionStatus(input)
  if (result.success) {
    revalidatePath('/[lang]/admin/exam-preparation', 'page')
    revalidatePath('/[lang]/dashboard/exam-preparation', 'layout')
  }
  return result
}
