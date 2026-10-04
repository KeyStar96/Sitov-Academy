import { within } from '@testing-library/react'
import ExamEntry from '@/components/exam-preparation/ExamEntry'

jest.unmock('lucide-react')

it.each([false, true])('keeps both exam destinations and their content usable before hydration (B1 reference: %s)', reference => {
  const { renderToStaticMarkup } = require('react-dom/server.node') as typeof import('react-dom/server')
  const holder = document.createElement('div')
  holder.innerHTML = renderToStaticMarkup(<ExamEntry lang="en" reference={reference} />)
  const section = within(holder).getByRole('region', { name: 'Prüfungen' })
  const links = within(section).getAllByRole('link')
  expect(links).toHaveLength(2)
  const suffix = reference ? '?level=B1' : ''
  expect(links[0]).toHaveAttribute('href', `/en/dashboard/exam-simulation${suffix}`)
  expect(links[1]).toHaveAttribute('href', `/en/dashboard/exam-preparation${suffix}`)
  expect(links[0]).toHaveAccessibleName(expect.stringContaining('Prüfung simulieren'))
  expect(links[0]).not.toHaveAccessibleName(expect.stringContaining('Lesen Hören Schreiben Sprechen'))
  expect(section).toHaveAttribute('lang', 'de')
  for (const link of links) expect(link.closest('[hidden], [aria-hidden="true"], [inert]')).toBeNull()
  expect(holder.querySelector('[data-sitov-motion-stage]')).toHaveAttribute('data-sitov-live', 'false')
  expect(holder.querySelector('[data-sitov-exam-graphic]')).toHaveAttribute('aria-hidden', 'true')
})
