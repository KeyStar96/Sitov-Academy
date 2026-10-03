export type ExamSkill = 'vocabulary' | 'listening' | 'reading' | 'writing' | 'speaking'
export type ExamTaskType = 'choice' | 'true-false' | 'short-text' | 'writing' | 'speaking' | 'ordering' | 'matching'
export type ExamProfileId = 'general_b1' | 'dtz_a2_b1' | 'telc_deutsch_b1' | 'goethe_b1' | 'oesd_zb1' | 'telc_deutsch_a2_b1' | 'oesd_zdoe_b1'
export interface ExamTask {
  id: string; version: number; skill: ExamSkill; type: ExamTaskType; title: string; instruction: string
  text?: string; options?: { id: string; text: string }[]; correctAnswer?: string | string[]
  explanation?: string; evidence?: string; hints: string[]; rubric?: string[]
  audio?: { id: string; script: string; status: 'prepared' | 'awaiting_recording'; route: 'qwen' | 'human'; roles: string[]; notes: string; src?: string }
  image?: { id: string; src: string; alt: string; status: 'prepared' | 'awaiting_review' }
  profiles: ExamProfileId[]; competency: string; formatFamily: string; estimatedMinutes: number
  releaseStatus: 'published' | 'awaiting_media' | 'draft'; provenance: string
  /** Matching uses one answer ID per prompt; ordering uses the ordered IDs. */
  prompts?: { id: string; text: string }[]
  words?: { word: string; example: string }[]
}
export interface ExamUnit {
  id: string; moduleId: string; title: string; description: string; order: number
  kind: 'orientation' | 'vocabulary' | 'listening' | 'reading' | 'writing' | 'speaking' | 'transfer' | 'checkpoint'
  required: boolean; estimatedMinutes: number; tasks: ExamTask[]; releaseStatus: 'published' | 'draft'
  /** New, fixed variants; seen variants never prove independent success again. */
  variants?: ExamTask[][]
}
export interface ExamModule {
  id: string; title: string; description: string; order: number; units: ExamUnit[]
  fallbackUnits?: ExamUnit[]
  releaseStatus: 'published' | 'draft'
}
export interface ExamAttempt {
  id: string; taskId: string; taskVersion: number; unitId: string; answer: string | string[]
  correct: boolean | null; helped: boolean; feedbackViewed: boolean; createdAt: string
  seconds: number; mode: 'practice' | 'checkpoint'; variant: number
  feedback?: { explanation: string; evidence: string; correctAnswer?: string | string[] }
}
export interface ExamSubmission {
  id: string; taskId: string; taskVersion: number; unitId: string; studentId: string
  kind: 'writing' | 'speaking'; helped?: boolean; text: string; mediaPath: string | null; mediaUrl: string | null
  photoPath?: string | null; photoUrl?: string | null
  teacherId: string | null; teacherName?: string; status: 'draft' | 'submitted' | 'reviewed'
  previousId: string | null; reflection: string | null; createdAt: string
  feedback: { id: string; text: string; strengths: string; priorities: string[]; revision: string; rating: 'practice' | 'assisted' | 'independent'; createdAt: string; rubric?: { criterion: string; rating: 'practice' | 'assisted' | 'independent' }[] }[]
}
export interface ExamState {
  profileId: ExamProfileId; attempts: ExamAttempt[]; submissions: ExamSubmission[]
  overrides: { moduleId: string; reason: string }[]; fallbackModules: string[]
  teacher: { id: string; name: string; responseDays: number } | null
  available: boolean; error?: string
}
export interface ExamActionResult { success: boolean; error?: string; state?: ExamState; attempt?: ExamAttempt; submission?: ExamSubmission; feedback?: { explanation: string; evidence: string; correctAnswer?: string | string[] } }
