import { learningProgressSchema, type LearningProgress, type ProgressDay } from '@/lib/learning-progress'

export const progressStudentId = '00000000-0000-4000-8000-000000000001'

/** Leerer Tag eines Zeitraums (Berliner Kalendertag). */
export function progressDay(date: string, patch: Partial<{ [K in keyof ProgressDay]: Partial<ProgressDay[K]> }> = {}): ProgressDay {
  return {
    date,
    vocabulary: { answers: 0, correct: 0, learned: 0, seconds: 0, ...patch.vocabulary },
    focus: { answers: 0, correct: 0, ...patch.focus },
    path: { answers: 0, correct: 0, stations: 0, seconds: 0, ...patch.path },
    pronunciation: { recordings: 0, replies: 0, seconds: 0, ...patch.pronunciation },
    media: { views: 0, ...patch.media },
  }
}

/** RPC-Antwort von get_learning_progress (vor der zod-Umformung, mit `success`). */
export function progressPayload(days = 7, today = '2026-09-30', patch: (day: ProgressDay, index: number) => ProgressDay = day => day) {
  const end = new Date(`${today}T12:00:00Z`)
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(end.getTime() - (days - 1 - index) * 86400000).toISOString().slice(0, 10)
    return patch(progressDay(date), index)
  })
  return {
    success: true as const, studentId: progressStudentId, level: null, days, today, timezone: 'Europe/Berlin' as const, daily,
    vocabulary: { totalWords: 40, inBox: 12, learnedWords: 5, learnedTotal: 5, overallPercent: 31,
      buckets: [1, 2, 3, 4, 5, 6, 'learned'].map(key => ({ key, count: key === 'learned' ? 5 : key === 2 ? 7 : 0 })) },
    focus: { active: 2, due: 1, mastered: 1, articleWords: 1, words: [
      { cardId: '00000000-0000-4000-8000-000000000101', word: 'Tisch', article: 'der', level: 'A1.1', status: 'active', stage: 1, dueAt: '2026-10-01T22:00:00+00:00', due: false, wrongCount: 2, articleErrors: 2, practiceCount: 1, practiceCorrect: 1, masteredAt: null },
      { cardId: '00000000-0000-4000-8000-000000000102', word: 'Haus', article: 'das', level: 'A1.1', status: 'active', stage: 0, dueAt: '2026-09-29T10:00:00+00:00', due: true, wrongCount: 4, articleErrors: 0, practiceCount: 0, practiceCorrect: 0, masteredAt: null },
      { cardId: '00000000-0000-4000-8000-000000000103', word: 'Katze', article: 'die', level: 'A1.1', status: 'mastered', stage: 4, dueAt: null, due: false, wrongCount: 3, articleErrors: 0, practiceCount: 4, practiceCorrect: 4, masteredAt: '2026-09-28T10:00:00+00:00' },
    ] },
    path: { totalStations: 20, completedStations: 6, totalUnits: 4, completedUnits: 1,
      tests: [{ completedAt: '2026-09-29T10:00:00+00:00', percentage: 80, passed: true, title: 'Artikel-Test' }] },
    pronunciation: { totalTexts: 10, practicedTexts: 3, recordings: 4, awaitingReply: 1 },
    media: { totalMedia: 8, viewedMedia: 2, recent: [{ kind: 'video' as const, title: 'Begrüßung', viewedAt: '2026-09-30T08:00:00+00:00', views: 2 }] },
  }
}

/** Dieselben Daten, wie sie die Server-Action nach der Prüfung liefert. */
export function progressData(...args: Parameters<typeof progressPayload>): LearningProgress {
  return learningProgressSchema.parse(progressPayload(...args))
}
