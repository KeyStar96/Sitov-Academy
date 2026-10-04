import { fireEvent, render, screen } from '@testing-library/react'
import AuthLanguageSelect from '@/components/auth/AuthLanguageSelect'
import de from '@/dictionaries/de.json'

const mockPush = jest.fn()
let mockPathname = '/de/login'

jest.unmock('lucide-react')
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}))

beforeEach(() => {
  mockPush.mockClear()
  window.history.replaceState({}, '', '/de/login')
})

it.each([
  {
    path: '/de/login',
    context: '?next=%2Fde%2Fdashboard%2Fprofile&status=signup_email_sent#sitov-login',
  },
  {
    path: '/de/register',
    context: '?next=%2Fde%2Fdashboard&status=signup_failed&callback=%2Fauth%2Fconfirm#sitov-register',
  },
])('preserves auth context while switching $path to Ukrainian', ({ path, context }) => {
  mockPathname = path
  window.history.replaceState({}, '', `${path}${context}`)
  render(<AuthLanguageSelect lang="de" label={de.academy.language} />)
  const trigger = screen.getByRole('button', { name: `${de.academy.language}: Deutsch` })
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  fireEvent.click(trigger)
  expect(screen.getAllByRole('menuitemradio')).toHaveLength(5)
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Українська' }))
  expect(mockPush).toHaveBeenCalledWith(`${path.replace('/de/', '/uk/')}${context}`)
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

it('lets the current language close without changing the auth route', () => {
  mockPathname = '/de/login'
  render(<AuthLanguageSelect lang="de" label={de.academy.language} />)
  fireEvent.click(screen.getByRole('button', { name: `${de.academy.language}: Deutsch` }))
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Deutsch' }))
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(mockPush).not.toHaveBeenCalled()
})
