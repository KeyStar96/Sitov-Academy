import { hasSitovCommercialItemAccess, sitovTrialManifestSchema, type SitovAccessContext, type SitovCanonicalItem } from '@/lib/access/sitov-commercial'

const unit = '00000000-0000-4000-8000-000000000001'
const profile: SitovAccessContext = { user_id: 'student', role: 'student', allowed_levels: [], vip_enabled: false,
  trial: { version: 1, rules: [] }, purchased_levels: [], revision: 0 }
const item: SitovCanonicalItem = { kind: 'reading_text', id: 'text-1', level: 'A1.1', trainer: 'pronunciation', unit_id: unit, published: true }
const permits = (patch: Partial<SitovAccessContext>, target = item) => hasSitovCommercialItemAccess({ ...profile, ...patch }, target)

test('VIP remains a student entitlement and pure guard has no pedagogical test bypass', () => {
  expect(permits({ vip_enabled: true })).toBe(true)
  expect(profile.role).toBe('student')
  expect(permits({ vip_enabled: true }, { ...item, published: false })).toBe(false)
  expect(permits({ vip_enabled: true }, { ...item, owner_user_id: 'other' })).toBe(false)
})
test.each(['de', 'en', 'ru', 'uk', 'tr'])('commercial rights do not depend on %s interface', ui_language => {
  expect(permits({ ui_language, allowed_levels: ['A1.1'] })).toBe(true)
})
test('manual all/none/selected and level-only uploaded media remain distinct', () => {
  for (const [unit_ids, expected] of [[null, true], [[], false], [[unit], true], [['other'], false]] as const) {
    expect(permits({ allowed_levels: ['A1.1'], trainer_grants: [{ level: 'A1.1', trainer: 'pronunciation', enabled: true, unit_ids: unit_ids === null ? null : [...unit_ids] }] })).toBe(expected)
  }
  expect(permits({ allowed_levels: ['A1.1'], trainer_grants: [{ level: 'A1.1', trainer: 'videos', enabled: false }] },
    { ...item, kind: 'video', trainer: 'videos', legacy_level_media: true })).toBe(false)
  expect(permits({ allowed_levels: ['A1.1'], trainer_grants: [{ level: 'A1.1', trainer: 'videos', enabled: true, unit_ids: [] }] },
    { ...item, kind: 'video', trainer: 'videos', legacy_level_media: true })).toBe(true)
})
test('trial all/none/selected items never opens sibling content or private own words', () => {
  const trial = (refs: null | { kind: 'reading_text'; id: string }[]) => ({ version: 1 as const, rules: [{ level: 'A1.1' as const,
    trainer: 'pronunciation' as const, unit_ids: [unit], items: [{ unit_id: unit, refs }] }] })
  expect(permits({ trial: trial(null) })).toBe(true)
  expect(permits({ trial: trial([]) })).toBe(false)
  expect(permits({ trial: trial([{ kind: 'reading_text', id: item.id }]) })).toBe(true)
  expect(permits({ trial: trial([{ kind: 'reading_text', id: item.id }]) }, { ...item, id: 'sibling' })).toBe(false)
  expect(permits({ trial: trial(null) }, { ...item, owner_user_id: 'student' })).toBe(false)
})
test('VIP/trial revocation and payment-off do not erase independent purchased/manual rights', () => {
  expect(permits({ vip_enabled: false, purchased_levels: ['A1.1'] })).toBe(true)
  expect(permits({ vip_enabled: false, allowed_levels: ['A1.1'] })).toBe(true)
  expect(permits({ vip_enabled: false })).toBe(false)
})
test('manifest rejects malformed, duplicate and absent trainer scopes', () => {
  expect(sitovTrialManifestSchema.safeParse({ version: 1, rules: [{ level: 'C1.1', trainer: 'verbs', unit_ids: null, items: null }] }).success).toBe(false)
  const rule = { level: 'A1.1', trainer: 'pronunciation', unit_ids: [unit], items: [] }
  expect(sitovTrialManifestSchema.safeParse({ version: 1, rules: [rule, rule] }).success).toBe(false)
  expect(sitovTrialManifestSchema.safeParse({ version: 1, rules: [], vip_enabled: true }).success).toBe(false)
})
