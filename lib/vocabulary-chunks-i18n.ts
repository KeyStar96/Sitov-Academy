import { interpolate } from '@/lib/i18n-runtime'

const sitovMessages = {
  de: {
    title: 'Wörter & Chunks', all: 'Alle', words: 'Wörter', chunks: 'Chunks', word: 'Wort', chunk: 'Chunk',
    filter_aria: 'Kartenart auswählen', chunk_explanation: 'Chunks sind feste Wortverbindungen, die du zusammen lernst.',
    usage_aria: 'Verwendung auf dieser Karte', usage_chunk: 'Wortverbindung', example: 'Beispiel',
    list_empty: 'Hier gibt es noch keine Karten dieser Art.', overview_hint: 'Wörter mit Wortverbindungen und Beispielen. Ausgewählte Chunks lernst du auch als eigene Karte.',
    count: '{count} Karten', listen_chunk: 'Chunk anhören', listen_chunk_aria: 'Den Chunk „{word}“ anhören', listen_usage: 'Anhören', listen_usage_aria: '„{text}“ anhören',
  },
  en: {
    title: 'Words & chunks', all: 'All', words: 'Words', chunks: 'Chunks', word: 'Word', chunk: 'Chunk',
    filter_aria: 'Choose a card type', chunk_explanation: 'Chunks are fixed expressions that you learn together.',
    usage_aria: 'Usage on this card', usage_chunk: 'Word combination', example: 'Example',
    list_empty: 'There are no cards of this type yet.', overview_hint: 'Words with useful combinations and examples. Selected chunks also have their own card.',
    count: '{count} cards', listen_chunk: 'Listen to chunk', listen_chunk_aria: 'Listen to the chunk “{word}”', listen_usage: 'Listen', listen_usage_aria: 'Listen to “{text}”',
  },
  ru: {
    title: 'Слова и выражения', all: 'Все', words: 'Слова', chunks: 'Выражения', word: 'Слово', chunk: 'Выражение',
    filter_aria: 'Выбрать тип карточек', chunk_explanation: 'Выражения — устойчивые сочетания слов, которые вы учите вместе.',
    usage_aria: 'Употребление на этой карточке', usage_chunk: 'Сочетание слов', example: 'Пример',
    list_empty: 'Карточек этого типа пока нет.', overview_hint: 'Слова с сочетаниями и примерами. Некоторые выражения вы также учите на отдельных карточках.',
    count: 'Карточек: {count}', listen_chunk: 'Прослушать выражение', listen_chunk_aria: 'Прослушать выражение «{word}»', listen_usage: 'Слушать', listen_usage_aria: 'Прослушать «{text}»',
  },
  uk: {
    title: 'Слова та вирази', all: 'Усі', words: 'Слова', chunks: 'Вирази', word: 'Слово', chunk: 'Вираз',
    filter_aria: 'Вибрати тип карток', chunk_explanation: 'Вирази — сталі сполучення слів, які ви вчите разом.',
    usage_aria: 'Вживання на цій картці', usage_chunk: 'Сполучення слів', example: 'Приклад',
    list_empty: 'Карток цього типу ще немає.', overview_hint: 'Слова зі сполученнями та прикладами. Деякі вирази ви також вчите на окремих картках.',
    count: 'Карток: {count}', listen_chunk: 'Прослухати вираз', listen_chunk_aria: 'Прослухати вираз «{word}»', listen_usage: 'Слухати', listen_usage_aria: 'Прослухати «{text}»',
  },
  tr: {
    title: 'Kelimeler ve kalıplar', all: 'Tümü', words: 'Kelimeler', chunks: 'Kalıplar', word: 'Kelime', chunk: 'Kalıp',
    filter_aria: 'Kart türünü seç', chunk_explanation: 'Kalıplar, birlikte öğrendiğiniz sabit kelime gruplarıdır.',
    usage_aria: 'Bu karttaki kullanım', usage_chunk: 'Kelime grubu', example: 'Örnek',
    list_empty: 'Henüz bu türde kart yok.', overview_hint: 'Kelime grupları ve örneklerle kelimeler. Seçili kalıpları ayrıca kendi kartlarında öğrenirsiniz.',
    count: '{count} kart', listen_chunk: 'Kalıbı dinle', listen_chunk_aria: '“{word}” kalıbını dinle', listen_usage: 'Dinle', listen_usage_aria: '“{text}” dinle',
  },
} as const

export const SITOV_VOCABULARY_CHUNKS_MESSAGES = sitovMessages

export function sitovVocabularyChunksTranslator(lang = 'de') {
  const dictionary = sitovMessages[lang as keyof typeof sitovMessages] ?? sitovMessages.de
  return (key: keyof typeof sitovMessages.de, variables?: Record<string, string | number>) => interpolate(dictionary[key], variables)
}
