import { validateUserAnswer } from '@/lib/grammar-validation'

it.each([
  ['  Guten   Morgen! ', ['Guten Morgen!'], 'EXACT', null, 'Guten Morgen!'],
  ['Hallo', ['Guten Tag', 'Hallo'], 'EXACT', null, 'Hallo'],
  ['Guten Morgen', ['Guten Morgen.'], 'EXACT', null, 'Guten Morgen.', 'punctuation'],
  ['guten Morgen.', ['Guten Morgen.'], 'EXACT', null, 'Guten Morgen.', 'capitalization'],
  ['Baeume', ['Bäume'], 'SOFT_ERROR', 'umlaut', 'Bäume'],
  ['StraSSe', ['Straße'], 'SOFT_ERROR', 'umlaut', 'Straße'],
  ['Guten Morgn.', ['Guten Morgen.'], 'SOFT_ERROR', 'typo', 'Guten Morgen.'],
  ['Guten Morgeen.', ['Guten Morgen.'], 'SOFT_ERROR', 'typo', 'Guten Morgen.'],
  ['Guten Morgan.', ['Guten Morgen.'], 'SOFT_ERROR', 'typo', 'Guten Morgen.'],
  ['Gutan Morgan.', ['Guten Morgen.'], 'INCORRECT', null, null],
  ['Guten Morgne.', ['Guten Morgen.'], 'INCORRECT', null, null],
  ['guten Morgen', ['Guten Morgen.'], 'EXACT', null, 'Guten Morgen.', 'capitalization_punctuation'],
  ['Guten Morgn', ['Guten Morgen.'], 'SOFT_ERROR', 'typo', 'Guten Morgen.'],
  ['der', ['den'], 'INCORRECT', null, null],
  ['ihm', ['ihn'], 'INCORRECT', null, null],
  ['am', ['an'], 'INCORRECT', null, null],
  ['Hau', ['Haus'], 'INCORRECT', null, null],
  ['Guten', ['Guten Morgen'], 'INCORRECT', null, null],
  ['', ['Guten Morgen'], 'INCORRECT', null, null],
  ['  ', [''], 'INCORRECT', null, null],
  ['Guten Morgen', ['guten Morgen', 'Guten Morgen.'], 'EXACT', null, 'guten Morgen', 'capitalization'],
] as const)('previews %s without deciding progress', (input, accepted, status, reason, matched, hint = null) => {
  expect(validateUserAnswer(input, [...accepted])).toEqual({ status, matched, reason, hint })
})

it.each([
  ['ich heiße anna', 'EXACT', null, 'capitalization_punctuation'],
  ['Ich heisse Anna', 'SOFT_ERROR', 'umlaut', null],
  ['ich heise anna', 'SOFT_ERROR', 'typo', null],
] as const)('previews combined spelling differences: %s', (input, status, reason, hint) => {
  expect(validateUserAnswer(input, ['Ich heiße Anna.'])).toEqual({ status, reason, hint, matched: 'Ich heiße Anna.' })
})
it('keeps authored distractors incorrect, but accepts an explicitly accepted option', () => {
  expect(validateUserAnswer('arbeiten', ['arbeitet'], ['arbeiten'])).toMatchObject({ status: 'INCORRECT' })
  expect(validateUserAnswer('arbeiten', ['arbeitet', 'arbeiten'], ['arbeiten'])).toMatchObject({ status: 'EXACT' })
})
it('normalizes typographic apostrophes, quotes, dashes and spacing without a hint', () => {
  expect(validateUserAnswer('  „Wie   geht’s?“ — gut  ', ['"Wie geht\'s?" - gut'])).toEqual({ status: 'EXACT', matched: '"Wie geht\'s?" - gut', reason: null, hint: null })
})

it('keeps an exact distractor incorrect even if typography matches an accepted answer', () => {
  expect(validateUserAnswer("Wie geht’s?", ["Wie geht's?"], ["Wie geht’s?"])).toEqual({ status: 'INCORRECT', matched: null, reason: null, hint: null })
})
it.each([
  ['2,50 €', '250 €'], ['50 %', '50'], ['50 €', '50'], ['50 + 2', '50 2'], ['Hauss €', 'Haus'],
])('keeps numeric separators and content symbols meaningful: %s / %s', (input, target) => {
  expect(validateUserAnswer(input, [target])).toMatchObject({ status: 'INCORRECT' })
})

it.each([
  ['2001', '2000'], ['A123', 'A124'], ['12000 Euro', '12001 Euro'],
  ['Ich zahle 2001 Euro.', 'Ich zahle 2000 Euro.'],
])('does not treat a changed number or code as a typo: %s / %s', (input, target) => {
  expect(validateUserAnswer(input, [target])).toEqual({ status: 'INCORRECT', matched: null, reason: null, hint: null })
})
it('keeps unchanged numbers valid alongside a genuine spelling typo or authored variant', () => {
  expect(validateUserAnswer('Ich zahle 2000 Eruo.', ['Ich zahle 2000 Euro.'])).toMatchObject({ status: 'INCORRECT' })
  expect(validateUserAnswer('Ich zahle 2000 Euron.', ['Ich zahle 2000 Euro.'])).toMatchObject({ status: 'SOFT_ERROR', reason: 'typo' })
  expect(validateUserAnswer('2001', ['2000', '2001'])).toEqual({ status: 'EXACT', matched: '2001', reason: null, hint: null })
})
