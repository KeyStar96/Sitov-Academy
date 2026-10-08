import { getAllowedLessons, hasLevelAccess, hasTrainerAccess, type LevelAccessProfile } from '@/lib/access/levels'
import { sitovLearningSourceLocale } from '@/lib/access/sitov-learning-source'

const unit = '00000000-0000-4000-8000-000000000001'
const profile: LevelAccessProfile = { role: 'student', allowed_levels: [], ui_language: 'de' }
test('trial level is a container and never opens unspecified sibling trainers', () => {
  const student: LevelAccessProfile = { ...profile, trial: { version: 1, rules: [{ level: 'A1.1', trainer: 'vocabulary',
    unit_ids: [unit], items: [{ unit_id: unit, refs: [{ kind: 'vocabulary_card', id: 'card' }] }] }] } }
  expect(hasLevelAccess(student, 'A1.1')).toBe(true)
  expect(hasTrainerAccess(student, 'unknown', 'vocabulary')).toBe(false)
  expect(hasTrainerAccess(student, 'A1.1', 'vocabulary')).toBe(true)
  expect(hasTrainerAccess(student, 'A1.1', 'pronunciation')).toBe(false)
  expect(getAllowedLessons(student, 'A1.1', 'vocabulary')).toEqual([unit])
})
test('source union preserves manual selection and independent VIP/purchased full scope', () => {
  const selected: LevelAccessProfile = { ...profile, allowed_levels: ['A1.1'], trainer_grants: [{ level: 'A1.1', trainer: 'vocabulary', enabled: true, unit_ids: [unit] }] }
  expect(getAllowedLessons(selected, 'A1.1', 'vocabulary')).toEqual([unit])
  expect(getAllowedLessons({ ...selected, vip_enabled: true }, 'A1.1', 'vocabulary')).toBeNull()
  expect(getAllowedLessons({ ...selected, purchased_levels: ['A1.1'] }, 'A1.1', 'vocabulary')).toBeNull()
  expect(getAllowedLessons({ ...selected, vip_enabled: false }, 'A1.1', 'vocabulary')).toEqual([unit])
})
test('empty trial item selection conveys no level/trainer access', () => {
  const student: LevelAccessProfile = { ...profile, trial: { version: 1, rules: [{ level: 'A1.1', trainer: 'vocabulary', unit_ids: [unit], items: [] }] } }
  expect(hasLevelAccess(student, 'A1.1')).toBe(false)
  expect(hasTrainerAccess(student, 'A1.1', 'vocabulary')).toBe(false)
})
test('German UI uses explicit stored supported source with no invented fallback', () => {
  expect(sitovLearningSourceLocale('de', 'ru')).toBe('ru')
  expect(sitovLearningSourceLocale('de', 'de')).toBeNull()
  expect(sitovLearningSourceLocale('de', null)).toBeNull()
  expect(sitovLearningSourceLocale('de', 'fr')).toBeNull()
  expect(sitovLearningSourceLocale('uk', 'ru')).toBe('uk')
})
