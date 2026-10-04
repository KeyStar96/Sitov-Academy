/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })

import { readFileSync } from 'node:fs'
import { dailyQuestFixture } from './fixtures/daily-quest'
import { dailyQuestSchema, type DailyQuest, type DailyQuestStep } from '@/lib/daily-quest-contract'
import { localizeSitovDailyQuest, localizeSitovDailyQuestFeedback, localizeSitovDailyQuestStepResult } from '@/lib/sitov-daily-quest-localization'
import { getSitovDailyQuestPresentationCopy } from '@/lib/sitov-daily-quest-presentation'
import sitovA1 from '@/content/daily-quests/sitov-a1.json'
import sitovA2 from '@/content/daily-quests/sitov-a2.json'
import sitovB1 from '@/content/daily-quests/sitov-b1.json'
import sitovB2 from '@/content/daily-quests/sitov-b2.json'
import sitovRoles from '@/content/daily-quests/sitov-question-roles.json'
import sitovEn from '@/content/daily-quests/locales/sitov-en.json'
import sitovRu from '@/content/daily-quests/locales/sitov-ru.json'
import sitovUk from '@/content/daily-quests/locales/sitov-uk.json'
import sitovTr from '@/content/daily-quests/locales/sitov-tr.json'

const sitovRows = [ ...sitovA1.map(row => ({ ...row, key: `sitov-a1-${row.slug}` })), ...sitovA2.map(row => ({ ...row, key: `sitov-a2-${row.slug}` })),
  ...sitovB1.map(row => ({ ...row, key: `sitov-b1-${row.slug}` })), ...sitovB2.map(row => ({ ...row, key: `sitov-b2-${row.slug}` })) ]
const sitovLocales = { en: sitovEn, ru: sitovRu, uk: sitovUk, tr: sitovTr }
const sitovBuild = dailyQuestFixture.steps[1] as Extract<DailyQuestStep, { kind: 'sentence_build' }>
const sitovDialogue = dailyQuestFixture.steps[2] as Extract<DailyQuestStep, { kind: 'dialogue_choice' }>
const sitovQuest = (row: typeof sitovRows[number]): DailyQuest => ({ ...dailyQuestFixture, templateKey: row.key, subtitle: row.goal,
  scene: { ...dailyQuestFixture.scene, location: 'Supermarkt', audioText: row.intro },
  steps: [ dailyQuestFixture.steps[0], { ...sitovBuild, prompt: `${row.goal} Setze den Satz zusammen.` },
    { ...sitovDialogue, prompt: row.question, audioText: row.intro } ],
})

it('requires a reviewed question role for every authored template', () => {
  expect(Object.keys(sitovRoles).sort()).toEqual(sitovRows.map(row => row.key).sort())
  expect(new Set(Object.values(sitovRoles))).toEqual(new Set(['instruction', 'german']))
})

it.each(Object.entries(sitovLocales))('has complete, distinct %s directions and explanation translations for all 400 quests', (locale, translations) => {
  expect(Object.keys(translations).sort()).toEqual(sitovRows.map(row => row.key).sort())
  for (const row of sitovRows) {
    const translation = (translations as Record<string, { goal: string; focus: string; explanation: string; question: string }>)[row.key]
    expect(Object.keys(translation).sort()).toEqual(['explanation', 'focus', 'goal', 'question'])
    for (const field of ['goal', 'focus', 'explanation', 'question'] as const) {
      expect(translation[field].trim()).toBe(translation[field])
      expect(translation[field].length).toBeGreaterThan(0)
      expect(translation[field]).not.toBe(row[field])
    }
    const original = sitovQuest(row)
    const before = JSON.stringify(original)
    const localized = localizeSitovDailyQuest(original, locale)
    expect(dailyQuestSchema.safeParse(localized).success).toBe(true)
    expect(JSON.stringify(original)).toBe(before)
    expect(localized.subtitle).toBe(translation.goal)
    expect(localized.scene.audioText).toBe(original.scene.audioText)
    expect(localized.steps.map(step => step.id)).toEqual(original.steps.map(step => step.id))
    expect(localized.completedStepIds).toEqual(original.completedStepIds)
    expect(localized.personalization).toEqual(original.personalization)
    expect(localized).not.toHaveProperty('explanation')
    const prompt = localized.steps[2]
    if (prompt.kind !== 'dialogue_choice') throw new Error('dialogue fixture missing')
    expect(prompt.prompt).toBe((sitovRoles as Record<string, string>)[row.key] === 'instruction' ? translation.question : row.question)
    expect(prompt.sitovPromptLocale).toBe((sitovRoles as Record<string, string>)[row.key] === 'instruction' ? locale : 'de')
  }
})

