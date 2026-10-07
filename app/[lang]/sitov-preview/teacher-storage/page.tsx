import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminI18nProvider } from '@/components/admin/AdminI18nProvider'
import { SitovMediaStorageUsageView } from '@/components/admin/MediaStorageUsage'
import TeacherLayout from '@/components/admin/TeacherLayout'
import { StatTile } from '@/components/admin/ui'
import BrandLogo from '@/components/layout/BrandLogo'
import { SITOV_PLATFORM_LEVELS } from '@/lib/access/levels'
import { getDictionary } from '@/lib/dictionary'

/** Synthetic read-only visual fixture; unavailable in production and never queries real storage. */
export default async function SitovTeacherStoragePreview({ params }: { params: Promise<{ lang: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  const dictionary = await getDictionary(lang)
  const GiB = 1024 ** 3, MiB = 1024 ** 2
  const data = {
    total_bytes: 85 * MiB, storage_total_bytes: 512 * MiB, unknown_size_objects: 0,
    levels: [
      ...SITOV_PLATFORM_LEVELS.map((level, index) => ({ level, bytes: index === 0 ? 80 * MiB : index === 1 ? 5 * MiB : 0, limit_bytes: 20 * GiB })),
      ...['B2', 'C1', 'C2'].map(level => ({ level, bytes: 0, limit_bytes: 20 * GiB })),
    ],
    buckets: [
      { bucket_id: 'audio_cache', bytes: 339 * MiB, object_count: 16000, unknown_size_objects: 0, limit_bytes: 8 * GiB },
      { bucket_id: 'course-assets', bytes: 85 * MiB, object_count: 2, unknown_size_objects: 0, limit_bytes: 30 * GiB },
      { bucket_id: 'pronunciation_audio', bytes: 86 * MiB, object_count: 40, unknown_size_objects: 0, limit_bytes: 5 * GiB },
      { bucket_id: 'sitov-exam-submissions', bytes: 2 * MiB, object_count: 4, unknown_size_objects: 0, limit_bytes: 10 * GiB },
    ],
    disk: { totalBytes: 230 * GiB, usedBytes: 160 * GiB, availableBytes: 70 * GiB, warning: false },
  }
  const brand = <Link href={`/${lang}/sitov-preview/teacher-storage`}><BrandLogo name="Sitov Academy" /></Link>
  return (
    <AdminI18nProvider translations={dictionary.admin}>
      <TeacherLayout lang={lang} brand={brand} controls={null} account={{ name: 'Jonas', role: dictionary.admin.role_teacher }} sitovPreviewPathname={`/${lang}/admin`}>
        <h1 className="mb-4 text-2xl font-semibold">{dictionary.admin.kpi_storage}</h1>
        <div className="grid grid-cols-2 items-start gap-3 lg:grid-cols-4">
          <StatTile label={dictionary.admin.kpi_students} value={60} hint={dictionary.admin.kpi_students_hint} />
          <StatTile label={dictionary.admin.kpi_activated} value={42} />
          <StatTile label={dictionary.admin.kpi_pending} value={0} hint={dictionary.admin.kpi_pending_hint} className="col-span-2 lg:col-span-1" />
          <SitovMediaStorageUsageView dictionary={dictionary} lang={lang} data={data} />
        </div>
      </TeacherLayout>
    </AdminI18nProvider>
  )
}
