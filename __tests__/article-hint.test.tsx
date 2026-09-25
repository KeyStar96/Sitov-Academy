import { render, screen } from '@testing-library/react'
import ArticleHint from '@/components/vocabulary/ArticleHint'
import { learningFeedback } from '@/lib/learning-feedback-i18n'

it.each(['der', 'die', 'das'])('shows all three colored articles before answering a %s noun', article => {
  render(<ArticleHint article={article} lang="de" />)
  expect(screen.getByRole('note')).toHaveTextContent('Schreib den Artikel mit: der, die oder das')
  expect(screen.getByText('der')).toHaveClass('text-blue-700')
  expect(screen.getByText('die')).toHaveClass('text-red-700')
  expect(screen.getByText('das')).toHaveClass('text-green-700')
})
it.each([null, 'none'])('omits the chip for article %s', article => {
  render(<ArticleHint article={article} lang="de" />)
  expect(screen.queryByRole('note')).not.toBeInTheDocument()
})
it.each(['de', 'en', 'ru', 'uk', 'tr'])('has complete feedback in %s', lang => {
  render(<ArticleHint article="die" lang={lang} />)
  expect(screen.getByRole('note')).toHaveTextContent(learningFeedback(lang).article)
  expect(Object.values(learningFeedback(lang)).every(value => value.length > 0)).toBe(true)
})