it.each(['en', 'ru', 'uk', 'tr'])('preserves the full German exercises and frozen state in %s', locale => {
  const original = { ...sitovQuest(sitovRows[0]), completedStepIds: ['discover'], status: 'completed' as const }
  const translated = localizeSitovDailyQuest(original, locale)
  expect(translated.id).toBe(original.id)
  expect(translated.status).toBe('completed')
  expect(translated.completedStepIds).toEqual(['discover'])
  for (const [index, step] of original.steps.entries()) {
    const localized = translated.steps[index]
    if (step.kind === 'discover' && localized.kind === 'discover') expect(localized.words).toEqual(step.words)
    if (step.kind === 'sentence_build' && localized.kind === 'sentence_build') {
      expect(localized.pieces).toEqual(step.pieces); expect(localized.audioText).toBe(step.audioText)
    }
    if (step.kind === 'dialogue_choice' && localized.kind === 'dialogue_choice') {
      expect(localized.options).toEqual(step.options); expect(localized.audioText).toBe(step.audioText)
    }
  }
})

it('retains an actual B1 character question in German, while localizing B2 constraints in full', () => {
  const b1 = sitovRows.find(row => row.key === 'sitov-b1-joghurt-zurueckgeben')!
  const b2 = sitovRows.find(row => row.key === 'sitov-b2-lieferung-vorbehalt')!
  expect(localizeSitovDailyQuest(sitovQuest(b1), 'en').steps[2]).toMatchObject({ prompt: b1.question, sitovPromptLocale: 'de' })
  expect(localizeSitovDailyQuest(sitovQuest(b2), 'en').steps[2]).toMatchObject({ prompt: sitovEn[b2.key as keyof typeof sitovEn].question, sitovPromptLocale: 'en' })
})

it.each(['en', 'ru', 'uk', 'tr'])('localizes correct explanations and wrong grammar hints only after grading (%s)', locale => {
  const row = sitovRows[0], quest = sitovQuest(row)
  const translated = (sitovLocales[locale as keyof typeof sitovLocales] as Record<string, { explanation: string; focus: string }>)[row.key]
  const feedback = `Der Satz passt. ${row.explanation}`
  expect(localizeSitovDailyQuestFeedback(quest, 'build', true, feedback, locale)).toContain(translated.explanation)
  expect(localizeSitovDailyQuestFeedback(quest, 'build', false, `Prüfe die Reihenfolge. Achte auf: ${row.focus}.`, locale)).toContain(translated.focus)
  const result = localizeSitovDailyQuestStepResult({ success: true, quest, feedback, correct: true, streak: { current: 2, longest: 4, lastCompletedDate: null } }, 'build', locale)
  expect(result.feedback).toContain(translated.explanation)
  expect(result.streak).toEqual({ current: 2, longest: 4, lastCompletedDate: null })
  expect(result.quest).not.toHaveProperty('answerKey')
})

it('does not apply current explanations to a different frozen source version', () => {
  const quest = sitovQuest(sitovRows[0])
  expect(localizeSitovDailyQuestFeedback(quest, 'build', true, 'Der Satz passt. Eine ältere Erklärung.', 'en')).toBe('The sentence fits.')
  expect(localizeSitovDailyQuest({ ...quest, subtitle: 'Ein früheres Lernziel.' }, 'en').subtitle).toBe(getSitovDailyQuestPresentationCopy('en').goal)
})

it('keeps German interface content unchanged and handles all six starters', () => {
  expect(localizeSitovDailyQuest(dailyQuestFixture, 'de')).toBe(dailyQuestFixture)
  for (const templateKey of ['sitov-bakery-breakfast', 'sitov-picnic-plan', 'sitov-order-change', 'sitov-catering-alternative', 'sitov-local-sourcing', 'sitov-menu-deliberation']) {
    const quest = localizeSitovDailyQuest({ ...dailyQuestFixture, templateKey }, 'uk')
    expect(quest.subtitle).not.toBe(dailyQuestFixture.subtitle)
    expect(quest.steps[2]).toMatchObject({ prompt: 'Möchten Sie eine Tüte?', sitovPromptLocale: 'de' })
  }
})

it('keeps authoring sources and grading translations behind server-only, never in the engine', () => {
  const serverSource = readFileSync('lib/sitov-daily-quest-localization.ts', 'utf8')
  expect(serverSource).toMatch(/^import 'server-only'/)
  for (const file of ['components/daily-quest/DailyQuestEngine.tsx', 'lib/sitov-daily-quest-presentation.ts']) {
    const source = readFileSync(file, 'utf8')
    expect(source).not.toContain('content/daily-quests/')
    expect(source).not.toContain('sitov-daily-quest-localization')
  }
})


it('uses UI directions for an old frozen instructional prompt without applying a different current question', () => {
  const original = sitovQuest(sitovRows[0])
  const old = { ...original, steps: original.steps.map(step => step.kind === 'dialogue_choice' ? { ...step, prompt: 'Antworte dem Verkäufer.' } : step) }
  expect(localizeSitovDailyQuest(old, 'en').steps[2]).toMatchObject({ prompt: getSitovDailyQuestPresentationCopy('en').dialogue, sitovPromptLocale: 'en' })
})
