import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import HeaderLanguageSwitcher from '@/components/layout/HeaderLanguageSwitcher'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.mock('next/navigation', () => ({ usePathname: () => '/ru/admin' }))
jest.mock('@/app/actions/profile', () => ({ updateUiLanguage: jest.fn() }))

it('keeps the trigger compact and lists endonyms when opened', () => {
  render(<HeaderLanguageSwitcher current="ru" ariaLabel={de.admin.ui_language_aria} />)
  const trigger = screen.getByRole('button', { name: `${de.admin.ui_language_aria}: Русский` })
  expect(trigger).toHaveTextContent('RU')
  fireEvent.click(trigger)
  expect(screen.getByRole('option', { name: 'Deutsch' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Русский' })).toHaveAttribute('aria-selected', 'true')
})
