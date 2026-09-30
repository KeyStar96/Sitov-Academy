import Link from 'next/link'
import { getCourseCancellationData } from '@/app/actions/course-cancellations'
import CourseCancellations from '@/components/admin/CourseCancellations'
import { Notice, PageHeader, adminButton } from '@/components/admin/ui'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'
import { courseCancellationsCopy } from '@/lib/course-cancellations-i18n'

export const dynamic = 'force-dynamic'

export default async function CourseCancellationsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [result, dict] = await Promise.all([getCourseCancellationData(), getDictionary(lang)])
  if (!result.success) {
    const t = createAdminTranslator(dict.admin)
    const c = courseCancellationsCopy(lang)
    return (
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <PageHeader title={t('nav_cancellations')} description={c.intro} />
        <Notice tone="warning" role="alert" action={<Link href={`/${lang}/admin/courses/cancellations`} className={adminButton('secondary', 'sm')}>{c.reload}</Link>}>{c.loadFailed}</Notice>
      </div>
    )
  }
  return <CourseCancellations data={result.data} lang={lang} />
}
