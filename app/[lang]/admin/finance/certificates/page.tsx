import Link from 'next/link'
import { getCertificateAdminData } from '@/app/actions/certificates'
import CertificateDashboard from '@/components/admin/certificates/CertificateDashboard'
import { certificateAdminCopy } from '@/components/admin/certificates/i18n'

export const dynamic = 'force-dynamic'
export default async function CertificatesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const result = await getCertificateAdminData()
  const c = certificateAdminCopy(lang)
  if (result.success === false) return <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--foreground)]"><h1 className="text-2xl font-semibold">{c.title}</h1><p role="alert">{result.error === 'not_authenticated' || result.error === 'not_authorized' ? c.denied : c.failed}</p><Link href={`/${lang}/admin/finance`} className="inline-flex min-h-11 items-center underline">{c.back}</Link></section>
  return <CertificateDashboard initialData={result.data} lang={lang} />
}
