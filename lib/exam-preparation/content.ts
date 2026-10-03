import 'server-only'
import pilotModule from '@/content/exam-preparation/sitov-b1-pilot.json'
import plannedModules from '@/content/exam-preparation/sitov-b1-planned-modules.json'
import workshops from '@/content/exam-preparation/sitov-b1-workshops.json'
import recordingOrders from '@/content/exam-preparation/sitov-b1-recording-orders.json'
import recordingSessions from '@/content/exam-preparation/sitov-b1-recording-sessions.json'
import type { ExamModule, ExamTask, ExamUnit } from './types'

/** Fixed content versions preserve the meaning of already stored attempts. */
export const EXAM_CONTENT_VERSION = 1
export const EXAM_CONTENT_RELEASE = 'pilot' as const

export interface ExamAudioOrder {
  audioId: string
  title: string
  learningGoal: string
  profileScope: string
  /** Display script, including readable speaker labels. Never synthesize this. */
  script: string
  /** Exact spoken words, without labels or direction, for measured alignment. */
  spokenText: string
  roles: string[]
  notes: string
  targetDuration: string
  session: number
  taskIds: string[]
  solutions: { taskId: string; answer: string | string[]; evidence: string }[]
  evidence: string[]
  status: 'awaiting_recording'
  route: 'human'
  filename: string
  productionSteps: string[]
  tasks: ExamTask[]
}

export interface ExamRecordingSession {
  id: number
  title: string
  duration: string
  audioIds: string[]
  steps: string[]
}

/** Eight module plans, with only the first module released as a pilot. */
export const EXAM_MODULES: ExamModule[] = [
  pilotModule as unknown as ExamModule,
  ...(plannedModules as unknown as ExamModule[]),
]

/** Thirty progressive workshop units; common training, not six full exam sets. */
export const EXAM_WORKSHOPS = workshops as unknown as ExamModule[]
export const EXAM_AUDIO_ORDERS = recordingOrders as unknown as ExamAudioOrder[]
export const EXAM_RECORDING_SESSIONS = recordingSessions as unknown as ExamRecordingSession[]

/** Human recordings are further practice; they never inflate the 80 + 30 unit plan. */
export const EXAM_PRACTICE_MODULES: ExamModule[] = [{
  id: 'sitov-exam-b1-human-studio',
  title: 'Weitere Hörübungen',
  description: 'Acht eigene Hörpakete mit echten Stimmen. Eine Übung öffnet erst nach Aufnahme, geprüften Wortzeitmarken und fachlicher Medienfreigabe.',
  order: 9,
  releaseStatus: 'published',
  units: EXAM_AUDIO_ORDERS.map((order, index): ExamUnit => ({
    id: `sitov-exam-b1-human-studio-u${String(index + 1).padStart(2, '0')}`,
    moduleId: 'sitov-exam-b1-human-studio',
    title: order.title,
    description: order.learningGoal,
    order: index + 1,
    kind: 'listening',
    required: false,
    estimatedMinutes: Math.max(10, order.tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0)),
    tasks: order.tasks,
    releaseStatus: 'published',
  })),
}]

const allUnits = [...EXAM_MODULES, ...EXAM_WORKSHOPS, ...EXAM_PRACTICE_MODULES].flatMap(module => [...module.units, ...(module.fallbackUnits ?? [])])
const unitsById = new Map(allUnits.map(unit => [unit.id, unit]))
const uniqueTasks = new Map<string, ExamTask>()
for (const unit of allUnits) {
  for (const task of [...unit.tasks, ...(unit.variants ?? []).flat()]) {
    uniqueTasks.set(task.id, task)
  }
}
for (const order of EXAM_AUDIO_ORDERS) {
  for (const task of order.tasks) uniqueTasks.set(task.id, task)
}

/** Includes unpublished authoring tasks for the teacher's production plan. */
export const EXAM_TASKS = [...uniqueTasks.values()]

export function getExamUnit(id: string): ExamUnit | undefined {
  return unitsById.get(id)
}

export function getExamTask(id: string): ExamTask | undefined {
  return uniqueTasks.get(id)
}

export function getExamModule(id: string): ExamModule | undefined {
  return [...EXAM_MODULES, ...EXAM_WORKSHOPS, ...EXAM_PRACTICE_MODULES].find(module => module.id === id)
}

export function getExamAudioOrder(audioId: string): ExamAudioOrder | undefined {
  return EXAM_AUDIO_ORDERS.find(order => order.audioId === audioId)
}
