const messages = {
  de: {
    spelling: 'So schreibt man es:', article: 'Schreib den Artikel mit:', or: 'oder',
    article_missing: 'Denk auch an den Artikel vor dem Nomen.',
    article_wrong: 'Zu diesem Nomen gehört ein anderer Artikel.',
  },
  en: {
    spelling: 'This is how it is written:', article: 'Include the article:', or: 'or',
    article_missing: 'Remember to include the article before the noun.',
    article_wrong: 'This noun takes a different article.',
  },
  ru: {
    spelling: 'Вот как это пишется:', article: 'Напиши слово с артиклем:', or: 'или',
    article_missing: 'Не забудь поставить артикль перед существительным.',
    article_wrong: 'У этого существительного другой артикль.',
  },
  uk: {
    spelling: 'Ось як це пишеться:', article: 'Напиши слово з артиклем:', or: 'або',
    article_missing: 'Не забудь поставити артикль перед іменником.',
    article_wrong: 'Цей іменник має інший артикль.',
  },
  tr: {
    spelling: 'Böyle yazılır:', article: 'Artikeli de yaz:', or: 'veya',
    article_missing: 'İsimden önce artikeli de yazmayı unutma.',
    article_wrong: 'Bu isim farklı bir artikel alır.',
  },
} as const

export function learningFeedback(lang: string) {
  return messages[lang as keyof typeof messages] ?? messages.de
}
