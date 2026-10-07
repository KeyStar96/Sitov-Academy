import { render, screen, within } from '@testing-library/react'
import { getMediaStorageUsage } from '@/app/actions/media-storage'
import { MediaStorageUsage } from '@/components/admin/MediaStorageUsage'
import { sitovStorageBytes } from '@/lib/sitov-media-storage'
import de from '@/dictionaries/de.json'
import en from '@/dictionaries/en.json'
import ru from '@/dictionaries/ru.json'
import uk from '@/dictionaries/uk.json'
import tr from '@/dictionaries/tr.json'

jest.unmock('lucide-react')
jest.mock('@/app/actions/media-storage', () => ({ getMediaStorageUsage: jest.fn() }))

const GiB = 1024 ** 3, MiB = 1024 ** 2
const usage = {
  total_bytes: 42 * MiB, storage_total_bytes: 512 * MiB, unknown_size_objects: 0,
  levels: [
    { level: 'C2', bytes: 0, limit_bytes: 20 * GiB },
    { level: 'B2', bytes: 2 * MiB, limit_bytes: 20 * GiB },
    { level: 'A1.2', bytes: 0, limit_bytes: 20 * GiB },
    { level: 'A1.1', bytes: 40 * MiB, limit_bytes: 20 * GiB },
    { level: 'C1', bytes: 0, limit_bytes: 20 * GiB },
  ],
  buckets: [
    { bucket_id: 'audio_cache', bytes: 470 * MiB, object_count: 10, unknown_size_objects: 0, limit_bytes: 8 * GiB },
    { bucket_id: 'course-assets', bytes: 42 * MiB, object_count: 2, unknown_size_objects: 0, limit_bytes: 30 * GiB },
  ],
  disk: { totalBytes: 200 * GiB, usedBytes: 140 * GiB, availableBytes: 58 * GiB, warning: false },
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getMediaStorageUsage).mockResolvedValue({ success: true, data: usage })
})

it('distinguishes all measured media, the server disk and per-level upload limits', async () => {
  render(await MediaStorageUsage({ dictionary: de, lang: 'de' }))
  expect(screen.getByText('512 MiB')).toBeVisible()
  expect(screen.getByText('140 GiB von 200 GiB')).toBeVisible()
  expect(screen.getByText('58 GiB für die Anwendung frei')).toBeVisible()
  expect(screen.getByText(/Server-Datenträger/)).toHaveTextContent('70 %')
  const levels = screen.getByText('Kursmaterial je Trainerniveau').closest('details')!
  levels.open = true
  expect(within(levels).getByText('40 MiB')).toBeVisible()
  expect(within(levels).getByText('0 B')).toBeVisible()
  expect(within(levels).queryByText('B2', { exact: true })).not.toBeInTheDocument()
  expect(within(levels).queryByText('C1', { exact: true })).not.toBeInTheDocument()
  expect(within(levels).queryByText('C2', { exact: true })).not.toBeInTheDocument()
  expect(within(levels).getByText('Weitere Kursmaterialien')).toBeVisible()
  expect(within(levels).getByText('2 MiB')).toBeVisible()
  expect(within(levels).getByText('Kursmaterialien gesamt: 42 MiB')).toBeVisible()
  expect(within(levels).getAllByText('Uploadgrenze: 20 GiB')).toHaveLength(2)
  expect(within(levels).getByText(/Uploadgrenzen reservieren keinen Platz/)).toBeVisible()
})

it('never labels a legacy course-material total as all media, and preserves it if disk reading fails', async () => {
  jest.mocked(getMediaStorageUsage).mockResolvedValue({ success: true, data: { total_bytes: 1024, levels: [], disk: null } })
  render(await MediaStorageUsage({ dictionary: de, lang: 'de' }))
  expect(screen.getByText('Kursmaterialien')).toBeVisible()
  expect(screen.queryByText('Medienspeicher')).not.toBeInTheDocument()
  expect(screen.getByText('1 KiB', { selector: 'p' })).toBeVisible()
  expect(screen.getByText('Datenträgerbelegung derzeit nicht verfügbar')).toBeVisible()
})

it('marks incomplete measurements instead of representing missing sizes as known zero', async () => {
  jest.mocked(getMediaStorageUsage).mockResolvedValue({ success: true, data: { ...usage, storage_total_bytes: 0, unknown_size_objects: 2 } })
  render(await MediaStorageUsage({ dictionary: de, lang: 'de' }))
  expect(screen.getByRole('status')).toHaveTextContent('Für 2 Dateien fehlt die Größenangabe; die Summe enthält nur gemessene Größen.')
})

it.each([['de', de], ['en', en], ['ru', ru], ['uk', uk], ['tr', tr]] as const)('uses the complete %s interface translation for the storage scopes', async (lang, dictionary) => {
  render(await MediaStorageUsage({ dictionary, lang }))
  expect(screen.getByText(dictionary.admin.kpi_storage)).toBeVisible()
  expect(screen.getByText(dictionary.admin.kpi_storage_scope)).toBeVisible()
  expect(screen.getByText(dictionary.admin.kpi_storage_levels)).toBeVisible()
  expect(screen.getByText(dictionary.admin.kpi_storage_buckets)).toBeVisible()
})

it.each([[1, '1 B'], [1024, '1 KiB'], [5120, '5 KiB'], [40 * MiB, '40 MiB'], [20 * GiB, '20 GiB']])('retains visible precision for %s stored bytes', (value, formatted) => {
  expect(sitovStorageBytes(value as number, 'de')).toBe(formatted)
})
