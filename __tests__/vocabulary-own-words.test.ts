import { isOwnWordsLesson, lessonLabel, lessonTitle, OWN_WORDS_LESSON, parseGermanHeadword } from '@/lib/vocabulary-own-words'
import { createVocabularyTranslator } from '@/lib/vocabulary-i18n'
import { resolveCardInterfaceTranslation } from '@/lib/vocabulary-languages'
import ru from '@/dictionaries/ru.json'

describe('parseGermanHeadword', () => {
  it('trennt der/die/das vom Wort', () => {
    expect(parseGermanHeadword('das Haus')).toEqual({ article: 'das', word_de: 'Haus' })
    expect(parseGermanHeadword('DIE Tür')).toEqual({ article: 'die', word_de: 'Tür' })
    expect(parseGermanHeadword('  der  Mann  ')).toEqual({ article: 'der', word_de: 'Mann' })
  })

  it('lässt Wörter ohne Artikel unverändert', () => {
    expect(parseGermanHeadword('laufen')).toEqual({ article: null, word_de: 'laufen' })
    expect(parseGermanHeadword('der')).toEqual({ article: null, word_de: 'der' })
    expect(parseGermanHeadword('Guten   Morgen')).toEqual({ article: null, word_de: 'Guten Morgen' })
  })
})

describe('Lektion „Eigene Wörter"', () => {
  const t = createVocabularyTranslator(ru.vocabulary)

  it('erkennt die Lektion am festen Datenbanknamen', () => {
    expect(OWN_WORDS_LESSON).toBe('Eigene Wörter')
    expect(isOwnWordsLesson('Eigene Wörter')).toBe(true)
    expect(isOwnWordsLesson('Lektion 1')).toBe(false)
  })

  it('zeigt eigene Wörter übersetzt, Kurslektionen unverändert', () => {
    expect(lessonTitle(OWN_WORDS_LESSON, t)).toBe(ru.vocabulary.own_words_title)
    expect(lessonTitle('Lektion 1 – Begrüßung', t)).toBe('Lektion 1 – Begrüßung')
    expect(lessonLabel(OWN_WORDS_LESSON, t)).toBe(ru.vocabulary.own_words_title)
    expect(lessonLabel('Lektion 1 – Begrüßung', t)).toBe('Урок 1 – Begrüßung')
  })
})

describe('Übersetzung nach einem Sprachwechsel', () => {
  const card = { translation_en: null, translation_ru: 'хлеб', translation_uk: null, translation_tr: null }

  it('behält bei eigenen Wörtern die eingetragene Übersetzung samt ihrer Sprache', () => {
    expect(resolveCardInterfaceTranslation({ ...card, is_own: true }, 'en')).toEqual({ language: 'ru', text: 'хлеб' })
    expect(resolveCardInterfaceTranslation({ ...card, is_own: true }, 'ru')).toEqual({ language: 'ru', text: 'хлеб' })
  })

  it('wechselt bei Kursvokabeln nie still die Sprache', () => {
    expect(resolveCardInterfaceTranslation(card, 'en')).toBeNull()
    expect(resolveCardInterfaceTranslation({ ...card, is_own: true }, 'de')).toBeNull()
  })
})
