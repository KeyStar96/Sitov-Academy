import React from 'react'
import { render, screen } from '@testing-library/react'
import TeacherSidebar from '@/components/admin/TeacherSidebar'
import { AdminI18nProvider } from '@/components/admin/AdminI18nProvider'
import { buildAdminNav, findActiveSection, activeTabbarId } from '@/lib/admin-navigation'
import ru from '@/dictionaries/ru.json'

let mockPathname = '/ru/admin/exam-simulation'
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }))
jest.unmock('lucide-react')

it('places simulations in their own teacher area and makes the German destination active under a Russian profile', () => {
  const sections = buildAdminNav('ru')
  expect(findActiveSection(mockPathname, sections)?.id).toBe('exams')
  expect(activeTabbarId(mockPathname, sections)).toBe('menu')
  render(<AdminI18nProvider translations={ru.admin}><TeacherSidebar lang="ru" /></AdminI18nProvider>)
  expect(screen.getByText('Prüfungen')).toBeInTheDocument()
  const link = screen.getByRole('link', { name: 'Simulierte Prüfung' })
  expect(link).toHaveAttribute('href', '/ru/admin/exam-simulation')
  expect(link).toHaveAttribute('aria-current', 'page')
})
it('safe teacher preview uses the same active navigation without changing production routes', () => {
  mockPathname = '/ru/sitov-preview/exam-simulation/teacher'
  render(<AdminI18nProvider translations={ru.admin}><TeacherSidebar lang="ru" sitovPreviewPathname="/ru/admin/exam-simulation" /></AdminI18nProvider>)
  expect(screen.getByRole('link', { name: 'Simulierte Prüfung' })).toHaveAttribute('aria-current', 'page')
})
