import { within } from '@testing-library/react'
import ExamEntry from '@/components/exam-preparation/ExamEntry'
import { getSitovExamEntryCopy } from '@/lib/exam-entry-i18n'

jest.unmock('lucide-react')

describe.each(['de', 'en', 'ru', 'uk', 'tr'])('interface language %s', lang => {
it.each([false, true])('keeps both exam destinations and their content usable before hydration (B1 reference: %s)', reference => {
  const { renderToStaticMarkup } = require('react-dom/server.node') as typeof import('react-dom/server')
  const holder = document.createElement('div')
  holder.innerHTML = renderToStaticMarkup(<ExamEntry lang={lang} reference={reference} />)
  const copy = getSitovExamEntryCopy(lang)
  const section = within(holder).getByRole('region', { name: copy.region })
  const links = within(section).getAllByRole('link')
  expect(links).toHaveLength(2)
  const suffix = reference ? '?level=B1' : ''
  expect(links[0]).toHaveAttribute('href', `/${lang}/dashboard/exam-simulation${suffix}`)
  expect(links[1]).toHaveAttribute('href', `/${lang}/dashboard/exam-preparation${suffix}`)
  expect(links[0]).toHaveAccessibleName(expect.stringContaining(copy.action))
  expect(links[0]).not.toHaveAccessibleName(expect.stringContaining(`${copy.reading} ${copy.listening} ${copy.writing} ${copy.speaking}`))
  expect(section).toHaveAttribute('lang', lang)
  expect(within(section).getByRole('heading', { name: reference ? copy.referenceTitle : copy.title })).not.toBeNull()
  expect(within(section).getByRole('heading', { name: copy.preparationTitle })).not.toBeNull()
  expect(within(section).getByText(copy.description)).not.toBeNull()
  for (const text of [copy.reading, copy.listening, copy.writing, copy.speaking]) expect(holder.querySelector('[data-sitov-exam-graphic]')).toHaveTextContent(text)
  for (const link of links) expect(link.closest('[hidden], [aria-hidden="true"], [inert]')).toBeNull()
  expect(holder.querySelector('[data-sitov-motion-stage]')).toHaveAttribute('data-sitov-live', 'false')
  expect(holder.querySelector('[data-sitov-exam-graphic]')).toHaveAttribute('aria-hidden', 'true')
})
})
