import { getCertificateAdminData } from '@/app/actions/certificates'
import CertificateDashboard from '@/components/admin/certificates/CertificateDashboard'
import { certificateTabFrom } from '@/components/admin/certificates/tabs'
import { certificateAdminCopy } from '@/components/admin/certificates/i18n'
import { Notice, PageHeader } from '@/components/admin/ui'
import { administrationCopy } from '@/lib/admin-administration-i18n'

export const dynamic = 'force-dynamic'
export default async function CertificatesPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ lang }, { tab }] = await Promise.all([params, searchParams])
  const result = await getCertificateAdminData()
  if (result.success === false) {
    const c = certificateAdminCopy(lang)
    return <div className="min-w-0 space-y-5"><PageHeader title={administrationCopy(lang).certificatesTitle} /><Notice tone="warning" role="alert">{result.error === 'not_authenticated' || result.error === 'not_authorized' ? c.denied : c.failed}</Notice></div>
  }
  return <CertificateDashboard initialData={result.data} lang={lang} view="certificates" initialTab={certificateTabFrom(tab)} />
}
