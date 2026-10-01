import { getTeacherAnalyticsOptions } from '@/app/actions/teacher-analytics'
import TeacherAnalytics from '@/components/admin/TeacherAnalytics'
import { getDictionary } from '@/lib/dictionary'
import { progressRangeFrom } from '@/lib/learning-progress'

export default async function AnalyticsPage({ params, searchParams }: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ student?: string | string[]; days?: string | string[] }>
}) {
  const [{ lang }, query] = await Promise.all([params, searchParams])
  const [options, dict] = await Promise.all([getTeacherAnalyticsOptions(), getDictionary(lang)])
  const student = typeof query.student === 'string' ? query.student : null
  return <TeacherAnalytics key={options.success ? `${student ?? options.data.students[0]?.id ?? 'empty'}` : 'failed'}
    options={options.success ? options.data : { students: [], levels: [] }} failed={!options.success}
    initialStudentId={student} initialDays={progressRangeFrom(query.days)}
    lang={lang} translations={dict.vocabulary ?? {}} />
}
