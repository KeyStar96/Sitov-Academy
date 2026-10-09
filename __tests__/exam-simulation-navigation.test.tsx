import React from 'react'
import { render, screen } from '@testing-library/react'
import TeacherSidebar from '@/components/admin/TeacherSidebar'
import { AdminI18nProvider } from '@/components/admin/AdminI18nProvider'
import { buildAdminNav, findActiveSection, activeTabbarId } from '@/lib/admin-navigation'
import ru from '@/dictionaries/ru.json'

let mockPathname = '/ru/admin/exam-simulation'
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }))
jest.unmock('lucide-react')

it('places simulations in their own teacher area and localizes the active destination under a Russian profile', () => {
  const sections = buildAdminNav('ru')
  expect(findActiveSection(mockPathname, sections)?.id).toBe('exams')
  expect(activeTabbarId(mockPathname, sections)).toBe('menu')
  render(<AdminI18nProvider translations={ru.admin}><TeacherSidebar lang="ru" /></AdminI18nProvider>)
  expect(screen.getByText(ru.admin.group_exams)).toBeInTheDocument()
  const link = screen.getByRole('link', { name: ru.admin.nav_exam_simulation })
  expect(link).toHaveAttribute('href', '/ru/admin/exam-simulation')
  expect(link).toHaveAttribute('aria-current', 'page')
})
it('safe teacher preview uses the same active navigation without changing production routes', () => {
  mockPathname = '/ru/sitov-preview/exam-simulation/teacher'
  render(<AdminI18nProvider translations={ru.admin}><TeacherSidebar lang="ru" sitovPreviewPathname="/ru/admin/exam-simulation" /></AdminI18nProvider>)
  expect(screen.getByRole('link', { name: ru.admin.nav_exam_simulation })).toHaveAttribute('aria-current', 'page')
})

it('offers only existing content editors after the legacy grammar editor is removed', () => {
  const content = buildAdminNav('ru').find(section => section.id === 'content')
  expect(content?.items.map(item => item.href)).toEqual([
    '/ru/admin/content/vocabulary', '/ru/admin/content/media', '/ru/admin/content/pronunciation',
    '/ru/teacher/content/learning-path/specials',
  ])
})


it.each(['de', 'en', 'ru', 'uk', 'tr'])('localizes new staff destinations using the selected %s dictionary', lang => {
  const dictionary = jest.requireActual(`../dictionaries/${lang}.json`)
  render(<AdminI18nProvider translations={dictionary.admin}><TeacherSidebar lang={lang} /></AdminI18nProvider>)
  expect(screen.getByRole('link', { name: dictionary.admin.nav_sitov_billing })).toHaveAttribute('href', `/${lang}/admin/settings/billing`)
  expect(screen.getByRole('link', { name: dictionary.admin.sitov_learning_path_specials })).toHaveAttribute('href', `/${lang}/teacher/content/learning-path/specials`)
})
