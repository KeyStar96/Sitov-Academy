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
      accepted_answers: z.array(z.string().trim().min(1)).min(1),
      gap_hint: z.string().trim().max(100).optional(),
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
  if (value.type === 'fill_in_blank') {
    const answers = [value.content.correct_answer, ...value.content.accepted_answers].map(normalizeGrammarAnswer)
    if (new Set(answers).size !== answers.length) {
      context.addIssue({ code: 'custom', message: 'Accepted answers must be distinct', path: ['content', 'accepted_answers'] })
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

export interface ValidationResult {
  status: 'EXACT' | 'SOFT_ERROR' | 'INCORRECT'
  warnings: string[]
  matchedAnswer: string | null
}

function normalizeForSoftMatch(text: string): string {
  // Remove all punctuation and normalize spaces, lowercase.
  return text
    .replace(/[.,?!;:()'"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('de-DE')
}

function replaceUmlauteWithBase(text: string): string {
  return text
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
}

export function validateUserAnswer(userAnswer: string, acceptedAnswers: string[]): ValidationResult {
  const trimmed = userAnswer.trim()
  
  // 1. EXACT match
  if (acceptedAnswers.includes(trimmed)) {
    return { status: 'EXACT', warnings: [], matchedAnswer: trimmed }
  }
  
  // 2. SOFT_ERROR match
  const userNormalized = normalizeForSoftMatch(trimmed)
  let bestMatch: string | null = null
  
  for (const answer of acceptedAnswers) {
    const answerNormalized = normalizeForSoftMatch(answer)
    if (userNormalized === answerNormalized) {
      bestMatch = answer
      break
    }
    
    // Check umlaut replacements
    if (replaceUmlauteWithBase(userNormalized) === replaceUmlauteWithBase(answerNormalized)) {
       bestMatch = answer
       break
    }
  }
  
  if (bestMatch) {
    const warnings: string[] = []
    
    // Determine specific warnings
    if (trimmed.toLocaleLowerCase('de-DE') !== bestMatch.toLocaleLowerCase('de-DE')) {
      // It's not just a case difference, could be punctuation or umlaute
      
      const userNoPunctEnd = trimmed.replace(/[.,?!]+$/, '')
      const matchNoPunctEnd = bestMatch.replace(/[.,?!]+$/, '')
      
      if (userNoPunctEnd === matchNoPunctEnd && trimmed !== bestMatch) {
        warnings.push('Achte auf das korrekte Satzzeichen am Ende des Satzes.')
      } 
      
      const userNoPunct = trimmed.replace(/[.,?!;:]/g, '')
      const matchNoPunct = bestMatch.replace(/[.,?!;:]/g, '')
      if (userNoPunct === matchNoPunct && userNoPunctEnd !== matchNoPunctEnd) {
         warnings.push('Achte auf die korrekte Kommasetzung im Satz.')
      }
      
      if (replaceUmlauteWithBase(userNormalized) === replaceUmlauteWithBase(normalizeForSoftMatch(bestMatch)) && userNormalized !== normalizeForSoftMatch(bestMatch)) {
         warnings.push('Nutze bitte echte deutsche Umlaute (ä, ö, ü, ß) statt Ersatzschreibweisen.')
      }
    }
    
    // Case warning
    if (trimmed.toLocaleLowerCase('de-DE') === bestMatch.toLocaleLowerCase('de-DE') && trimmed !== bestMatch) {
      warnings.push('Achte auf die Groß- und Kleinschreibung (z. B. Substantive und Satzanfänge groß schreiben).')
    } else if (warnings.length === 0) {
      // If we found a soft match but didn't catch the exact reason above, just add a generic case/punct warning
      warnings.push('Achte auf die genaue Schreibweise, Groß-/Kleinschreibung und Satzzeichen.')
    }

    return { status: 'SOFT_ERROR', warnings, matchedAnswer: bestMatch }
  }
  
  // 3. INCORRECT
  return { status: 'INCORRECT', warnings: [], matchedAnswer: null }
}
