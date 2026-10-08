import React from 'react'
import { getCourses } from '@/app/actions/get-courses'
import type { CourseConfig } from '@/lib/course-config'
import { localizedUrl } from '@/lib/seo'
import { getSitovCourseSeoCopy, getSitovCourseLinks } from '@/lib/sitov-course-seo-copy'
import SitovCourseLanding from '@/components/sections/SitovCourseLanding'
import AcademyFooter from '@/components/sections/AcademyFooter'
import { generateMetadata as hannoverMetadata } from '@/app/[lang]/deutschkurse-hannover/page'
import { generateMetadata as onlineMetadata } from '@/app/[lang]/deutschkurse-online/page'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

const { renderToStaticMarkup } = jest.requireActual('react-dom/server.node') as typeof import('react-dom/server')

jest.unmock('lucide-react')
jest.mock('@/app/actions/get-courses', () => ({ getCourses: jest.fn() }))
jest.mock('@/lib/dictionary', () => ({ getDictionary: jest.fn() }))
jest.mock('@/components/layout/Header', () => ({ __esModule: true, default: () => <header /> }))
jest.mock('@/components/layout/BrandLogo', () => ({ __esModule: true, default: ({ name }: { name: string }) => <span>{name}</span> }))
jest.mock('@/components/analytics/ConsentSettingsButton', () => ({ __esModule: true, default: ({ label }: { label: string }) => <button>{label}</button> }))

const locales = [
  { lang: 'de', dictionary: de }, { lang: 'en', dictionary: en },
  { lang: 'ru', dictionary: ru }, { lang: 'uk', dictionary: uk }, { lang: 'tr', dictionary: tr },
]

const courses: CourseConfig[] = [
  { id: 'presence-course', slug: 'presence', title: 'Präsenzangebot', type: 'presence', category: 'german', unitPrice: 2.5, unitMinutes: 45, trialLessons: true, sessions: [{ day: 'Mo', startTime: '09:00', endTime: '10:30' }] },
  { id: 'online-course', slug: 'online', title: 'Online-Angebot', type: 'online', category: 'online', level: 'A1.1', unitPrice: 10, unitMinutes: 60, trialLessons: true, sessions: [{ day: 'Fr', startTime: '19:30', endTime: '20:30' }] },
  { id: 'private-course', slug: 'private', title: 'Privatangebot', type: 'online', category: 'private', unitPrice: 25, unitMinutes: 45, trialLessons: false, sessions: [] },
]

beforeEach(() => jest.mocked(getCourses).mockResolvedValue(courses))

function markupDocument(html: string) {
  const node = document.createElement('div')
  node.innerHTML = html
  return node
}

