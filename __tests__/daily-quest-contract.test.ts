/** @jest-environment node */
import { dailyQuestPreviewSchema, dailyQuestSchema } from '@/lib/daily-quest-contract'
import { dailyQuestFixture } from './fixtures/daily-quest'

it('accepts male characters and the versioned male bakery image', () => {
  expect(dailyQuestSchema.parse(dailyQuestFixture)).toEqual(dailyQuestFixture)
})

it.each(['female', 'other', undefined])('rejects an authored character voice of %s in student and staff payloads', voice => {
  const quest = { ...dailyQuestFixture, scene: { ...dailyQuestFixture.scene,
    characters: dailyQuestFixture.scene.characters.map(character => ({ ...character, voice })),
  } }
  expect(dailyQuestSchema.safeParse(quest).success).toBe(false)
  expect(dailyQuestPreviewSchema.safeParse({ success: true, quest, answerKey: { steps: {} } }).success).toBe(false)
})
