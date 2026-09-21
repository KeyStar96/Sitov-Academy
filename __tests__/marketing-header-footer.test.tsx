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

jest.unmock('lucide-react')
jest.mock('next/navigation', () => ({
  usePathname: () => '/de',
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

it('switches language from the mobile menu in one interaction and closes the menu', () => {
  render(<Header lang="de" dictionary={de} />)
  fireEvent.click(screen.getByRole('button', { name: de.academy.menu_open }))
  const mobileNavigation = screen.getAllByRole('navigation')[1]
  fireEvent.change(within(mobileNavigation).getByRole('combobox', { name: de.academy.language }), { target: { value: 'tr' } })
  expect(mockPush).toHaveBeenCalledWith('/tr')
  expect(screen.getAllByRole('navigation')).toHaveLength(1)
})
