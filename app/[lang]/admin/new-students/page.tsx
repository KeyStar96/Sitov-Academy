import Link from 'next/link'
import { getNewStudents } from '@/app/actions/new-students'
import NewStudents from '@/components/admin/NewStudents'
import { Notice, PageHeader, adminButton } from '@/components/admin/ui'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'
import { newStudentsCopy } from '@/lib/new-students-i18n'

export const dynamic = 'force-dynamic'

export default async function NewStudentsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [result, dict] = await Promise.all([getNewStudents(), getDictionary(lang)])
  const t = createAdminTranslator(dict.admin)
  const c = newStudentsCopy(lang)
  if (!result.success) {
    return (
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <PageHeader title={t('nav_new_students')} description={c.intro} />
        <Notice tone="warning" role="alert" action={<Link href={`/${lang}/admin/new-students`} className={adminButton('secondary', 'sm')}>{c.reload}</Link>}>
          {c.loadFailed}
        </Notice>
      </div>
    )
  }
  return <NewStudents students={result.data} lang={lang} />
}
