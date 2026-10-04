/** Safe to import in client components. Solutions and spoken scripts live on the server. */
export type SimulationLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
/** Legacy provider IDs remain readable for frozen historical sessions. New runs use sitov. */
export type SimulationProvider = 'sitov' | 'telc' | 'goethe' | 'oesd' | 'dtz'
export type SimulationSkill = 'reading' | 'language' | 'listening' | 'writing' | 'speaking'
export type SimulationTaskType = 'choice' | 'true-false' | 'matching' | 'ordering' | 'form' | 'writing' | 'speaking'
export type SimulationAnswer = string | string[] | { text: string; audioPath?: string; audioUrl?: string }
export type SimulationMode = 'practice' | 'exam'

export interface SimulationFamily {
  id: string
  skill: SimulationSkill
  title: string
  /** The practice run samples each available family; exact official sets stay gated. */
  practiceTasks: number
  requiresAudio: boolean
}

export interface SimulationProfile {
  id: string
  level: SimulationLevel
  provider: SimulationProvider
  title: string
  description: string
  available: boolean
  fullExamReleased: boolean
  practiceAvailable: boolean
  practiceMinutes: number
  officialMinutes: string
  officialSource: string
  checkedAt: string
  families: SimulationFamily[]
  blockers: string[]
  passRule: string
}

export interface SimulationTask {
  id: string
  version: number
  level: SimulationLevel
  skill: SimulationSkill
  family: string
  type: SimulationTaskType
  title: string
  instruction: string
  text?: string
  options?: { id: string; text: string }[]
  prompts?: { id: string; text: string }[]
  fields?: { id: string; label: string }[]
  interactionRequired?: boolean
  criteria?: string[]
  maxPoints: number
  minutes: number
  /** Storage URLs are resolved only after verified audio and word timing proof. */
  audio?: { id: string; src: string; plays: number }
  image?: { src: string; alt: string }
}

export interface SimulationTeacherReview {
  score: number
  maxPoints: number
  comment: string
  teacherId: string
  reviewedAt: string
  interactionConfirmed?: boolean
}

export interface SimulationTaskFeedback {
  taskId: string
  title: string
  skill: SimulationSkill
  family: string
  answer: SimulationAnswer | null
  answerText?: string | string[]
  correct: boolean | null
  points: number | null
  maxPoints: number
  expectedAnswer?: string | string[]
  explanation: string
  evidence?: string
  criteria?: string[]
  teacherReview?: SimulationTeacherReview
}

export interface SimulationSkillResult {
  skill: SimulationSkill
  title: string
  points: number
  maxPoints: number
  percentage: number | null
  pendingTeacherTasks: number
  correctTasks: number
  wrongTasks: number
}

export interface SimulationResult {
  status: 'practice-needed' | 'teacher-review-required' | 'practice-strong' | 'passed' | 'not-passed'
  headline: string
  description: string
  /** A practice result never asserts that a real certificate has been passed. */
  examPass: boolean | null
  percentage: number | null
  reviewedPoints: number
  reviewedMaxPoints: number
  totalMaxPoints: number
  pendingTeacherTasks: number
  missingSkills: SimulationSkill[]
  skills: SimulationSkillResult[]
  feedback: SimulationTaskFeedback[]
  nextSteps: string[]
}

export interface SimulationSession {
  id: string
  version: number
  profileId: string
  level: SimulationLevel
  provider: SimulationProvider
  mode: SimulationMode
  title: string
  startedAt: string
  expiresAt: string
  completedAt?: string
  status: 'active' | 'completed'
  tasks: SimulationTask[]
  answers: Record<string, SimulationAnswer>
  /** Always absent while active. */
  result?: SimulationResult
  coverage: { included: string[]; missing: string[]; fullExam: boolean; note: string }
}

export interface SimulationState {
  accessLocked?: boolean
  available: boolean
  error?: string
  active: SimulationSession | null
  history: SimulationSession[]
}

export interface SimulationActionResult {
  success: boolean
  error?: string
  session?: SimulationSession
  state?: SimulationState
}
