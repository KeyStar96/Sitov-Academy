import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToStaticMarkup } from 'react-dom/server.node'
import { Archive, ListChecks, Target } from 'lucide-react'
import SitovTrainerTabs from '@/components/motion/SitovTrainerTabs'
import VocabularyTabs from '@/components/vocabulary/VocabularyTabs'
import { focusHref, lessonsHref, modeHref } from '@/lib/mode-targets'
import { studentTranslator } from '@/lib/student-ui-i18n'

let mockPathname = ''
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }))
jest.unmock('lucide-react')

it('keeps local trainer views native named buttons and separates selected state from keyboard focus', async () => {
  const choose = jest.fn()
  render(<SitovTrainerTabs label="Verb practice" mode="verbs" items={[
    { id: 'practice', label: 'My practice', icon: Archive, selected: true, onClick: choose },
    { id: 'focus', label: 'Focused practice', icon: Target, selected: false, onClick: choose },
    { id: 'box', label: 'My verb box', icon: ListChecks, selected: false, onClick: choose, disabled: true },
  ]} />)
  const navigation = screen.getByRole('navigation', { name: 'Verb practice' })
  const buttons = within(navigation).getAllByRole('button')
  expect(buttons.map(button => button.textContent)).toEqual(['My practice', 'Focused practice', 'My verb box'])
  expect(buttons.map(button => button.getAttribute('type'))).toEqual(['button', 'button', 'button'])
  expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
  expect(buttons[1]).toHaveAttribute('aria-pressed', 'false')
  expect(buttons[2]).toBeDisabled()
  const user = userEvent.setup()
  await user.tab()
  await user.tab()
  expect(buttons[1]).toHaveFocus()
  expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
  await user.keyboard('{Enter}')
  expect(choose).toHaveBeenCalledTimes(1)
  await user.click(buttons[2])
  expect(choose).toHaveBeenCalledTimes(1)
})

it.each(['de', 'en', 'ru', 'uk', 'tr'])('preserves all vocabulary destinations and the current route in %s', lang => {
  const t = studentTranslator(lang)
  mockPathname = `${focusHref(lang, 'A1.2')}/`
  render(<VocabularyTabs lang={lang} level="A1.2" />)
  const navigation = screen.getByRole('navigation', { name: t('vocab_tabs_label') })
  expect(navigation).toHaveAttribute('data-sitov-trainer-tabs', 'vocabulary')
  expect(navigation).toHaveAttribute('data-sitov-vocabulary-tabs')
  const links = within(navigation).getAllByRole('link')
  expect(links.map(link => link.textContent)).toEqual([t('vocab_tab_box'), t('vocab_tab_lessons'), t('vocab_tab_focus')])
  expect(links.map(link => link.getAttribute('href'))).toEqual([
    modeHref(lang, 'A1.2', 'vocabulary'), lessonsHref(lang, 'A1.2'), focusHref(lang, 'A1.2'),
  ])
  expect(links.filter(link => link.hasAttribute('aria-current'))).toEqual([links[2]])
  expect(links[2]).toHaveAttribute('aria-current', 'page')
  expect(navigation.querySelectorAll('[data-sliding-pill]')).toHaveLength(1)
  expect(links[2].querySelector('[data-sliding-pill]')).not.toBeNull()
})

it.each(['assess', 'session', 'lessons/some-lesson'])('keeps vocabulary navigation out of %s', segment => {
  mockPathname = `/en/dashboard/level/A1.1/vocabulary/${segment}`
  const { container } = render(<VocabularyTabs lang="en" level="A1.1" />)
  expect(container).toBeEmptyDOMElement()
})

it('keeps native links and their selected state available before hydration', () => {
  const html = renderToStaticMarkup(<SitovTrainerTabs label="Vocabulary" mode="vocabulary" items={[
    { id: 'box', label: 'Learning box', icon: Archive, selected: true, href: '/en/box' },
    { id: 'lessons', label: 'Lessons', icon: ListChecks, selected: false, href: '/en/lessons' },
    { id: 'focus', label: 'Problem words', icon: Target, selected: false, href: '/en/focus' },
  ]} />)
  const view = document.createElement('div')
  view.innerHTML = html
  document.body.appendChild(view)
  const link = within(view).getByRole('link', { name: 'Learning box' })
  expect(link).toHaveAttribute('href', '/en/box')
  expect(link).toHaveAttribute('aria-current', 'page')
  expect(link).toBeVisible()
  expect(within(view).queryByRole('button')).not.toBeInTheDocument()
  view.remove()
})
