import { getMediaStorageUsage } from '@/app/actions/media-storage'
import type { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'

type Dictionary = Awaited<ReturnType<typeof getDictionary>>
export async function MediaStorageUsage({ dictionary, lang }: { dictionary: Dictionary; lang: string }) {
  const t = createAdminTranslator(dictionary.admin)
  const result = await getMediaStorageUsage()
  const bytes = (value: number) => `${new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(value / 1024 ** 3)} GiB`
  return <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4" aria-labelledby="storage-heading">
    <h2 id="storage-heading" className="font-semibold">{t('storage_title')}</h2>
    {!result.success ? <p className="mt-2 text-sm">{t('storage_unavailable')}</p> : <>
      <p className="mt-2 text-sm">{t('storage_disk')}: {bytes(result.data.disk.usedBytes)} / {bytes(result.data.disk.totalBytes)}</p>
      {result.data.disk.warning && <p role="alert" className="mt-2 font-semibold">{t('storage_warning')}</p>}
      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{result.data.levels.map(item => <div key={item.level} className="rounded border border-[var(--border)] p-3">
        <dt className="font-medium">{item.level}</dt><dd className="mt-1 text-sm">{t('storage_used')}: {bytes(item.bytes)}<br />{t('storage_level_limit')}: {bytes(item.limit_bytes)}</dd>
      </div>)}</dl>
    </>}
  </section>
}
