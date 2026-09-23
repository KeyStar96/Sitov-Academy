import { z } from 'zod'

export const PRIVATE_PRONUNCIATION_BUCKET = 'pronunciation_audio'
const audioReferencePattern = /^storage:\/\/pronunciation_audio\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webm|mp4|ogg|wav|mp3)$/i
export const pronunciationAudioSchema = z.string().max(240).regex(audioReferencePattern)
export const createPronunciationSubmissionSchema = z.object({ promptId: z.uuid(), audioPath: pronunciationAudioSchema })
export const pronunciationMessageSchema = z.object({
  submissionId: z.uuid(), text: z.string().trim().max(5000), audioPath: pronunciationAudioSchema.nullable().optional(),
}).refine((value) => value.text.length > 0 || Boolean(value.audioPath))
export type CreatePronunciationSubmissionInput = z.infer<typeof createPronunciationSubmissionSchema>
export type SendPronunciationMessageInput = z.infer<typeof pronunciationMessageSchema>
export interface PronunciationMutationResult { success: boolean; id?: string; reason?: 'not_authenticated' | 'invalid_input' | 'save_failed' }
export interface PronunciationMessage {
  id: string; senderRole: 'student' | 'teacher' | 'admin'; text: string; audioUrl: string | null; createdAt: string; unseen: boolean;
  /** Anzeigename der antwortenden Lehrkraft (nur in der Ansicht der Lernenden, Migration 24). */
  senderName?: string | null;
}
export interface PronunciationConversation {
  id: string; level: string; title: string | null; readingText: string | null; status: string;
  /** Vorgelesener Text; ordnet das Gespräch im Sprechstudio seinem Text zu. */
  promptId?: string | null;
  studentName: string | null; studentEmail: string | null; createdAt: string; messages: PronunciationMessage[]; hasUnseen: boolean;
}
export function pronunciationAudioObjectPath(reference: string): string | null {
  return pronunciationAudioSchema.safeParse(reference).success ? reference.slice('storage://pronunciation_audio/'.length) : null
}
export function isOwnedPronunciationAudio(reference: string, userId: string): boolean {
  return pronunciationAudioObjectPath(reference)?.startsWith(`${userId}/`) ?? false
}
