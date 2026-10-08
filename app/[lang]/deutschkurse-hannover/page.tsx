import type { Metadata } from 'next'
import { getDictionary } from '@/lib/dictionary'
import { buildPageMetadata } from '@/lib/seo'
import { getSitovCourseSeoCopy, sitovCoursePagePath } from '@/lib/sitov-course-seo-copy'
import SitovCourseLanding from '@/components/sections/SitovCourseLanding'

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const copy = getSitovCourseSeoCopy(lang, 'presence')
  return buildPageMetadata({ lang, path: sitovCoursePagePath('presence'), title: copy.title, description: copy.description, imageAlt: copy.heading })
}

export default async function SitovHannoverCoursesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <SitovCourseLanding lang={lang} type="presence" dictionary={await getDictionary(lang)} />
}
