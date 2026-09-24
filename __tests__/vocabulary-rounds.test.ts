import { countRounds, parseRoundSize, roundLimit, takeRound, DEFAULT_ROUND_SIZE } from '@/lib/vocabulary-rounds'

const card = (id: string) => ({ card: { id } })

describe('Lernrunden', () => {
  it('accepts only the offered round sizes and falls back to the small default', () => {
    expect(parseRoundSize('30')).toBe(30)
    expect(parseRoundSize(50)).toBe(50)
    expect(parseRoundSize('all')).toBe('all')
    expect(parseRoundSize('25')).toBe(DEFAULT_ROUND_SIZE)
    expect(parseRoundSize(null)).toBe(DEFAULT_ROUND_SIZE)
    expect(DEFAULT_ROUND_SIZE).toBe(20)
  })

  it('splits today’s cards into rounds, the last one possibly smaller', () => {
    expect(countRounds(300, 20)).toBe(15)
    expect(countRounds(25, 10)).toBe(3)
    expect(countRounds(300, 'all')).toBe(1)
    expect(countRounds(0, 20)).toBe(0)
    expect(roundLimit(20, 7)).toBe(7)
    expect(roundLimit('all', 300)).toBe(300)
  })

  it('takes the next round in planned order without starting on the word that was just answered', () => {
    const plan = ['a', 'b', 'c', 'a', 'd', 'e'].map(card)
    expect(takeRound(plan, 0, 10, null).map(item => item.card.id)).toEqual(['a', 'b', 'c', 'a', 'd', 'e'])
    expect(takeRound(plan, 2, 10, null).map(item => item.card.id)).toEqual(['c', 'a', 'd', 'e'])
    expect(takeRound(plan, 3, 10, 'a').map(item => item.card.id)).toEqual(['d', 'a', 'e'])
    expect(takeRound([card('a'), card('a')], 0, 10, 'a').map(item => item.card.id)).toEqual(['a', 'a'])
    expect(takeRound(plan, 6, 10, 'e')).toEqual([])
  })
})
