import { z } from 'zod'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import type { Database } from '@/supabase/database.types'

const answer = z.string().trim().min(1).max(1000)
const options = z.array(answer).min(2).max(8)
const localizedTextSchema = z.record(z.string().min(1).max(20), z.string().trim().min(1).max(2000))
const contentHintSchema = z.union([z.string().trim().max(2000), localizedTextSchema]).nullable().optional()

const metadata = {
  level: z.enum(ACCESS_LEVELS),
  lesson: z.string().trim().min(1).max(120),
  topic: z.string().trim().min(1).max(160),
  hint: localizedTextSchema.nullable().optional(),
  solution_audio_url: z.url().max(2000).refine(value => value.startsWith('https://')).nullable(),
}
export const grammarWriteSchema = z.discriminatedUnion('type', [
  z.object({
    ...metadata,
    type: z.literal('fill_in_blank'),
    content: z.object({
      instruction: z.string().trim().max(500).optional(),
      text_before: z.string().max(2000), text_after: z.string().max(2000),
      correct_answer: answer, options, smart_hint: contentHintSchema,
      alternative_answers: z.array(answer).max(20).optional(),
    }).refine(content => `${content.text_before}${content.text_after}`.trim().length > 0),
  }),
  z.object({
    ...metadata,
    type: z.literal('multiple_choice'),
    content: z.object({
      instruction: z.string().trim().max(500).optional(),
      question: z.string().trim().min(1).max(4000), correct_answer: answer, options,
      explanation: contentHintSchema,
    }),
  }),
]).superRefine((value, context) => {
  const normalized = value.content.options.map(normalizeGrammarAnswer)
  if (new Set(normalized).size !== normalized.length) {
    context.addIssue({ code: 'custom', message: 'Answers must be distinct', path: ['content', 'options'] })
  }
  if (!normalized.includes(normalizeGrammarAnswer(value.content.correct_answer))) {
    context.addIssue({ code: 'custom', message: 'Correct answer must be available', path: ['content', 'correct_answer'] })
  }
  if (value.type === 'fill_in_blank' && value.content.alternative_answers) {
    const answers = [value.content.correct_answer, ...value.content.alternative_answers].map(normalizeGrammarAnswer)
    if (new Set(answers).size !== answers.length) {
      context.addIssue({ code: 'custom', message: 'Alternative answers must be distinct', path: ['content', 'alternative_answers'] })
    }
  }
})
export type GrammarWriteInput = z.infer<typeof grammarWriteSchema>
export type GrammarExerciseRow = Database['public']['Tables']['exercises']['Row']
export type GrammarSaveResult = { success: true; data: GrammarExerciseRow } | { success: false; error: 'invalid' | 'failed' }
export interface GrammarDeleteResult { success: boolean }
export interface GrammarLoadResult { data: GrammarExerciseRow[]; failed: boolean }

export function normalizeGrammarAnswer(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE')
}
