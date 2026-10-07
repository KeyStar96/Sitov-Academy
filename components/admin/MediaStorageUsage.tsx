import { HardDrive } from 'lucide-react'
import { getMediaStorageUsage } from '@/app/actions/media-storage'
import type { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'
import { sitovStorageBytes, sitovStorageTrainerLevels } from '@/lib/sitov-media-storage'
import type { AdminTranslationKey } from '@/lib/admin-i18n'
import { ProgressBar, StatTile, adminFocus } from './ui'

type Dictionary = Awaited<ReturnType<typeof getDictionary>>
type SitovMediaStorageData = Extract<Awaited<ReturnType<typeof getMediaStorageUsage>>, { success: true }>['data']
type SitovMediaStorageProps = { dictionary: Dictionary; lang: string; href?: string }

const sitovBucketLabels: Readonly<Record<string, AdminTranslationKey>> = {
  'course-assets': 'kpi_storage_bucket_course',
  audio_cache: 'kpi_storage_bucket_audio',
  pronunciation_audio: 'kpi_storage_bucket_pronunciation',
  'sitov-exam-submissions': 'kpi_storage_bucket_exam',
}

/** Measured media, upload quotas and the whole server disk have separate scopes. */
export async function MediaStorageUsage({ dictionary, lang, href }: SitovMediaStorageProps) {
  const t = createAdminTranslator(dictionary.admin)
  const result = await getMediaStorageUsage()
  if (!result.success) {
    return <StatTile label={t('kpi_storage')} value="—" hint={t('storage_unavailable')} icon={HardDrive} href={href} className="col-span-2 lg:col-span-1" />
  }
  return <SitovMediaStorageUsageView dictionary={dictionary} lang={lang} data={result.data} />
}

/** Shared read-only rendering also used by the development-only synthetic preview. */
export function SitovMediaStorageUsageView({ dictionary, lang, data }: SitovMediaStorageProps & { data: SitovMediaStorageData }) {
  const t = createAdminTranslator(dictionary.admin)
  const bytes = (value: number) => sitovStorageBytes(value, lang)
  const { disk, levels, buckets, total_bytes: courseBytes, storage_total_bytes: storageBytes, unknown_size_objects: unknownObjects } = data
  const { trainerLevels, otherCourseBytes } = sitovStorageTrainerLevels(levels, courseBytes)
  const percent = disk ? Math.round((disk.usedBytes / disk.totalBytes) * 100) : null
  const completeStorage = storageBytes !== undefined
  const summaryClass = `-mx-1 flex min-h-11 cursor-pointer list-none items-center rounded-md px-1 text-xs font-semibold text-[var(--muted)] transition-[color,transform] duration-[var(--motion-fast)] hover:text-[var(--foreground)] active:translate-y-px motion-reduce:transform-none motion-reduce:transition-none ${adminFocus}`
  const disclosureArrow = <span aria-hidden="true" className="ml-auto pl-2 transition-transform duration-[var(--motion-base)] ease-[var(--ease-out-soft)] group-open:rotate-90 motion-reduce:transition-none">›</span>
  return (
    <div data-sitov-media-storage className="col-span-2 flex min-w-0 flex-col rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4 lg:col-span-1">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[0.8125rem] font-medium leading-snug text-[var(--muted)]">{t(completeStorage ? 'kpi_storage' : 'kpi_storage_bucket_course')}</p>
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${disk?.warning ? 'bg-[var(--warning)] text-[var(--warning-foreground)]' : 'bg-[var(--surface-muted)] text-[var(--muted)]'}`}>
          <HardDrive size={16} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums">{bytes(storageBytes ?? courseBytes)}</p>
      <p className="mt-1.5 text-xs leading-snug text-[var(--muted)]">{t(completeStorage ? 'kpi_storage_scope' : 'kpi_storage_level_scope')}</p>
      {!!unknownObjects && <p role="status" className="mt-2 text-xs text-[var(--muted)]">{t('kpi_storage_unknown', { count: unknownObjects })}</p>}
      <div className="mt-3 border-t border-[var(--admin-line)] pt-3">
        <p className="text-xs font-semibold">{t('kpi_storage_server')}{percent !== null && <span className="tabular-nums"> · {percent}&nbsp;%</span>}</p>
        {disk ? (
          <>
            <p className="mt-1 text-xs leading-snug tabular-nums text-[var(--muted)]">{t('kpi_storage_used', { used: bytes(disk.usedBytes), total: bytes(disk.totalBytes) })}</p>
            <p className="mt-1 text-xs leading-snug tabular-nums text-[var(--muted)]">{t('kpi_storage_free', { free: bytes(disk.availableBytes) })}</p>
            <div className="mt-2"><ProgressBar value={disk.usedBytes} max={disk.totalBytes} tone={disk.warning ? 'warning' : 'neutral'} /></div>
          </>
        ) : <p className="mt-1 text-xs text-[var(--muted)]">{t('kpi_storage_disk_unavailable')}</p>}
        <p className="mt-2 text-xs leading-snug text-[var(--muted)]">{t('kpi_storage_server_scope')}</p>
      </div>
      {disk?.warning && <p role="alert" className="mt-2 text-xs font-semibold text-[var(--danger)]">{t('storage_warning')}</p>}
      {buckets && buckets.length > 0 && (
        <details className="group mt-2">
          <summary className={summaryClass}>{t('kpi_storage_buckets')}{disclosureArrow}</summary>
          <dl className="mt-1 space-y-2.5">
            {buckets.map(item => (
              <div key={item.bucket_id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 text-xs">
                <dt className="font-semibold">{sitovBucketLabels[item.bucket_id] ? t(sitovBucketLabels[item.bucket_id]) : item.bucket_id}</dt>
                <dd className="contents">
                  <span className="tabular-nums text-[var(--muted)]">{bytes(item.bytes)}</span>
                  {item.limit_bytes !== null && (
                    <>
                      <span className="col-span-2 mt-1 tabular-nums text-[var(--muted)]">{t('kpi_storage_quota', { limit: bytes(item.limit_bytes) })}</span>
                      <div className="col-span-2 mt-1"><ProgressBar value={item.bytes} max={item.limit_bytes} tone={item.bytes / item.limit_bytes >= 0.8 ? 'warning' : 'neutral'} /></div>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs leading-snug text-[var(--muted)]">{t('kpi_storage_quota_note')}</p>
        </details>
      )}
      {(trainerLevels.length > 0 || otherCourseBytes > 0) && (
        <details className="group mt-1">
          <summary className={summaryClass}>{t('kpi_storage_levels')}{disclosureArrow}</summary>
          <p className="mt-1 text-xs font-semibold tabular-nums">{t('kpi_storage_course_total', { total: bytes(courseBytes) })}</p>
          <p className="mt-1 text-xs leading-snug text-[var(--muted)]">{t('kpi_storage_level_scope')}</p>
          <dl className="mt-3 space-y-2.5">
            {trainerLevels.map(item => (
              <div key={item.level} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2 text-xs">
                <dt className="font-semibold">{item.level}</dt>
                <dd className="contents">
                  <span className="tabular-nums text-[var(--muted)]">{bytes(item.bytes)}</span>
                  <span className="col-span-2 mt-1 tabular-nums text-[var(--muted)]">{t('kpi_storage_quota', { limit: bytes(item.limit_bytes) })}</span>
                  <div className="col-span-2 mt-1"><ProgressBar value={item.bytes} max={item.limit_bytes} tone={item.bytes / item.limit_bytes >= 0.8 ? 'warning' : 'neutral'} /></div>
                </dd>
              </div>
            ))}
            {otherCourseBytes > 0 && (
              <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs">
                <dt className="font-semibold">{t('kpi_storage_course_other')}</dt>
                <dd className="tabular-nums text-[var(--muted)]">{bytes(otherCourseBytes)}</dd>
              </div>
            )}
          </dl>
          <p className="mt-2 text-xs leading-snug text-[var(--muted)]">{t('kpi_storage_quota_note')}</p>
        </details>
      )}
    </div>
  )
}
