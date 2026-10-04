import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import Header from '@/components/layout/Header'
import AcademyFooter from '@/components/sections/AcademyFooter'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

const mockPush = jest.fn()
let mockPathname = '/de'

jest.unmock('lucide-react')
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}))
jest.mock('@/components/layout/BrandLogo', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => <span>{name}</span>,
}))
const locales = [
  { lang: 'de', dictionary: de },
  { lang: 'en', dictionary: en },
  { lang: 'ru', dictionary: ru },
  { lang: 'uk', dictionary: uk },
  { lang: 'tr', dictionary: tr },
]

beforeEach(() => {
  mockPush.mockClear()
  mockPathname = '/de'
  window.history.replaceState({}, '', '/de')
})

describe.each(locales)('$lang marketing navigation and contact details', ({ lang, dictionary }) => {
  it('orders method, teacher and courses consistently in the desktop and mobile menus', () => {
    render(<Header lang={lang} dictionary={dictionary} />)
    const expectedLabels = [
      dictionary.header.nav.science,
      dictionary.Footer.Nav.about,
      dictionary.header.nav.courses,
    ]
    const expectedHrefs = [`/${lang}#science`, `/${lang}#about`, `/${lang}#courses`]
    const desktopLinks = within(screen.getByRole('navigation')).getAllByRole('link')
    expect(desktopLinks.map(link => link.textContent)).toEqual(expectedLabels)
    expect(desktopLinks.map(link => link.getAttribute('href'))).toEqual(expectedHrefs)

    fireEvent.click(screen.getByRole('button', { name: dictionary.academy.menu_open }))
    const mobileNavigation = screen.getAllByRole('navigation')[1]
    const mobileLinks = within(mobileNavigation).getAllByRole('link').slice(0, 3)
    expect(mobileLinks.map(link => link.textContent)).toEqual(expectedLabels)
    expect(mobileLinks.map(link => link.getAttribute('href'))).toEqual(expectedHrefs)

    fireEvent.click(mobileLinks[1])
    expect(screen.getAllByRole('navigation')).toHaveLength(1)
    expect(screen.getByRole('button', { name: dictionary.academy.menu_open })).toHaveAttribute('aria-expanded', 'false')
  })

  it('labels the classroom separately from the registered address and provides working contact links', () => {
    render(<AcademyFooter lang={lang} dictionary={dictionary} />)
    const classroom = screen.getByRole('region', { name: dictionary.Footer.Addresses.classroom.label })
    const school = screen.getByRole('region', { name: dictionary.Footer.Addresses.school.label })
    expect(within(classroom).getByText('Freizeitheim Vahrenwald')).toBeInTheDocument()
    expect(within(classroom).getByText('Vahrenwalder Str. 92')).toBeInTheDocument()
    expect(within(classroom).getByText('30165 Hannover')).toBeInTheDocument()
    expect(within(school).getByText('Hüttenstraße 24a')).toBeInTheDocument()
    expect(within(school).getByText('30165 Hannover')).toBeInTheDocument()
    expect(within(school).queryByText('Freizeitheim Vahrenwald')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'info@sitov-academy.com' })).toHaveAttribute('href', 'mailto:info@sitov-academy.com')
    expect(screen.getByRole('link', { name: '+49 171 4758620' })).toHaveAttribute('href', 'tel:+491714758620')
    expect(screen.getByRole('link', { name: dictionary.Footer.Legal.imprint })).toHaveAttribute('href', `/${lang}/imprint`)
  })
})

it('keeps the language control available when the mobile menu is open and closes both after selection', () => {
  render(<Header lang="de" dictionary={de} />)
  fireEvent.click(screen.getByRole('button', { name: de.academy.menu_open }))
  fireEvent.click(screen.getByRole('button', { name: `${de.academy.language}: Deutsch` }))
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Türkçe' }))
  expect(mockPush).toHaveBeenCalledWith('/tr')
  expect(screen.getAllByRole('navigation')).toHaveLength(1)
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})

it('preserves the page, query and anchor when changing the public-site language', () => {
  mockPathname = '/de/imprint'
  window.history.replaceState({}, '', '/de/imprint?utm_source=homepage#contact')
  render(<Header lang="de" dictionary={de} />)
  fireEvent.click(screen.getByRole('button', { name: `${de.academy.language}: Deutsch` }))
  expect(screen.getAllByRole('menuitemradio')).toHaveLength(5)
  expect(screen.getByRole('menuitemradio', { name: 'Deutsch' })).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'English' }))
  expect(mockPush).toHaveBeenCalledWith('/en/imprint?utm_source=homepage#contact')
})

it('supports arrow navigation and Escape with focus returned to the language pill', () => {
  render(<Header lang="de" dictionary={de} />)
  const trigger = screen.getByRole('button', { name: `${de.academy.language}: Deutsch` })
  fireEvent.keyDown(trigger, { key: 'ArrowDown' })
  expect(screen.getByRole('menuitemradio', { name: 'Deutsch' })).toHaveFocus()
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
  expect(screen.getByRole('menuitemradio', { name: 'English' })).toHaveFocus()
  fireEvent.keyDown(document.activeElement!, { key: 'End' })
  expect(screen.getByRole('menuitemradio', { name: 'Türkçe' })).toHaveFocus()
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
  expect(mockPush).not.toHaveBeenCalled()
})

it('dismisses the language popover on an outside touch and keeps the current locale unchanged', () => {
  render(<Header lang="de" dictionary={de} />)
  const trigger = screen.getByRole('button', { name: `${de.academy.language}: Deutsch` })
  fireEvent.click(trigger)
  fireEvent.pointerDown(document.body)
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(mockPush).not.toHaveBeenCalled()
})
