import { parseFillInBlankContent, parseMultipleChoiceContent } from '@/lib/types/exercise'

describe('parseFillInBlankContent', () => {
  it('liest gültige Inhalte inklusive Chips', () => {
    expect(
      parseFillInBlankContent({
        text_before: 'Ich ',
        text_after: ' Nico.',
        correct_answer: 'bin',
        options: ['bin', 'bist'],
      })
    ).toEqual({
      text_before: 'Ich ',
      text_after: ' Nico.',
      correct_answer: 'bin',
      options: ['bin', 'bist'],
    })
  })

  it('ergänzt fehlende Textteile mit leeren Strings', () => {
    expect(parseFillInBlankContent({ correct_answer: 'bin' })).toEqual({
      text_before: '',
      text_after: '',
      correct_answer: 'bin',
    })
  })

  it('lehnt Inhalte ohne Lösung ab', () => {
    expect(parseFillInBlankContent({ text_before: 'Ich ' })).toBeNull()
    expect(parseFillInBlankContent({ correct_answer: '  ' })).toBeNull()
    expect(parseFillInBlankContent('kein Objekt')).toBeNull()
    expect(parseFillInBlankContent(null)).toBeNull()
  })

  it('ignoriert Chips mit ungültigen Einträgen', () => {
    const content = parseFillInBlankContent({ correct_answer: 'bin', options: ['bin', 42] })

    expect(content?.options).toBeUndefined()
  })
})

describe('parseMultipleChoiceContent', () => {
  it('liest gültige Inhalte', () => {
    expect(
      parseMultipleChoiceContent({
        question: 'Welcher Artikel passt?',
        options: ['der', 'die', 'das'],
        correct_answer: 'das',
      })
    ).toEqual({
      question: 'Welcher Artikel passt?',
      options: ['der', 'die', 'das'],
      correct_answer: 'das',
    })
  })

  it('lehnt Inhalte mit weniger als zwei Optionen ab', () => {
    expect(
      parseMultipleChoiceContent({ question: 'Frage', options: ['das'], correct_answer: 'das' })
    ).toBeNull()
  })
})
