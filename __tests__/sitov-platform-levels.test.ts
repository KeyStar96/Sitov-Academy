import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ACCESS_LEVELS, SITOV_PLATFORM_LEVELS, SITOV_UPCOMING_LEVELS, getAllowedLessons, hasConfiguredTrainerAccess, hasLevelAccess,
  hasTrainerAccess, isAccessLevel, isSitovPlatformLevel, sanitizeAllowedLevels, sitovLevelCopyKeys, sitovLevelHasTrainer,
  sitovLevelRange, sitovLevelTrainers, TRAINERS,
} from '@/lib/access/levels'
import { grammarWriteSchema } from '@/lib/grammar-validation'
import { pathLevelSchema } from '@/lib/learning-path-contract'
import { learningPathSeedSchema } from '@/lib/learning-path-schema'
import { LEARNING_MODES, sitovLevelModes } from '@/lib/mode-targets'
import { SITOV_VERB_CATALOG, getSitovVerbCatalog, getSitovVerbTenses } from '@/lib/verbs/catalog'
import { SITOV_VERB_LEVELS, SITOV_VERB_REVIEW_LEVELS } from '@/lib/verbs/types'

/**
 * B2.1, B2.2, C1.1 und C1.2 sind seit Migration 86 freigegeben: Lernende sehen sie auf Home und
 * erhalten sie über die Niveau-Freigabe der Lehrkraft. C1.1 und C1.2 haben keinen Verbtrainer.
 */
const LOCALES = ['de', 'en', 'ru', 'uk', 'tr'] as const
const UPPER = ['B2.1', 'B2.2', 'C1.1', 'C1.2'] as const
const dictionary = (locale: string) => JSON.parse(readFileSync(join(__dirname, `../dictionaries/${locale}.json`), 'utf8')).dashboard as Record<string, string>

describe('Sitov platform levels', () => {
  it('releases A1.1 to C1.2 in learning order; nothing is in preparation', () => {
    expect([...ACCESS_LEVELS]).toEqual(['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', ...UPPER])
    expect([...SITOV_UPCOMING_LEVELS]).toEqual([])
    expect([...SITOV_PLATFORM_LEVELS]).toEqual([...ACCESS_LEVELS, ...SITOV_UPCOMING_LEVELS])
    expect(new Set(SITOV_PLATFORM_LEVELS).size).toBe(SITOV_PLATFORM_LEVELS.length)
    expect(sitovLevelRange()).toBe('A1—C1')
    for (const level of UPPER) {
      expect(isSitovPlatformLevel(level)).toBe(true)
      expect(isAccessLevel(level)).toBe(true)
      // The learner boundary of the learning path accepts the level.
      expect(pathLevelSchema.safeParse(level).success).toBe(true)
    }
    for (const value of ['B2', 'C1', 'C2.1', 'b2.1', '', null, 7]) {
      expect(isSitovPlatformLevel(value)).toBe(false)
      expect(isAccessLevel(value)).toBe(false)
    }
  })

  it('opens a new level only with a grant, like every other level', () => {
    const learner = { role: 'student', ui_language: 'ru', allowed_levels: ['A1.1', 'B2.1', 'C1.2', 'B2', 'C2.1'] }
    expect(sanitizeAllowedLevels(learner.allowed_levels)).toEqual(['A1.1', 'B2.1', 'C1.2'])
    for (const level of ['A1.1', 'B2.1', 'C1.2']) expect(hasLevelAccess(learner, level)).toBe(true)
    // No grant, a coarse verb context or an unknown level: closed, also by direct link.
    for (const level of ['B1.2', 'B2.2', 'C1.1', 'B2', 'C1', 'C2.1']) {
      expect(hasLevelAccess(learner, level)).toBe(false)
      for (const trainer of TRAINERS) {
        expect(hasTrainerAccess(learner, level, trainer)).toBe(false)
        expect(getAllowedLessons(learner, level, trainer)).toEqual([])
      }
    }
    for (const trainer of TRAINERS) expect(hasTrainerAccess(learner, 'B2.1', trainer)).toBe(true)
    // A teacher's switch for one trainer still closes it.
    const restricted = { ...learner, trainer_grants: [{ level: 'B2.1', trainer: 'pronunciation', enabled: false }] }
    expect(hasTrainerAccess(restricted, 'B2.1', 'pronunciation')).toBe(false)
    expect(hasTrainerAccess(restricted, 'B2.1', 'exercises')).toBe(true)
  })

  it('has no verb trainer on C1.1 and C1.2 – for nobody, whatever is stored', () => {
    const learner = { role: 'student', ui_language: 'en', allowed_levels: [...UPPER],
      trainer_grants: UPPER.map(level => ({ level, trainer: 'verbs', enabled: true })) }
    for (const level of ['C1.1', 'C1.2']) {
      expect(sitovLevelHasTrainer(level, 'verbs')).toBe(false)
      expect(sitovLevelTrainers(level)).toEqual(['vocabulary', 'exercises', 'pronunciation', 'videos'])
      expect(sitovLevelModes(level)).toEqual(['vocabulary', 'path', 'pronunciation', 'media'])
      for (const profile of [learner, { role: 'teacher', allowed_levels: [] }, { role: 'admin', allowed_levels: [] }]) {
        expect(hasConfiguredTrainerAccess(profile, level, 'verbs')).toBe(false)
        expect(hasTrainerAccess(profile, level, 'verbs')).toBe(false)
        expect(getAllowedLessons(profile, level, 'verbs')).toEqual([])
      }
      for (const trainer of sitovLevelTrainers(level)) expect(hasTrainerAccess(learner, level, trainer)).toBe(true)
    }
    // Every other level keeps all five trainers and modes; the coarse verb contexts are untouched.
    for (const level of ['A1.1', 'B1.2', 'B2.1', 'B2.2']) {
      expect(sitovLevelTrainers(level)).toEqual([...TRAINERS])
      expect(sitovLevelModes(level)).toEqual([...LEARNING_MODES])
      expect(hasTrainerAccess(learner, level, 'verbs')).toBe(level.startsWith('B2'))
    }
    expect(hasTrainerAccess({ role: 'teacher', allowed_levels: [] }, 'C1', 'verbs')).toBe(true)
  })

  it('repeats every earlier verb on B2.1 and B2.2 without verbs of their own', () => {
    expect([...SITOV_VERB_LEVELS]).toEqual(['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B2.1', 'B2.2', 'B2', 'C1'])
    expect([...SITOV_VERB_REVIEW_LEVELS]).toEqual(['B2.1', 'B2.2'])
    const upToB1 = getSitovVerbCatalog('B1.2')
    for (const level of SITOV_VERB_REVIEW_LEVELS) {
      expect(getSitovVerbCatalog(level).map(verb => verb.id)).toEqual(upToB1.map(verb => verb.id))
      expect(getSitovVerbTenses(level)).toEqual(['present', 'perfect', 'past'])
      expect(SITOV_VERB_CATALOG.some(verb => verb.level === level)).toBe(false)
    }
    // The stored coarse context still adds its own verbs behind the sublevels.
    expect(getSitovVerbCatalog('B2').length).toBeGreaterThan(upToB1.length)
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
    for (const level of UPPER) {
      const [, description] = sitovLevelCopyKeys(level)
      expect(new Set(LOCALES.map(locale => dictionary(locale)[description])).size).toBe(LOCALES.length)
    }
  })

  it('accepts authored content for every platform level', () => {
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
