import { z } from 'zod'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import type { Database } from '@/supabase/database.types'
import type { AnswerGrade, SoftErrorReason } from '@/lib/answer-grading'

const answer = z.string().trim().min(1).max(1000)
const options = z.array(answer).min(2).max(8)
const localizedTextSchema = z.record(z.string().min(1).max(20), z.string().trim().min(1).max(2000))
const contentHintSchema = z.union([z.string().trim().max(2000), localizedTextSchema]).nullable().optional()
const targetFormSchema = z.array(z.string().trim().min(1)).min(1)
const translationPromptSchema = z.partialRecord(z.enum(['de', 'en', 'ru', 'uk', 'tr']), z.string().trim().min(1).max(2000))

const metadata = {
  level: z.enum(ACCESS_LEVELS),
  lesson: z.string().trim().min(1).max(120),
  topic: z.string().trim().min(1).max(160),
  hint: localizedTextSchema.nullable().optional(),
  translation_prompt: translationPromptSchema.optional(),
  solution_audio_url: z.url().max(2000).refine(value => value.startsWith('https://')).nullable(),
}
export const grammarWriteSchema = z.discriminatedUnion('type', [
  z.object({
    ...metadata,
    type: z.literal('fill_in_blank'),
    content: z.object({
      target_form: targetFormSchema,
      instruction: z.string().trim().max(500).optional(),
      text_before: z.string().max(2000), text_after: z.string().max(2000),
      correct_answer: answer, options, smart_hint: contentHintSchema,
      accepted_answers: z.array(answer).min(1).max(21).optional(),
      alternative_answers: z.array(answer).max(20).optional(),
      gap_hint: z.string().trim().max(100).optional(),
    }).transform(({ alternative_answers, ...content }) => ({ ...content,
        accepted_answers: content.accepted_answers ?? [content.correct_answer, ...(alternative_answers ?? [])] })),
  }),
  z.object({
    ...metadata,
    type: z.literal('multiple_choice'),
    content: z.object({
      target_form: targetFormSchema,
      instruction: z.string().trim().max(500).optional(),
      question: z.string().trim().min(1).max(4000), correct_answer: answer, options,
      accepted_answers: z.array(answer).min(1).max(1).optional(),
      explanation: contentHintSchema,
    }).transform(content => ({ ...content, accepted_answers: content.accepted_answers ?? [content.correct_answer] })),
  }),
]).superRefine((value, context) => {
  if (value.type === 'fill_in_blank' && !`${value.content.text_before}${value.content.text_after}`.trim()
    && !Object.keys(value.translation_prompt ?? {}).length) {
    context.addIssue({ code: 'custom', message: 'A sentence or translated prompt is required', path: ['content', 'text_before'] })
  }
  const normalized = value.content.options.map(normalizeGrammarAnswer)
  if (new Set(normalized).size !== normalized.length) {
    context.addIssue({ code: 'custom', message: 'Answers must be distinct', path: ['content', 'options'] })
  }
  if (!normalized.includes(normalizeGrammarAnswer(value.content.correct_answer))) {
    context.addIssue({ code: 'custom', message: 'Correct answer must be available', path: ['content', 'correct_answer'] })
  }
  if (value.content.accepted_answers) {
    const answers = value.content.accepted_answers.map(normalizeGrammarAnswer)
    if (new Set(answers).size !== answers.length) {
      context.addIssue({ code: 'custom', message: 'Accepted answers must be distinct', path: ['content', 'accepted_answers'] })
    }
    if (!answers.includes(normalizeGrammarAnswer(value.content.correct_answer))) {
      context.addIssue({ code: 'custom', message: 'Accepted answers must include the correct answer', path: ['content', 'accepted_answers'] })
    }
  }
})
export type GrammarWriteInput = z.infer<typeof grammarWriteSchema>
export type GrammarExerciseRow = import('@/lib/learning-content').GrammarContentRow
export type GrammarSaveResult = { success: true; data: GrammarExerciseRow } | { success: false; error: 'invalid' | 'failed' }
export interface GrammarDeleteResult { success: boolean }
export interface GrammarLoadResult { data: GrammarExerciseRow[]; failed: boolean }

export function normalizeGrammarAnswer(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE')
}

export type ValidationResult = AnswerGrade

const normalizeSpacing = (value: string) => value.trim().replace(/\s+/g, ' ')
const withoutPunctuation = (value: string) => normalizeSpacing(value.replace(/[\p{P}\p{S}]/gu, ''))
const foldCase = (value: string) => value.toLocaleLowerCase('de-DE')
const expandUmlauts = (value: string) => value.replace(/[äöüßÄÖÜẞ]/g, letter => ({
  ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ẞ: 'SS',
})[letter]!)

function oneWordEdit(left: string, right: string): boolean {
  const a = Array.from(left)
  const b = Array.from(right)
  if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length >= b.length) i++
    if (b.length >= a.length) j++
  }
  return edits + (a.length - i) + (b.length - j) === 1
}

function isSingleWordTypo(input: string, accepted: string): boolean {
  // Keep punctuation and spacing identical; other soft differences cannot be combined.
  const wordPattern = /[\p{L}\p{N}]+/gu
  if (input.replace(wordPattern, '#') !== accepted.replace(wordPattern, '#')) return false
  const inputWords = input.match(wordPattern) ?? []
  const acceptedWords = accepted.match(wordPattern) ?? []
  if (inputWords.length !== acceptedWords.length) return false
  let changedWords = 0
  return inputWords.every((word, index) => {
    const target = acceptedWords[index]
    if (word === target) return true
    if (++changedWords > 1 || foldCase(word) === foldCase(target) || expandUmlauts(word) === expandUmlauts(target)) return false
    return oneWordEdit(word, target)
  }) && changedWords === 1
}

/** Non-authoritative preview only. Completion, scores and final feedback come from PostgreSQL. */
export function validateUserAnswer(userAnswer: string, acceptedAnswers: string[]): ValidationResult {
  const input = normalizeSpacing(userAnswer)
  if (!input) return { status: 'INCORRECT', matched: null, reason: null }
  const candidates = acceptedAnswers.map(matched => ({ matched, normalized: normalizeSpacing(matched) })).filter(answer => answer.normalized.length > 0)
  const exact = candidates.find(answer => answer.normalized === input)
  if (exact) return { status: 'EXACT', matched: exact.matched, reason: null }
  const rules: Array<[SoftErrorReason, (left: string, right: string) => boolean]> = [
    ['punctuation', (left, right) => withoutPunctuation(left) === withoutPunctuation(right)],
    ['capitalization', (left, right) => foldCase(left) === foldCase(right)],
    ['umlaut', (left, right) => expandUmlauts(left) === expandUmlauts(right)],
    ['typo', isSingleWordTypo],
  ]
  for (const [reason, matches] of rules) {
    const candidate = candidates.find(answer => input.length > 0 && matches(input, answer.normalized))
    if (candidate) return { status: 'SOFT_ERROR', matched: candidate.matched, reason }
  }
  return { status: 'INCORRECT', matched: null, reason: null }
}
