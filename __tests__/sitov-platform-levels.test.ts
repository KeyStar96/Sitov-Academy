import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ACCESS_LEVELS, SITOV_PLATFORM_LEVELS, SITOV_UPCOMING_LEVELS, getAllowedLessons, hasConfiguredTrainerAccess, hasLevelAccess,
  hasTrainerAccess, isAccessLevel, isSitovPlatformLevel, sanitizeAllowedLevels, sitovLevelCopyKeys, TRAINERS,
} from '@/lib/access/levels'
import { grammarWriteSchema } from '@/lib/grammar-validation'
import { pathLevelSchema } from '@/lib/learning-path-contract'
import { learningPathSeedSchema } from '@/lib/learning-path-schema'

/**
 * B2.1, B2.2, C1.1 und C1.2 stehen als Grundstruktur bereit (Migration 85), sind aber nicht
 * freigegeben: Lernende sehen und erhalten sie nicht, Lehrkräfte können Inhalte vorbereiten.
 */
const LOCALES = ['de', 'en', 'ru', 'uk', 'tr'] as const
const dictionary = (locale: string) => JSON.parse(readFileSync(join(__dirname, `../dictionaries/${locale}.json`), 'utf8')).dashboard as Record<string, string>

describe('Sitov platform levels', () => {
  it('lists the released levels first, then the levels in preparation', () => {
    expect([...SITOV_UPCOMING_LEVELS]).toEqual(['B2.1', 'B2.2', 'C1.1', 'C1.2'])
    expect([...SITOV_PLATFORM_LEVELS]).toEqual([...ACCESS_LEVELS, ...SITOV_UPCOMING_LEVELS])
    expect(new Set(SITOV_PLATFORM_LEVELS).size).toBe(SITOV_PLATFORM_LEVELS.length)
    for (const level of SITOV_UPCOMING_LEVELS) {
      expect(isSitovPlatformLevel(level)).toBe(true)
      expect(isAccessLevel(level)).toBe(false)
    }
    for (const value of ['B2', 'C1', 'C2.1', 'b2.1', '', null, 7]) expect(isSitovPlatformLevel(value)).toBe(false)
  })

  it('keeps levels in preparation away from learners, even with a stored grant', () => {
    const learner = { role: 'student', ui_language: 'ru', allowed_levels: ['A1.1', ...SITOV_UPCOMING_LEVELS],
      trainer_grants: SITOV_UPCOMING_LEVELS.flatMap(level => TRAINERS.map(trainer => ({ level, trainer, enabled: true }))) }
    expect(sanitizeAllowedLevels(learner.allowed_levels)).toEqual(['A1.1'])
    expect(hasLevelAccess(learner, 'A1.1')).toBe(true)
    for (const level of SITOV_UPCOMING_LEVELS) {
      expect(hasLevelAccess(learner, level)).toBe(false)
      for (const trainer of TRAINERS) {
        expect(hasConfiguredTrainerAccess(learner, level, trainer)).toBe(false)
        expect(hasTrainerAccess(learner, level, trainer)).toBe(false)
        expect(getAllowedLessons(learner, level, trainer)).toEqual([])
      }
      // The learner boundary of the learning path refuses the level before any query.
      expect(pathLevelSchema.safeParse(level).success).toBe(false)
    }
  })

  it('lets staff work with every platform level', () => {
    for (const role of ['teacher', 'admin']) for (const level of SITOV_PLATFORM_LEVELS) {
      expect(hasLevelAccess({ role, allowed_levels: [] }, level)).toBe(true)
      expect(hasTrainerAccess({ role, allowed_levels: [] }, level, 'exercises')).toBe(true)
    }
  })

  it('names every platform level in all interface languages', () => {
    for (const locale of LOCALES) {
      const copy = dictionary(locale)
      for (const level of SITOV_PLATFORM_LEVELS) {
        const [title, description] = sitovLevelCopyKeys(level)
        expect(copy[title]).toMatch(new RegExp(`^${level.replace('.', '\\.')} \\S`))
        expect(copy[description]?.trim().length).toBeGreaterThan(20)
      }
    }
    expect(sitovLevelCopyKeys('B2.1')).toEqual(['level_b21_title', 'level_b21_desc'])
    // Jede Sprache hat eigene Texte für die neuen Niveaus.
    for (const level of SITOV_UPCOMING_LEVELS) {
      const [, description] = sitovLevelCopyKeys(level)
      expect(new Set(LOCALES.map(locale => dictionary(locale)[description])).size).toBe(LOCALES.length)
    }
  })

  it('accepts authored content for levels in preparation', () => {
    const [source] = JSON.parse(readFileSync(join(__dirname, '../supabase/seeds/path-a1.2.json'), 'utf8'))
    const moved = (level: string) => [{ ...source, level, unit: { ...source.unit, level } }]
    for (const level of SITOV_PLATFORM_LEVELS) expect(learningPathSeedSchema.safeParse(moved(level)).success).toBe(true)
    for (const level of ['B2', 'C1', 'C2.1']) expect(learningPathSeedSchema.safeParse(moved(level)).success).toBe(false)
    const exercise = (level: string) => ({ level, lesson: 'Probe', topic: 'Probe', type: 'multiple_choice', solution_audio_url: null,
      content: { target_form: ['Form'], question: 'Was passt?', correct_answer: 'das', options: ['das', 'der', 'die'] } })
    for (const level of SITOV_PLATFORM_LEVELS) expect(grammarWriteSchema.safeParse(exercise(level)).success).toBe(true)
    expect(grammarWriteSchema.safeParse(exercise('B2')).success).toBe(false)
  })
})
