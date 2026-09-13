import { ACCESS_LEVELS } from '@/lib/access/levels'
import readingTexts from '@/supabase/seeds/pronunciation-reading-2026.json'
const getCatalogPrompts = (level: string) => readingTexts.filter(text => text.level === level).map(text => ({ id: text.id, level: text.level, title: text.title, sentenceDe: text.text, focus: text.focus }))
import { createPronunciationSubmissionSchema, pronunciationMessageSchema, pronunciationAudioObjectPath, isOwnedPronunciationAudio } from '@/lib/pronunciation-conversations'
import { getPronunciationTranslations, createPronunciationTranslator } from '@/lib/pronunciation-i18n'

const owner = '6aab2f11-3456-4234-8234-123456789012'
const other = '7aab2f11-3456-4234-8234-123456789012'
const path = `storage://pronunciation_audio/${owner}/2aab2f11-3456-4234-8234-123456789012.webm`
describe('private pronunciation message input', () => {
 it('accepts text, voice or their combination', () => {
  for (const value of [{ text: 'Danke! Wie betone ich das Wort?' }, { text: '', audioPath: path }, { text:'Hier ist meine neue Aufnahme.', audioPath:path }]) expect(pronunciationMessageSchema.safeParse({ submissionId:owner, ...value }).success).toBe(true)
 })
 it('rejects empty and oversized messages and arbitrary URLs', () => {
  for (const value of [{ text:'   ' }, { text:'x'.repeat(5001) }, { text:'', audioPath:'https://example.com/audio.webm' }, { text:'', audioPath:`storage://pronunciation_audio/${owner}/../recording.webm` }]) expect(pronunciationMessageSchema.safeParse({ submissionId:owner, ...value }).success).toBe(false)
 })
 it('recognizes only the authenticated owner of an immutable private recording', () => {
  expect(isOwnedPronunciationAudio(path,owner)).toBe(true)
  expect(isOwnedPronunciationAudio(path,other)).toBe(false)
  expect(pronunciationAudioObjectPath(path)).toBe(`${owner}/2aab2f11-3456-4234-8234-123456789012.webm`)
  expect(pronunciationAudioObjectPath(path.replace('/pronunciation_audio/','/public/'))).toBeNull()
 })
 it('requires a real prompt identifier for initial recording and discards caller snapshots', () => {
  expect(createPronunciationSubmissionSchema.safeParse({ promptId:'catalog:A1.1:1', audioPath:path }).success).toBe(false)
  expect(createPronunciationSubmissionSchema.parse({ promptId:owner, audioPath:path, userId:other, level:'B1.2', readingText:'forged' })).toEqual({ promptId:owner, audioPath:path })
 })
})
describe('authored reading curriculum', () => {
 it.each(ACCESS_LEVELS)('%s has ten unique complete texts with stable UUIDs and a focus', (level) => {
  const prompts = getCatalogPrompts(level)
  expect(prompts).toHaveLength(10)
  expect(new Set(prompts.map((item) => item.id)).size).toBe(10)
  expect(new Set(prompts.map((item) => item.sentenceDe)).size).toBe(10)
  for (const prompt of prompts) {
   expect(prompt.level).toBe(level)
   expect(prompt.title?.length).toBeGreaterThan(5)
   expect(prompt.sentenceDe.split(/[.!?]+/).filter((part) => part.trim()).length).toBeGreaterThanOrEqual(5)
   expect(prompt.sentenceDe.split(/\s+/).length).toBeGreaterThanOrEqual(30)
   expect(prompt.sentenceDe.length).toBeLessThanOrEqual(3000)
   expect(prompt.focus?.length).toBeGreaterThan(5)
   expect(createPronunciationSubmissionSchema.safeParse({ promptId:prompt.id, audioPath:path }).success).toBe(true)
  }
 })
 it('increases the amount of connected reading from A1 to B1', () => {
  const words = (level:string) => getCatalogPrompts(level).reduce((sum,prompt) => sum + prompt.sentenceDe.split(/\s+/).length,0)
  expect(words('B1.2')).toBeGreaterThan(words('A1.1') * 2)
 })
 it.each(['de','en','ru','uk','tr'])('provides the chat and CMS interface in %s', (lang) => {
  const t = createPronunciationTranslator(getPronunciationTranslations(lang))
  expect(t('send_message')).not.toBe('send_message')
  expect(t('cms_title')).not.toBe('cms_title')
  expect(t('words', {count:60})).toContain('60')
 })
})
