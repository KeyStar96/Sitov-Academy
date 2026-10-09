import { render, screen, within } from '@testing-library/react'
import TeacherSidebar from '@/components/admin/TeacherSidebar'
import TeacherLayout from '@/components/admin/TeacherLayout'
import { createAdminTranslator } from '@/lib/admin-i18n'
import { activeTabbarId, buildAdminNav, findActiveNavItem, findActiveSection } from '@/lib/admin-navigation'

jest.unmock('lucide-react')
jest.mock('next/navigation', () => ({ usePathname: () => '/de/teacher/content/learning-path/specials' }))

const labels = {
  de: 'Lernpfad-Extras', en: 'Learning path extras', ru: 'Дополнения к учебному пути',
  uk: 'Доповнення до навчального шляху', tr: 'Öğrenme yolu ekleri',
} as const

it.each(Object.keys(labels) as (keyof typeof labels)[])('mounts the real extras destination and current content section in %s', lang => {
  const path = `/${lang}/teacher/content/learning-path/specials`
  const nav = buildAdminNav(lang)
  const item = findActiveNavItem(path, nav)
  expect(item).toMatchObject({ id: 'sitov_learning_path_specials', href: path, icon: 'sitov_learning_path_specials' })
  expect(item && createAdminTranslator({})(item.labelKey)).toBe(labels[lang])
  expect(findActiveSection(path, nav)?.id).toBe('content')
  expect(activeTabbarId(path, nav)).toBe('menu')
  expect(findActiveNavItem(`${path}/draft`, nav)).toBe(item)
  expect(findActiveNavItem(`${path}-other`, nav)).toBeNull()
  render(<TeacherSidebar lang={lang} size="comfortable" sitovPreviewPathname={path} />)
  const link = screen.getByRole('link', { name: labels[lang] })
  expect(link).toHaveAttribute('href', path)
  expect(link).toHaveAttribute('aria-current', 'page')
  expect(link).toHaveClass('min-h-12')
  expect(link.querySelector('svg')).toHaveClass('lucide-git-branch')
  expect(screen.getByRole('link', { name: 'Aussprache-Trainer' })).toHaveAttribute('href', `/${lang}/admin/content/pronunciation`)
  expect(screen.getByRole('link', { name: /Bezahlsystem|Payment settings|Система оплаты|Система оплати|Ödeme ayarları/ })).toHaveAttribute('href', `/${lang}/admin/settings/billing`)
})

it.each(Object.keys(labels) as (keyof typeof labels)[])('uses the existing shell breadcrumb and current mobile section tab in %s', lang => {
  render(<TeacherLayout lang={lang} sitovPreviewPathname={`/${lang}/teacher/content/learning-path/specials`} brand="Sitov Academy" controls={null}><p>Inhalt</p></TeacherLayout>)
  const header = screen.getByRole('banner')
  expect(header).toHaveTextContent(labels[lang])
  const tab = within(header).getByRole('link', { name: labels[lang] })
  expect(tab).toHaveAttribute('aria-current', 'page')
  expect(tab).toHaveAttribute('href', `/${lang}/teacher/content/learning-path/specials`)
})
