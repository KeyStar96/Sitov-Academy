import { HardDrive } from 'lucide-react'
import { getMediaStorageUsage } from '@/app/actions/media-storage'
import type { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'
import { ProgressBar, StatTile, adminFocus } from './ui'

type Dictionary = Awaited<ReturnType<typeof getDictionary>>

/**
 * Kennzahl „Medienspeicher“ für die Übersicht: Belegung des VPS-Datenträgers
 * mit Warnschwelle (80 %) und aufklappbarer Belegung je Niveau.
 */
export async function MediaStorageUsage({ dictionary, lang, href }: { dictionary: Dictionary; lang: string; href?: string }) {
  const t = createAdminTranslator(dictionary.admin)
  const result = await getMediaStorageUsage()
  const bytes = (value: number) => `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(value / 1024 ** 3)} GiB`

  if (!result.success) {
    return <StatTile label={t('kpi_storage')} value="—" hint={t('storage_unavailable')} icon={HardDrive} href={href} />
  }

  const { disk, levels } = result.data
  const percent = disk.totalBytes > 0 ? Math.round((disk.usedBytes / disk.totalBytes) * 100) : 0
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[0.8125rem] font-medium leading-snug text-[var(--muted)]">{t('kpi_storage')}</p>
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${disk.warning ? 'bg-[var(--warning)] text-[var(--warning-foreground)]' : 'bg-[var(--surface-muted)] text-[var(--muted)]'}`}>
          <HardDrive size={16} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums">{percent}&nbsp;%</p>
      <p className="mt-1.5 text-xs leading-snug text-[var(--muted)]">{t('kpi_storage_used', { used: bytes(disk.usedBytes), total: bytes(disk.totalBytes) })}</p>
      <div className="mt-3">
        <ProgressBar value={disk.usedBytes} max={disk.totalBytes} tone={disk.warning ? 'warning' : 'neutral'} />
      </div>
      {disk.warning && <p role="alert" className="mt-2 text-xs font-semibold text-[var(--danger)]">{t('storage_warning')}</p>}
      {levels.length > 0 && (
        <details className="group mt-3">
          <summary className={`-mx-1 flex min-h-11 cursor-pointer list-none items-center rounded-md px-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)] ${adminFocus}`}>
            {t('kpi_storage_levels')}
            <span aria-hidden="true" className="ml-1 transition-transform group-open:rotate-90">›</span>
          </summary>
          <dl className="mt-1 space-y-2.5">
            {levels.map(item => (
              <div key={item.level} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <dt className="font-semibold">{item.level}</dt>
                  <dd className="tabular-nums text-[var(--muted)]">{t('kpi_storage_used', { used: bytes(item.bytes), total: bytes(item.limit_bytes) })}</dd>
                </div>
                <div className="mt-1"><ProgressBar value={item.bytes} max={item.limit_bytes} tone={item.bytes / Math.max(1, item.limit_bytes) >= 0.8 ? 'warning' : 'neutral'} /></div>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  )
}
