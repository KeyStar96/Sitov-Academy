import type { DailyQuest, DailyQuestStreak } from '@/lib/daily-quest-contract'

export const dailyQuestFixture: DailyQuest = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', date: '2026-10-02', status: 'active', level: 'A1',
  templateKey: 'bakery-a1', title: 'Beim Bäcker', subtitle: 'Ein kurzer Start in den Alltag.',
  scene: { backgroundKey: 'bakery', backgroundImage: '/Bilder/deutschreise/bakery-scene.png', imageAlt: 'Bäckerei mit Brot und freundlicher Verkäuferin.',
    location: 'Bäckerei', audioText: 'Guten Morgen! Was darf es sein?', speakerId: 'anna',
    characters: [{ id: 'anna', name: 'Anna', voice: 'female' }] },
  personalization: { source: 'fallback', cardId: null },
  steps: [
    { id: 'discover', kind: 'discover', instruction: 'Entdecke die Wörter.', words: [
      { id: 'bread', text: 'das Brot', audioText: 'Das Brot.' },
      { id: 'coffee', text: 'der Kaffee', audioText: 'Der Kaffee.' },
    ] },
    { id: 'build', kind: 'sentence_build', speakerId: 'anna', prompt: 'Bestelle freundlich.', pieces: [
      { id: 'i', text: 'Ich' }, { id: 'want', text: 'möchte' }, { id: 'bread', text: 'ein Brot.' },
    ], audioText: 'Ich möchte ein Brot.' },
    { id: 'dialogue', kind: 'dialogue_choice', speakerId: 'anna', prompt: 'Möchten Sie eine Tüte?',
      options: [{ id: 'yes', text: 'Ja, bitte.' }, { id: 'morning', text: 'Guten Morgen.' }], audioText: 'Möchten Sie eine Tüte?' },
  ], completedStepIds: [], completion: { title: 'Geschafft!', text: 'Dein Reisestempel ist da.' },
}

export const dailyQuestStreakFixture: DailyQuestStreak = { current: 2, longest: 5, lastCompletedDate: '2026-10-01' }
