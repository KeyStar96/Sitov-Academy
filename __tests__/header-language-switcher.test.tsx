import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import HeaderLanguageSwitcher from '@/components/layout/HeaderLanguageSwitcher'
import AcademySkipLink from '@/components/layout/AcademySkipLink'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
let mockPathname = '/ru/admin'
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }))
jest.mock('@/app/actions/profile', () => ({ updateUiLanguage: jest.fn() }))

it('keeps the trigger compact and lists endonyms when opened', () => {
  mockPathname = '/ru/admin'
  render(<HeaderLanguageSwitcher current="ru" ariaLabel={de.admin.ui_language_aria} />)
  const trigger = screen.getByRole('button', { name: `${de.admin.ui_language_aria}: Русский` })
  expect(trigger).toHaveTextContent('RU')
  fireEvent.click(trigger)
  expect(screen.getByRole('option', { name: 'Deutsch' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Русский' })).toHaveAttribute('aria-selected', 'true')
})

it.each(['exam-preparation', 'exam-simulation'])('offers interface language selection on %s', route => {
  mockPathname = `/ru/dashboard/${route}`
  render(<HeaderLanguageSwitcher current="ru" ariaLabel={de.admin.ui_language_aria} />)
  fireEvent.click(screen.getByRole('button'))
  expect(screen.getByRole('option', { name: 'Русский' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument()
})

it.each(['dashboard', 'sitov-preview'])('keeps the supplied interface skip label in %s', surface => {
  mockPathname = `/ru/${surface}/exam-simulation`
  const view = render(<AcademySkipLink label="Перейти к содержимому" />)
  expect(screen.getByRole('link', { name: 'Перейти к содержимому' })).not.toHaveAttribute('lang', 'de')
  mockPathname = '/ru/dashboard'
  view.rerender(<AcademySkipLink label="Перейти к содержимому" />)
  expect(screen.getByRole('link', { name: 'Перейти к содержимому' })).toBeInTheDocument()
})