describe.each(locales)('$lang public course pages', ({ lang, dictionary }) => {
  it.each(['presence', 'online'] as const)('%s has visible server text, working native actions and honest structured data', async type => {
    const copy = getSitovCourseSeoCopy(lang, type)
    const html = renderToStaticMarkup(await SitovCourseLanding({ lang, type, dictionary }))
    const node = markupDocument(html)
    expect(node.querySelectorAll('h1')).toHaveLength(1)
    expect(node.querySelector('h1')).toHaveTextContent(copy.heading)
    expect(node.querySelector('h1')?.closest('section')).not.toHaveAttribute('style')
    expect(html).not.toMatch(/opacity:\s*0|visibility:\s*hidden/)
    expect(node.querySelector('.academy-hero-description')).toHaveTextContent(copy.intro)
    expect(node.querySelector('a[href="#courses"]')).toHaveTextContent(copy.chooseCourse)
    expect(node.querySelectorAll('details')).toHaveLength(4)
    for (const faq of copy.faqs) expect(node.textContent).toContain(faq.answer)
    expect(node.querySelector('[role="note"]')).toHaveTextContent(copy.trialNotice)
    const graph = JSON.parse(node.querySelector('script[type="application/ld+json"]')!.textContent!)['@graph']
    const path = type === 'presence' ? '/deutschkurse-hannover' : '/deutschkurse-online'
    expect(graph[0]).toMatchObject({ '@type': 'CollectionPage', name: copy.heading, description: copy.intro, inLanguage: lang, url: localizedUrl(lang, path) })
    expect(graph[1].itemListElement[1]).toMatchObject({ name: copy.heading, item: localizedUrl(lang, path) })
    expect(JSON.stringify(graph)).not.toMatch(/aggregateRating|review|openingHours|Offer/)
  })

  it('keeps classroom courses separate from online offers and shows the classroom address', async () => {
    const node = markupDocument(renderToStaticMarkup(await SitovCourseLanding({ lang, type: 'presence', dictionary })))
    const catalog = node.querySelector('#courses')!
    expect(catalog.querySelectorAll('article')).toHaveLength(1)
    expect(catalog).toHaveTextContent('Präsenzangebot')
    expect(catalog).not.toHaveTextContent('Online-Angebot')
    expect(catalog).not.toHaveTextContent('Privatangebot')
    const practical = node.querySelector('aside')!
    expect(practical).toHaveTextContent('Freizeitheim Vahrenwald')
    expect(practical).toHaveTextContent('Vahrenwalder Str. 92')
    expect(practical).not.toHaveTextContent('Hüttenstraße')
    expect(catalog.querySelector('a[href$="courseId=presence-course&trial=1"]')).not.toBeNull()
  })

  it('shows only online offers and never adds a private-lesson trial or invented timetable', async () => {
    const copy = getSitovCourseSeoCopy(lang, 'online')
    const node = markupDocument(renderToStaticMarkup(await SitovCourseLanding({ lang, type: 'online', dictionary })))
    const catalog = node.querySelector('#courses')!
    expect(catalog.querySelectorAll('article')).toHaveLength(2)
    expect(catalog).not.toHaveTextContent('Präsenzangebot')
    expect(catalog.querySelector('a[href$="courseId=online-course&trial=1"]')).not.toBeNull()
    expect(catalog.querySelector('a[href$="courseId=private-course&trial=1"]')).toBeNull()
    const privateCard = [...catalog.querySelectorAll('article')].find(card => card.textContent?.includes('Privatangebot'))!
    expect(privateCard).toHaveTextContent(copy.arrangedTimes)
    expect(privateCard.querySelector('ul')).toBeNull()
    expect(node.querySelector('aside address')).toBeNull()
  })

  it.each(['presence', 'online'] as const)('%s has its own title, canonical URL and complete language cluster', async type => {
    const metadata = await (type === 'presence' ? hannoverMetadata : onlineMetadata)({ params: Promise.resolve({ lang }) })
    const copy = getSitovCourseSeoCopy(lang, type)
    const path = type === 'presence' ? '/deutschkurse-hannover' : '/deutschkurse-online'
    expect(metadata.title).toBe(copy.title)
    expect(metadata.description).toBe(copy.description)
    expect(metadata.alternates?.canonical).toBe(localizedUrl(lang, path))
    expect(Object.keys(metadata.alternates!.languages!)).toHaveLength(6)
    expect(metadata.robots).toMatchObject({ index: true, follow: true })
  })

  it('provides visible localized footer links to both course topics', () => {
    const node = markupDocument(renderToStaticMarkup(<AcademyFooter lang={lang} dictionary={dictionary} />))
    const links = getSitovCourseLinks(lang)
    const navigation = node.querySelector(`nav[aria-label="${links.label}"]`)!
    expect(navigation.querySelectorAll('a')).toHaveLength(2)
    for (const link of links.links) expect(navigation.querySelector(`a[href="${link.href}"]`)).toHaveTextContent(link.label)
  })
})

it.each(['presence', 'online'] as const)('%s empty catalog gives contact and another format without made-up prices or offers', async type => {
  jest.mocked(getCourses).mockResolvedValue([])
  const copy = getSitovCourseSeoCopy('de', type)
  const node = markupDocument(renderToStaticMarkup(await SitovCourseLanding({ lang: 'de', type, dictionary: de })))
  const catalog = node.querySelector('#courses')!
  expect(catalog.querySelectorAll('article')).toHaveLength(0)
  expect(catalog).toHaveTextContent(copy.noCourses)
  expect(catalog.querySelector('a[href="mailto:info@sitov-academy.com"]')).toHaveTextContent(copy.contact)
  expect(catalog.querySelector('a[href="/de/deutschkurse-' + (type === 'presence' ? 'online' : 'hannover') + '"]')).not.toBeNull()
  expect(catalog.querySelector('a[href*="courseId="]')).toBeNull()
  expect(catalog.textContent).not.toMatch(/€|C1|B2/)
})
