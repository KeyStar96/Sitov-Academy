import { render, screen, within } from '@testing-library/react'
import TodayPlan, { type TodayItem } from '@/components/dashboard/home/TodayPlan'
import ProgressTeaser from '@/components/dashboard/home/ProgressTeaser'
import { learningProgressCopy } from '@/lib/learning-progress-i18n'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { progressData, progressDay } from './fixtures/learning-progress'

jest.unmock('lucide-react')

const sitovCopy = learningProgressCopy('de')

function sitovDataBar(day: HTMLElement) {
  return day.querySelector<HTMLElement>('span[aria-hidden="true"] > span')!
}

it('keeps a decorated empty day distinct from zero accuracy and draws no answers for the week', () => {
  render(<ProgressTeaser progress={progressData(7, '2026-10-03')} lang="de" focus={null} />)
  const teaser = screen.getByRole('region', { name: sitovCopy('teaser_title') })
  const view = within(teaser)
  expect(view.getByRole('img', { name: sitovCopy('accuracy_none') })).toHaveTextContent('–')
  expect(view.queryByRole('img', { name: sitovCopy('accuracy_aria', { value: 0 }) })).not.toBeInTheDocument()
  expect(view.getByText(sitovCopy('teaser_empty'))).toBeInTheDocument()
  expect(view.getAllByText('0', { exact: true })).toHaveLength(2)
  const days = within(view.getByRole('list', { name: sitovCopy('overview_title') })).getAllByRole('listitem')
  expect(days).toHaveLength(7)
  for (const day of days) {
    expect(day).toHaveTextContent(`${sitovCopy('answered')} 0`)
    expect(day).toHaveTextContent(sitovCopy('accuracy_none'))
    expect(sitovDataBar(day)).toHaveStyle({ height: '0%', opacity: '0' })
  }
})

it('shows an unanswered today after an active week while preserving the historical answers', () => {
  const progress = progressData(7, '2026-10-03', (day, index) => index === 6 ? day : progressDay(day.date, {
    vocabulary: { answers: index + 6, correct: index + 4, seconds: 120 },
  }))
  render(<ProgressTeaser progress={progress} lang="de" focus={null} />)
  const teaser = screen.getByRole('region', { name: sitovCopy('teaser_title') })
  const view = within(teaser)
  expect(view.getByRole('img', { name: sitovCopy('accuracy_none') })).toHaveTextContent('–')
  expect(view.getAllByText('0', { exact: true })).toHaveLength(2)
  const days = within(view.getByRole('list', { name: sitovCopy('overview_title') })).getAllByRole('listitem')
  expect(days.at(-1)).toHaveTextContent(`${sitovCopy('answered')} 0`)
  expect(sitovDataBar(days.at(-1)!)).toHaveStyle({ height: '0%', opacity: '0' })
  for (const [index, day] of days.slice(0, -1).entries()) {
    expect(day).toHaveTextContent(`${sitovCopy('answered')} ${index + 6}`)
    expect(Number.parseFloat(sitovDataBar(day).style.height)).toBeGreaterThan(0)
  }
})

it('supplies the task links and correct primary destination in the server HTML before hydration', () => {
  const { renderToStaticMarkup } = require('react-dom/server.node') as typeof import('react-dom/server')
  const t = studentTranslator('de')
  const items: TodayItem[] = [
    { kind: 'booking', label: 'Unterricht planen', href: '/de/dashboard/calendar', actionable: false },
    { kind: 'vocabulary', label: '24 Karten wiederholen', href: '/de/dashboard/level/A1.1/vocabulary', actionable: true },
  ]
  const holder = document.createElement('div')
  holder.innerHTML = renderToStaticMarkup(<TodayPlan lang="de" name="Dennis" items={items}
    fallbackHref="/de/dashboard/level/A1.1" week={null} noLevel={false} />)
  const view = within(holder)
  const task = view.getByRole('link', { name: '24 Karten wiederholen' })
  const start = view.getByRole('link', { name: new RegExp(t('today_start')) })
  expect(task).toHaveAttribute('href', items[1].href)
  expect(start).toHaveAttribute('href', items[1].href)
  expect(start).toHaveTextContent(t('today_start_vocab'))
  for (const link of [task, start]) expect(link.closest('[hidden], [aria-hidden="true"], [inert]')).toBeNull()
})
