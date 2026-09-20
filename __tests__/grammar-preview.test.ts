import { validateUserAnswer } from '@/lib/grammar-validation'

it.each([
  ['  Guten   Morgen! ', ['Guten Morgen!'], 'EXACT', null, 'Guten Morgen!'],
  ['Hallo', ['Guten Tag', 'Hallo'], 'EXACT', null, 'Hallo'],
  ['Guten Morgen', ['Guten Morgen.'], 'SOFT_ERROR', 'punctuation', 'Guten Morgen.'],
  ['guten Morgen.', ['Guten Morgen.'], 'SOFT_ERROR', 'capitalization', 'Guten Morgen.'],
  ['Baeume', ['Bäume'], 'SOFT_ERROR', 'umlaut', 'Bäume'],
  ['StraSSe', ['Straße'], 'INCORRECT', null, null],
  ['Guten Morgn.', ['Guten Morgen.'], 'SOFT_ERROR', 'typo', 'Guten Morgen.'],
  ['Guten Morgeen.', ['Guten Morgen.'], 'SOFT_ERROR', 'typo', 'Guten Morgen.'],
  ['Guten Morgan.', ['Guten Morgen.'], 'SOFT_ERROR', 'typo', 'Guten Morgen.'],
  ['Gutan Morgan.', ['Guten Morgen.'], 'INCORRECT', null, null],
  ['Guten Morgne.', ['Guten Morgen.'], 'INCORRECT', null, null],
  ['guten Morgen', ['Guten Morgen.'], 'INCORRECT', null, null],
  ['Guten Morgn', ['Guten Morgen.'], 'INCORRECT', null, null],
  ['der', ['den'], 'INCORRECT', null, null],
  ['ihm', ['ihn'], 'INCORRECT', null, null],
  ['am', ['an'], 'INCORRECT', null, null],
  ['Hau', ['Haus'], 'INCORRECT', null, null],
  ['Guten', ['Guten Morgen'], 'INCORRECT', null, null],
  ['', ['Guten Morgen'], 'INCORRECT', null, null],
  ['  ', [''], 'INCORRECT', null, null],
  ['Guten Morgen', ['guten Morgen', 'Guten Morgen.'], 'SOFT_ERROR', 'punctuation', 'Guten Morgen.'],
] as const)('previews %s without deciding progress', (input, accepted, status, reason, matched) => {
  expect(validateUserAnswer(input, [...accepted])).toEqual({ status, matched, reason })
})
