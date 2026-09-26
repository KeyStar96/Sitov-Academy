import React from 'react'
import { render, screen } from '@testing-library/react'
import ProfilePage from '@/app/[lang]/dashboard/profile/page'
import PrivacyPage from '@/app/[lang]/privacy/page'
import { getDictionary } from '@/lib/dictionary'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

jest.unmock('lucide-react')
jest.mock('@/lib/dictionary', () => ({ getDictionary: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: 'privacy-fixture', email: 'learner@example.invalid' } } }) },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { ui_language: 'de', native_language: 'en', person: null } }) }) }) }),
}) }))
jest.mock('@/lib/profile-person', () => ({ resolveVerifiedPerson: async () => ({ id: null }) }))
jest.mock('@/lib/profile-course-history', () => ({ loadVerifiedCourseHistory: async () => null }))
jest.mock('@/components/dashboard/ProfileDetailsForm', () => () => null)
jest.mock('@/components/dashboard/UiLanguageForm', () => () => null)
jest.mock('@/components/dashboard/ProfileCourseHistory', () => () => null)
jest.mock('@/components/dashboard/ProfileAppearanceSettings', () => () => null)
jest.mock('@/components/dashboard/ProfileProgressReset', () => () => null)
jest.mock('@/components/layout/Header', () => () => null)
jest.mock('@/components/sections/AcademyFooter', () => () => null)

it.each([
  ['de', de, /Klickpfade/, /eigene.*Wörter/],
  ['en', en, /click trails/, /own words/],
  ['ru', ru, /нажатия клавиш/, /собственных слов/],
  ['uk', uk, /натискання клавіш/, /власних слів/],
  ['tr', tr, /tuş vuruşları/, /Kendi kelimelerinin/],
] as const)('profile links to the complete learning privacy disclosure in %s', async (lang, dict, noTracking, privateWords) => {
  jest.mocked(getDictionary).mockResolvedValue(dict)
  const profile = render(await ProfilePage({ params: Promise.resolve({ lang }) }))
  expect(screen.getByText(dict.profile.teacher_progress_notice)).toBeVisible()
  expect(screen.getByRole('link', { name: dict.profile.teacher_progress_privacy })).toHaveAttribute('href', `/${lang}/privacy`)
  profile.unmount()

  render(await PrivacyPage({ params: Promise.resolve({ lang }) }))
  const paragraphs = dict.privacy.sections.find(section => section.title.startsWith('11.'))!.content
  const retention = paragraphs.find(text => text.includes('180'))!
  const sessionScope = paragraphs.find(text => noTracking.test(text))!
  const teacherScope = paragraphs.find(text => privateWords.test(text))!
  expect(retention).toBeTruthy()
  expect(sessionScope).toBeTruthy()
  expect(teacherScope).toBeTruthy()
  expect(screen.getByText(retention)).toBeVisible()
  expect(screen.getByText(sessionScope)).toBeVisible()
  expect(screen.getByText(teacherScope)).toBeVisible()
})
