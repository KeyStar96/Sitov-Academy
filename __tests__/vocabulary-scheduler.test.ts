import { scheduleVocabularyCards } from '@/lib/vocabulary-scheduler'

const card = (id: string, direction: string) => ({ card: { id }, direction })
it('interleaves two independent directions without changing the input', () => {
  const input = [card('a', 'de'), card('a', 'ru'), card('b', 'de'), card('b', 'ru')]
  const result = scheduleVocabularyCards(input)
  expect(result.cards.map(item => item.card.id)).toEqual(['a', 'b', 'a', 'b'])
  expect(result.deferredCount).toBe(0)
  expect(input.map(item => item.card.id)).toEqual(['a', 'a', 'b', 'b'])
})
it('defers a singleton reverse direction and respects the previous session boundary', () => {
  const input = [card('a', 'de'), card('a', 'ru')]
  expect(scheduleVocabularyCards(input).deferredCount).toBe(1)
  expect(scheduleVocabularyCards(input, 'a')).toEqual({ cards: [], deferredCount: 2 })
})
it('preserves every item when a skewed queue can be separated', () => {
  const input = [card('b', 'de'), card('a', 'de'), card('a', 'ru'), card('a', 'sentence'), card('c', 'de')]
  const result = scheduleVocabularyCards(input)
  expect(result.cards.map(item => item.card.id)).toEqual(['a', 'b', 'a', 'c', 'a'])
  expect(result.deferredCount).toBe(0)
})
it('never places identical word IDs next to each other for varied queue sizes', () => {
  for (let words = 1; words <= 8; words++) {
    for (let copies = 1; copies <= 5; copies++) {
      const input = Array.from({ length: words }, (_, n) => Array.from({ length: copies }, (_, c) => card(String(n), String(c)))).flat()
      const result = scheduleVocabularyCards(input, '0')
      expect(result.cards[0]?.card.id).not.toBe('0')
      result.cards.forEach((item, index) => {
        if (index) expect(item.card.id).not.toBe(result.cards[index - 1].card.id)
      })
      expect(new Set(result.cards).size).toBe(result.cards.length)
      expect(result.cards.length + result.deferredCount).toBe(input.length)
    }
  }
})
