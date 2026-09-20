import { getTeacherAnalyticsOptions } from '@/app/actions/teacher-analytics'
import TeacherAnalytics from '@/components/admin/TeacherAnalytics'
import { getDictionary } from '@/lib/dictionary'

export default async function AnalyticsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [options, dict] = await Promise.all([getTeacherAnalyticsOptions(), getDictionary(lang)])
  return <TeacherAnalytics key={options.success ? options.data.students[0]?.id ?? 'empty' : 'failed'}
    options={options.success ? options.data : { students: [], courses: [] }} failed={!options.success}
    lang={lang} translations={dict.vocabulary ?? {}} />
}
